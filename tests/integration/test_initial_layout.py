"""
Integration tests for the initialLayout prop.

Regression tests for the bug where initialLayout was validated on the Python
side but never applied by the frontend. The first tab always opened as an
empty "New Tab" regardless of the initialLayout setting.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from dash import Dash, html
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.common.by import By
import dash_prism

from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    PRISM_ROOT,
    wait_for_tab_count,
    get_tabs,
    check_browser_errors,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def clear_registry():
    """Clear registry before and after each test."""
    dash_prism.clear_registry()
    yield
    dash_prism.clear_registry()


def test_initial_layout_applied_on_fresh_workspace(dash_duo):
    """Regression test: initialLayout should load in the first tab on fresh workspace.

    Previously, initialLayout was validated on the Python side and passed through
    ConfigContext but no frontend code read it and applied it. The first tab always
    opened as 'New Tab' with no layout.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    dash_prism.register_layout(
        id="analytics",
        name="Analytics",
        layout=html.Div("Analytics content", id="analytics-content"),
    )

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                initialLayout="home",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh"},
            )
        ],
        style={"height": "100vh"},
    )

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # The first tab should have the "Home Dashboard" layout loaded,
    # not be an empty "New Tab"
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 tab"

    # Wait for the tab name to update from "New Tab" to "Home Dashboard"
    def tab_has_layout_name(driver):
        tab_elements = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        if not tab_elements:
            return False
        return "Home Dashboard" in tab_elements[0].text

    WebDriverWait(dash_duo.driver, 10).until(
        tab_has_layout_name,
        message="First tab should be named 'Home Dashboard' from initialLayout",
    )

    # The layout content should be rendered
    # Note: inject_tab_id transforms id="home-content" into a dict ID
    # like {"type":"home-content","index":"<tabId>"}, so use attribute-contains selector
    dash_duo.wait_for_element("[id*='home-content']", timeout=10)

    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_initial_layout_ignored_with_persistence(dash_duo):
    """Test that initialLayout does NOT override a persisted workspace.

    When persistence is enabled and a saved workspace exists, the persisted
    state should take precedence over initialLayout.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    # Use memory persistence (no actual storage, so workspace is always fresh).
    # With memory persistence, initialLayout SHOULD be applied since there is
    # no saved state.
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                initialLayout="home",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh"},
            )
        ],
        style={"height": "100vh"},
    )

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # With memory persistence (fresh workspace), initialLayout should apply
    def tab_has_layout_name(driver):
        tab_elements = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        if not tab_elements:
            return False
        return "Home Dashboard" in tab_elements[0].text

    WebDriverWait(dash_duo.driver, 10).until(
        tab_has_layout_name,
        message="First tab should show 'Home Dashboard' with memory persistence (fresh workspace)",
    )


def test_initial_layout_without_prop_shows_new_tab(dash_duo):
    """Test that without initialLayout, the first tab is a plain 'New Tab'."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    # No initialLayout prop
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh"},
            )
        ],
        style={"height": "100vh"},
    )

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # The first tab should be "New Tab" (no layout loaded)
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 tab"

    # Tab should say "New Tab", not "Home Dashboard"
    assert (
        "New Tab" in tabs[0].text
    ), f"Without initialLayout, tab should be 'New Tab', got '{tabs[0].text}'"

    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_initial_layout_new_tabs_still_empty(dash_duo):
    """Test that only the FIRST tab gets initialLayout, not subsequent new tabs."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                initialLayout="home",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh"},
            )
        ],
        style={"height": "100vh"},
    )

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Wait for first tab to get the initial layout
    def tab_has_layout_name(driver):
        tab_elements = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        if not tab_elements:
            return False
        return "Home Dashboard" in tab_elements[0].text

    WebDriverWait(dash_duo.driver, 10).until(tab_has_layout_name)

    # Add a second tab
    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(dash_duo, 2)

    # The second tab should be "New Tab", not "Home Dashboard"
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 2

    # The second (newer) tab should be "New Tab"
    second_tab_text = tabs[1].text
    assert "New Tab" in second_tab_text, (
        f"Second tab should be 'New Tab', got '{second_tab_text}'. "
        "initialLayout should only apply to the first tab on a fresh workspace."
    )
