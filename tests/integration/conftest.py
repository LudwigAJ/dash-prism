"""
Pytest configuration and fixtures for dash_prism integration tests.

Integration tests use dash[testing]'s dash_duo fixture to test browser interactions.
Following Dash Testing Best Practices:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors
- Check for browser console errors
- Keep tests isolated

Utility functions are defined in testutils.py.
"""

from __future__ import annotations

import socket
import pytest
from dash import Dash, html, Input, Output
from selenium.webdriver.chrome.options import Options
import dash_prism


def get_free_port() -> int:
    """
    Find and return an available port by binding to port 0.

    This is thread-safe and avoids port conflicts in parallel test execution.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

# Import all test utilities from testutils module
from testutils import (
    # Selectors
    TAB_SELECTOR,
    PANEL_SELECTOR,
    ADD_TAB_BUTTON,
    SEARCHBAR_INPUT,
    CONTEXT_MENU,
    PRISM_ROOT,
    DROP_ZONE_LEFT,
    DROP_ZONE_RIGHT,
    DROP_ZONE_TOP,
    DROP_ZONE_BOTTOM,
    # Wait helpers
    wait_for_tab_count,
    wait_for_panel_count,
    wait_for_element_invisible,
    wait_for_drop_zones_visible,
    wait_for_panel_layout_stable,
    # Element getters
    get_tabs,
    get_panels,
    get_tab_id,
    get_panel_id,
    get_tab_order_in_panel,
    verify_tab_in_panel,
    are_drop_zones_present,
    check_browser_errors,
    # React interaction helpers
    trigger_rename_mode,
    set_input_value_react,
    press_enter_on_element,
    # Tab management
    create_tabs_for_dnd_test,
    # Drag-and-drop helpers
    perform_drag_and_drop,
    drag_tab_to_position,
    drag_tab_to_panel_edge,
    drag_tab_to_other_panel,
    start_drag_without_drop,
    cancel_drag_with_escape,
)


# =============================================================================
# Chrome Performance Options for Faster Tests
# =============================================================================
def pytest_setup_options():
    """
    Configure Chrome options for faster, more reliable headless testing.

    This hook is called by dash[testing] to configure the browser.
    """
    options = Options()
    # Use new headless mode which behaves more like regular Chrome
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-browser-side-navigation")
    # Headless stability flags for @dnd-kit pointer/mouse event handling
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--disable-backgrounding-occluded-windows")
    return options


# =============================================================================
# Fixtures
# =============================================================================
@pytest.fixture(autouse=True)
def clear_registry_integration():
    """
    Clear the layout registry before and after each test.

    Ensures integration tests don't interfere with each other.
    """
    dash_prism.clear_registry()
    yield
    dash_prism.clear_registry()


@pytest.fixture
def prism_app_with_layouts(dash_duo):
    """
    Create a Dash app with Prism component and registered test layouts.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash[testing] fixture combining Dash server + browser.

    Returns
    -------
    DashComposite
        The dash_duo instance with app already started and loaded.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    # Register test layouts
    dash_prism.register_layout(
        id="test-static",
        name="Test Static Layout",
        description="A simple static test layout",
        layout=html.Div([html.H1("Test Content"), html.P("Static content", id="static-content")]),
    )

    dash_prism.register_layout(
        id="test-callback",
        name="Test Callback Layout",
        description="A layout with callback",
        layout=html.Div(
            [
                html.H1("Callback Test"),
                html.Button("Click me", id="test-button", n_clicks=0),
                html.Div(id="test-output"),
            ]
        ),
    )

    @app.callback(Output("test-output", "children"), Input("test-button", "n_clicks"))
    def update_output(n_clicks):
        return f"Clicked {n_clicks} times"

    # Set up app layout with Prism
    # Explicitly disable persistence to avoid state leaking between tests
    # Use 100vh height to fill the viewport for proper DnD testing
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                theme="light",
                size="md",
                maxTabs=10,
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh", "width": "100%"},
            )
        ],
        style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
    )

    # Initialize Prism with callbacks
    dash_prism.init("prism", app)

    # Get a free port to avoid conflicts in parallel test execution
    port = get_free_port()

    # CRITICAL: Inject ResizeObserver patch BEFORE app mount via Chrome DevTools Protocol
    # This ensures all observers created during React mount use the patched implementation.
    # The previous approach of patching after start_server() was too late - react-split-pane
    # creates its observers during initial mount and never picks up the post-hoc patch.
    dash_duo.driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {
            "source": """
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

                        // Fire callback immediately AND retry until non-zero dimensions
                        // This is critical for headless Chrome where initial rects may be 0x0
                        const fireCallback = (attempt = 0) => {
                            const rect = target.getBoundingClientRect();
                            const entry = {
                                target,
                                contentRect: rect,
                                borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
                                contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }]
                            };
                            this.callback([entry], this.observer);

                            // Retry up to 10 times if dimensions are zero
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

                // Suppress ResizeObserver loop errors
                window.addEventListener('error', e => {
                    if (e.message && e.message.includes('ResizeObserver loop')) {
                        e.stopImmediatePropagation();
                    }
                });

                console.log('[Test] ResizeObserver patched via CDP before app mount');
            })();
            """
        },
    )

    # Explicitly set window size BEFORE server start (critical for headless mode!)
    dash_duo.driver.set_window_size(1920, 1080)

    # Start server on the dynamically assigned port
    dash_duo.start_server(app, port=port)

    # Force a resize event after mount to trigger any pending observers
    dash_duo.driver.execute_script("window.dispatchEvent(new Event('resize'));")
    
    # Log container dimensions for debugging
    dash_duo.driver.execute_script(
        """
        console.log('[Test] Initial container dimensions:', 
            document.querySelector('.prism-container')?.getBoundingClientRect() || 'not found');
    """
    )

    # Clear any stored workspace data from previous test runs
    dash_duo.driver.execute_script(
        """
        localStorage.removeItem('prism-workspace');
        sessionStorage.removeItem('prism-workspace');
    """
    )

    # Wait for Prism to fully load (explicit wait)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    return dash_duo


@pytest.fixture
def simple_prism_app(dash_duo):
    """
    Create a minimal Prism app with one simple layout.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash[testing] fixture.

    Returns
    -------
    DashComposite
        The dash_duo instance with app started.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    # Single simple layout
    dash_prism.register_layout(
        id="simple",
        name="Simple",
        layout=html.Div("Simple content", id="simple-content"),
    )

    app.layout = html.Div(
        [dash_prism.Prism(id="prism", persistence=False, style={"height": "100vh"})],
        style={"height": "100vh", "margin": "0", "padding": "0"},
    )

    dash_prism.init("prism", app)
    dash_duo.start_server(app)

    # Explicitly set window size after launch (critical for headless mode!)
    dash_duo.driver.set_window_size(1920, 1080)

    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    return dash_duo
