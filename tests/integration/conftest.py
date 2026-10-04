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

import pytest
from dash import html
from selenium.webdriver.chrome.options import Options

import dash_prism
from tests.integration import testutils


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


@pytest.fixture(autouse=True)
def assert_no_browser_errors(request, dash_duo):
    """
    Fail each test that leaves an error in the browser console.

    The check runs after the test, so a failure shows as a pytest ERROR in the
    teardown, not as a test failure. A test marked with
    ``@pytest.mark.allow_console_errors(text, ...)`` accepts the errors that hold one
    of the texts.
    """
    yield
    marker = request.node.get_closest_marker("allow_console_errors")
    allowed = marker.args if marker else ()
    errors = [
        error
        for error in testutils.check_browser_errors(dash_duo)
        if not any(text in error["message"] for text in allowed)
    ]
    assert errors == [], f"The browser console holds errors: {errors}"


@pytest.fixture
def prism_app_with_layouts(dash_duo):
    """
    Serve Prism with a static layout and a layout that holds a button.

    The limit of 10 tabs lets a test reach the limit with few clicks.
    """
    dash_prism.register_layout(
        id="test-static",
        name="Test Static Layout",
        description="A simple static test layout",
        layout=html.Div([html.H1("Test Content"), html.P("Static content", id="static-content")]),
    )
    dash_prism.register_layout(
        id="test-callback",
        name="Test Callback Layout",
        description="A layout with a button",
        layout=html.Div([html.H1("Callback Test"), html.Button("Click me", id="test-button")]),
    )
    return testutils.start_prism(dash_duo, layouts={}, maxTabs=10)
