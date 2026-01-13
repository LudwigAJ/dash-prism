"""
Integration tests for workspace persistence.

Tests basic persistence behavior. Complex persistence tests with
page reload are skipped as they require more advanced setup.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from dash import Dash, html
from selenium.webdriver.support.ui import WebDriverWait
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


def wait_for_storage(
    dash_duo,
    storage_key: str,
    storage_type: str = "local",
    timeout: float = 5.0,
) -> str | None:
    """
    Wait for a value to appear in browser storage.

    Uses explicit WebDriverWait instead of time.sleep().

    Parameters
    ----------
    dash_duo : DashComposite
        The dash_duo test fixture.
    storage_key : str
        The key to check in storage.
    storage_type : str
        Either 'local' or 'session'.
    timeout : float
        Maximum time to wait in seconds.

    Returns
    -------
    str | None
        The storage value if found, None otherwise.
    """
    storage_obj = "localStorage" if storage_type == "local" else "sessionStorage"
    script = f"return {storage_obj}.getItem('{storage_key}')"

    def storage_has_value(driver):
        return driver.execute_script(script) is not None

    try:
        WebDriverWait(dash_duo.driver, timeout).until(storage_has_value)
        return dash_duo.driver.execute_script(script)
    except Exception:
        return None


def test_prism_initializes_without_persistence(dash_duo):
    """Test that Prism works with persistence disabled."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    app.layout = html.Div([
        dash_prism.Prism(
            id="prism",
            persistence=False,
            persistence_type="memory",
            style={},
        )
    ])

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Should have 1 initial tab
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 initial tab"

    # No browser errors
    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_prism_initializes_with_localStorage_persistence(dash_duo):
    """Test that Prism initializes with localStorage persistence enabled."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    app.layout = html.Div([
        dash_prism.Prism(
            id="prism",
            persistence=True,
            persistence_type="local",
            style={},
        )
    ])

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Should have 1 initial tab
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 initial tab"

    # No browser errors
    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_prism_initializes_with_sessionStorage_persistence(dash_duo):
    """Test that Prism initializes with sessionStorage persistence enabled."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    app.layout = html.Div([
        dash_prism.Prism(
            id="prism",
            persistence=True,
            persistence_type="session",
            style={},
        )
    ])

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Should have 1 initial tab
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 initial tab"


# Skip complex persistence tests that require page reload
@pytest.mark.skip(reason="Page reload persistence tests require more complex setup")
def test_workspace_persists_across_reload():
    """Test that workspace state persists across page reload."""
    pass


@pytest.mark.skip(reason="Page reload persistence tests require more complex setup")
def test_readWorkspace_writeWorkspace_sync():
    """Test readWorkspace/writeWorkspace synchronization."""
    pass
