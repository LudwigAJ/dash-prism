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

import time

import pytest
from dash import Dash, html, dcc, Input, Output, State
from dash.exceptions import PreventUpdate
from selenium.webdriver.support.wait import WebDriverWait
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

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={},
            )
        ]
    )

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

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=True,
                persistence_type="local",
                style={},
            )
        ]
    )

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

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=True,
                persistence_type="session",
                style={},
            )
        ]
    )

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Should have 1 initial tab
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 initial tab"


# =============================================================================
# readWorkspace / updateWorkspace Integration Tests
# =============================================================================


def test_readWorkspace_reflects_tab_creation(dash_duo):
    """
    Test that readWorkspace prop reflects state after adding a tab.

    This verifies the Prism → Dash sync via readWorkspace.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    # Use a visible div for easier debugging
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={"height": "90vh"},
            ),
            html.Div(id="workspace-output", children="waiting"),
        ]
    )

    @app.callback(
        Output("workspace-output", "children"),
        Input("prism", "readWorkspace"),
    )
    def capture_workspace(workspace):
        if workspace and "tabs" in workspace:
            return f"tabs:{len(workspace['tabs'])}"
        return "no-workspace"

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Initial state: 1 tab
    initial_tabs = get_tabs(dash_duo)
    assert len(initial_tabs) == 1, "Should start with 1 tab"

    # Wait for readWorkspace to sync (initial state) - debounced at 500ms
    dash_duo.wait_for_text_to_equal("#workspace-output", "tabs:1", timeout=10)

    # Add a new tab
    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(dash_duo, 2)

    # readWorkspace should now reflect 2 tabs (with debounce delay)
    dash_duo.wait_for_text_to_equal("#workspace-output", "tabs:2", timeout=10)

    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_updateWorkspace_modifies_state(dash_duo):
    """
    Test that updateWorkspace prop can modify workspace state.

    This verifies the Dash → Prism sync via updateWorkspace.
    We test by programmatically changing tab names via updateWorkspace,
    demonstrating that Dash can push state changes to the Prism component.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    # Store for capturing workspace state
    workspace_store = {}

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={"height": "90vh"},
            ),
            html.Button("Rename Tabs", id="rename-btn"),
            # Display to show updateWorkspace was triggered
            html.Div(id="update-status", children="not-updated"),
            # Hidden store for workspace data
            dcc.Store(id="workspace-store"),
        ]
    )

    @app.callback(
        Output("workspace-store", "data"),
        Input("prism", "readWorkspace"),
    )
    def capture_workspace(workspace):
        if workspace:
            return workspace
        raise PreventUpdate

    @app.callback(
        Output("prism", "updateWorkspace"),
        Output("update-status", "children"),
        Input("rename-btn", "n_clicks"),
        State("workspace-store", "data"),
        prevent_initial_call=True,
    )
    def rename_tabs(n_clicks, workspace):
        if not workspace or not workspace.get("tabs"):
            raise PreventUpdate

        # Rename all tabs by appending "-renamed" to their names
        modified_tabs = []
        for tab in workspace["tabs"]:
            modified_tab = dict(tab)
            modified_tab["name"] = tab["name"] + "-renamed"
            modified_tabs.append(modified_tab)

        # Return modified workspace with renamed tabs
        return {"tabs": modified_tabs}, "updated"

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Wait for initial readWorkspace sync (debounced)
    time.sleep(1)

    # Get original tab name
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 tab initially"
    original_name = tabs[0].text

    # Click rename button to trigger updateWorkspace
    rename_btn = dash_duo.find_element("#rename-btn")
    rename_btn.click()

    # Wait for updateWorkspace to take effect
    dash_duo.wait_for_text_to_equal("#update-status", "updated", timeout=5)
    time.sleep(0.5)  # Small delay for React re-render

    # Verify tab was renamed
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should still have 1 tab"
    assert tabs[0].text == original_name + "-renamed", (
        f"Tab should be renamed from '{original_name}' to '{original_name}-renamed', "
        f"but got '{tabs[0].text}'"
    )

    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_readWorkspace_updateWorkspace_roundtrip(dash_duo):
    """
    Test save/load roundtrip using readWorkspace and updateWorkspace.

    Simulates the pattern used in usage.py for save/load functionality.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={"height": "90vh"},
            ),
            html.Button("Save", id="save-btn"),
            html.Button("Load", id="load-btn"),
            dcc.Store(id="saved-workspace", storage_type="memory"),
            html.Div(id="tab-count-display", children="waiting"),
        ]
    )

    @app.callback(
        Output("saved-workspace", "data"),
        Input("save-btn", "n_clicks"),
        State("prism", "readWorkspace"),
        prevent_initial_call=True,
    )
    def save_workspace(n_clicks, workspace):
        return workspace

    @app.callback(
        Output("prism", "updateWorkspace"),
        Input("load-btn", "n_clicks"),
        State("saved-workspace", "data"),
        prevent_initial_call=True,
    )
    def load_workspace(n_clicks, saved):
        return saved

    @app.callback(
        Output("tab-count-display", "children"),
        Input("prism", "readWorkspace"),
    )
    def display_tab_count(workspace):
        if workspace and "tabs" in workspace:
            return f"tabs:{len(workspace['tabs'])}"
        return "no-workspace"

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Wait for initial state sync
    dash_duo.wait_for_text_to_equal("#tab-count-display", "tabs:1", timeout=10)
    assert len(get_tabs(dash_duo)) == 1

    # Add 2 more tabs (total 3)
    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(dash_duo, 2)
    add_button.click()
    wait_for_tab_count(dash_duo, 3)

    # Wait for state to sync after adding tabs
    dash_duo.wait_for_text_to_equal("#tab-count-display", "tabs:3", timeout=10)

    # Save current state (3 tabs)
    save_btn = dash_duo.find_element("#save-btn")
    save_btn.click()
    # Verify save completed - readWorkspace should still show tabs:3
    dash_duo.wait_for_text_to_equal("#tab-count-display", "tabs:3", timeout=10)

    # Add another tab (total 4)
    add_button.click()
    wait_for_tab_count(dash_duo, 4, timeout=10)
    # Wait for debounced sync (500ms debounce + callback processing)
    # Longer timeout for parallel test execution resilience
    dash_duo.wait_for_text_to_equal("#tab-count-display", "tabs:4", timeout=20)

    # Load saved state (should restore to 3 tabs)
    load_btn = dash_duo.find_element("#load-btn")
    load_btn.click()

    # Should restore to 3 tabs
    wait_for_tab_count(dash_duo, 3, timeout=10)

    tabs = get_tabs(dash_duo)
    assert len(tabs) == 3, "Should have 3 tabs after load"

    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


@pytest.mark.skip(
    reason="Feature not implemented: auto-create tab when updateWorkspace provides empty tabs"
)
def test_updateWorkspace_handles_empty_tabs_gracefully(dash_duo):
    """
    Test that updateWorkspace handles empty tabs array without crashing.

    This is a regression test for a bug where setting tabs: [] via
    updateWorkspace caused "Cannot read properties of undefined (reading 'length')"
    because components accessed state.tabs without null checks.

    The component should gracefully handle empty tabs and auto-create a new tab.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="test",
        name="Test",
        layout=html.Div("Test content", id="test-content"),
    )

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=False,
                persistence_type="memory",
                style={"height": "90vh"},
            ),
            html.Button("Clear Tabs", id="clear-btn"),
        ]
    )

    @app.callback(
        Output("prism", "updateWorkspace"),
        Input("clear-btn", "n_clicks"),
        prevent_initial_call=True,
    )
    def clear_workspace(n_clicks):
        # Clear tabs and panelTabs - Prism should create a new initial tab
        return {
            "tabs": [],
            "panelTabs": {"panel-main": []},
            "panel": {
                "id": "panel-main",
                "order": 0,
                "direction": "horizontal",
                "children": [],
                "size": "100%",
            },
            "activeTabIds": {},
            "activePanelId": "panel-main",
        }

    dash_prism.init("prism", app)
    dash_duo.start_server(app)
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Add extra tabs first
    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(dash_duo, 2)
    add_button.click()
    wait_for_tab_count(dash_duo, 3)

    tabs = get_tabs(dash_duo)
    assert len(tabs) == 3, "Should have 3 tabs before clear"

    # Click clear button to trigger updateWorkspace with empty tabs
    clear_btn = dash_duo.find_element("#clear-btn")
    clear_btn.click()

    # Should reset to 1 tab (Prism auto-creates initial tab when tabs are empty)
    wait_for_tab_count(dash_duo, 1, timeout=10)

    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 tab after clear (auto-created)"

    # Critical: No browser errors should occur (this was the bug)
    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected (regression for empty tabs bug): {errors}"
