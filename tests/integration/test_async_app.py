"""
Integration tests for Dash apps with use_async=True.

Verifies that dash_prism works correctly when the Dash app uses async
callbacks. This exercises the `render_prism_content_async` code path
in init.py, which is completely separate from the sync path.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from dash import Dash, html
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
import dash_prism

from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    SEARCHBAR_INPUT,
    wait_for_tab_count,
    get_tabs,
    check_browser_errors,
    get_free_port,
)

pytestmark = pytest.mark.integration


def _start_async_prism_app(dash_duo):
    """Start a Prism app with use_async=True and async layout callbacks."""
    try:
        app = Dash(__name__, use_async=True, suppress_callback_exceptions=True)
    except TypeError:
        pytest.skip("This version of Dash does not support use_async")

    # Register a static layout (works in both sync and async modes)
    dash_prism.register_layout(
        id="static-async",
        name="Static Async Layout",
        description="A static layout in an async app",
        layout=html.Div(
            [html.H1("Static in Async"), html.P("Works!", id="static-async-content")],
        ),
    )

    # Register an async callback layout
    @dash_prism.register_layout(
        id="async-greeting",
        name="Async Greeting",
        description="An async callback layout",
    )
    async def async_greeting_layout():
        return html.Div(
            [
                html.H1("Hello from async!"),
                html.P("Async layout rendered", id="async-greeting-content"),
            ],
        )

    # Register an async parameterized callback layout
    @dash_prism.register_layout(
        id="async-chart",
        name="Async Chart",
        description="Async parameterized layout",
        param_options={
            "bar": ("Bar Chart", {"chart_type": "bar"}),
            "line": ("Line Chart", {"chart_type": "line"}),
        },
    )
    async def async_chart_layout(chart_type: str = "bar"):
        return html.Div(
            [
                html.H2(f"Async Chart: {chart_type}"),
                html.P(f"{chart_type} data", id="async-chart-content"),
            ],
        )

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh", "width": "100%"},
            )
        ],
        style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
    )

    dash_prism.init("prism", app)

    port = get_free_port()

    # CRITICAL: Same ResizeObserver CDP patch as conftest._start_prism_app.
    # Without this, headless Chrome panels get 0x0 dimensions and content never renders.
    dash_duo.driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": """
            (function() {
                const OriginalResizeObserver = window.ResizeObserver;
                if (!OriginalResizeObserver) return;

                window.ResizeObserver = class PatchedResizeObserver {
                    constructor(callback) {
                        this.callback = callback;
                        this.observer = new OriginalResizeObserver((entries, observer) => {
                            callback(entries, observer);
                        });
                    }

                    observe(target, options) {
                        this.observer.observe(target, options);

                        const fireCallback = (attempt = 0) => {
                            const rect = target.getBoundingClientRect();
                            const entry = {
                                target,
                                contentRect: rect,
                                borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
                                contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }]
                            };
                            this.callback([entry], this.observer);

                            if ((rect.width === 0 && rect.height === 0) && attempt < 10) {
                                requestAnimationFrame(() => fireCallback(attempt + 1));
                            }
                        };
                        requestAnimationFrame(() => fireCallback(0));
                    }

                    unobserve(target) {
                        this.observer.unobserve(target);
                    }

                    disconnect() {
                        this.observer.disconnect();
                    }
                };

                window.addEventListener('error', e => {
                    if (e.message && e.message.includes('ResizeObserver loop')) {
                        e.stopImmediatePropagation();
                    }
                });
            })();
            """},
    )

    dash_duo.driver.set_window_size(1920, 1080)
    dash_duo.start_server(app, port=port)
    dash_duo.driver.execute_script("window.dispatchEvent(new Event('resize'));")

    return dash_duo


def test_async_app_renders_initial_tab(dash_duo):
    """Test that a use_async=True Prism app renders its initial tab."""
    duo = _start_async_prism_app(dash_duo)

    wait_for_tab_count(duo, 1)

    tabs = get_tabs(duo)
    assert len(tabs) == 1, "Should start with 1 tab in async mode"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors in async mode: {errors}"


def test_async_app_static_layout_works(dash_duo):
    """Test that static layouts work in an async Dash app."""
    duo = _start_async_prism_app(dash_duo)
    wait_for_tab_count(duo, 1)

    # Open SearchBar and select the static layout
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)
    duo.find_element(SEARCHBAR_INPUT).send_keys("Static")

    duo.wait_for_element("[data-testid='prism-layout-item-static-async']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-static-async']").click()

    # Verify content rendered
    duo.wait_for_element("[id*='static-async-content']", timeout=10)

    def tab_shows_name(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("Static Async Layout" in t.text for t in tabs)

    WebDriverWait(duo.driver, 5).until(tab_shows_name)

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors: {errors}"


def test_async_callback_layout_renders(dash_duo):
    """Test that an async callback layout renders correctly in async mode."""
    duo = _start_async_prism_app(dash_duo)
    wait_for_tab_count(duo, 1)

    # Open SearchBar and select the async greeting layout
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)
    duo.find_element(SEARCHBAR_INPUT).send_keys("Async Greeting")

    duo.wait_for_element("[data-testid='prism-layout-item-async-greeting']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-async-greeting']").click()

    # Verify the async callback content was rendered
    duo.wait_for_element("[id*='async-greeting-content']", timeout=10)

    def tab_shows_name(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("Async Greeting" in t.text for t in tabs)

    WebDriverWait(duo.driver, 5).until(tab_shows_name)

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors: {errors}"


def test_async_app_tab_creation(dash_duo):
    """Test that tab creation works normally in async mode."""
    duo = _start_async_prism_app(dash_duo)
    wait_for_tab_count(duo, 1)

    # Create a second tab
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Should have 2 tabs in async mode"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors: {errors}"
