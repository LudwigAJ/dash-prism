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
from dash import Dash, Input, Output, State, dcc, html
from dash.exceptions import PreventUpdate
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism

from conftest import (
    ADD_TAB_BUTTON,
    PRISM_ROOT,
    TAB_SELECTOR,
    check_browser_errors,
    get_free_port,
    get_tabs,
    wait_for_tab_count,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


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
    except WebDriverException:
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
    dash_duo.start_server(app, port=get_free_port())
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
    dash_duo.start_server(app, port=get_free_port())
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
    dash_duo.start_server(app, port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Should have 1 initial tab
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 initial tab"


# =============================================================================
# persistence flag gates storage (02 B-1)
# =============================================================================

STORAGE_KEY = "persist:prism-workspace-prism"


def _persistence_app(*, persistence: bool, persistence_type: str) -> Dash:
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test content"))
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=persistence,
                persistence_type=persistence_type,
                style={"height": "90vh"},
            )
        ]
    )
    dash_prism.init("prism", app)
    return app


def test_persistence_false_writes_nothing_even_with_local_type(dash_duo):
    """persistence=False must win over persistence_type='local' (02 B-1)."""
    dash_duo.start_server(
        _persistence_app(persistence=False, persistence_type="local"), port=get_free_port()
    )
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    dash_duo.driver.execute_script("localStorage.clear(); sessionStorage.clear();")

    # A workspace change that would be written straight away if persistence were on
    dash_duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(dash_duo, 2)

    assert wait_for_storage(dash_duo, STORAGE_KEY, "local", timeout=2.0) is None
    assert wait_for_storage(dash_duo, STORAGE_KEY, "session", timeout=0.5) is None
    assert check_browser_errors(dash_duo) == []


def _stored_tab_count(dash_duo) -> int | None:
    """Number of tabs in the persisted workspace (current on-disk format), or None."""
    import json

    raw = dash_duo.driver.execute_script("return localStorage.getItem(arguments[0]);", STORAGE_KEY)
    if raw is None:
        return None
    return len(json.loads(json.loads(raw)["present"])["tabs"])


def _wait_for_stored_tab_count(dash_duo, expected: int, timeout: float = 5.0) -> None:
    WebDriverWait(dash_duo.driver, timeout).until(
        lambda d: _stored_tab_count(dash_duo) == expected,
        message=f"expected the persisted workspace to hold {expected} tab(s)",
    )


def test_persistence_true_with_local_type_writes_workspace(dash_duo):
    """The documented combination stores the workspace in localStorage."""
    dash_duo.start_server(
        _persistence_app(persistence=True, persistence_type="local"), port=get_free_port()
    )
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    dash_duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(dash_duo, 2)

    # The second tab reaches storage a couple of timer ticks after the reducer
    # ran, so wait for the count rather than reading it once.
    _wait_for_stored_tab_count(dash_duo, 2)
    assert check_browser_errors(dash_duo) == []


def test_undo_is_persisted_across_reload(dash_duo):
    """An undo must reach storage on its own, not only after the next action."""
    from conftest import get_modifier_key

    dash_duo.start_server(
        _persistence_app(persistence=True, persistence_type="local"), port=get_free_port()
    )
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    _wait_for_stored_tab_count(dash_duo, 1)

    dash_duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(dash_duo, 2)
    _wait_for_stored_tab_count(dash_duo, 2)

    # Undo the tab creation with the keyboard shortcut
    dash_duo.find_element("body").send_keys(get_modifier_key(), "u")
    wait_for_tab_count(dash_duo, 1)
    _wait_for_stored_tab_count(dash_duo, 1)

    dash_duo.driver.refresh()
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    wait_for_tab_count(dash_duo, 1)
    assert check_browser_errors(dash_duo) == []


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
    dash_duo.start_server(app, port=get_free_port())
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
    dash_duo.start_server(app, port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)

    # Wait for initial readWorkspace sync by observing the store callback output
    WebDriverWait(dash_duo.driver, 10).until(
        lambda d: d.execute_script(
            "return document.querySelector('#workspace-store')?.dataset?.dash_is_loading !== 'true'"
        ),
        message="Workspace store should be populated after initial sync",
    )

    # Get original tab name
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should have 1 tab initially"
    original_name = tabs[0].text

    # Click rename button to trigger updateWorkspace
    rename_btn = dash_duo.find_element("#rename-btn")
    rename_btn.click()

    # Wait for updateWorkspace to take effect
    dash_duo.wait_for_text_to_equal("#update-status", "updated", timeout=5)

    # Wait for the tab text to update after React re-render
    from selenium.webdriver.common.by import By

    expected_name = original_name + "-renamed"
    WebDriverWait(dash_duo.driver, 5).until(
        lambda d: any(
            expected_name in t.text for t in d.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        ),
        message=f"Tab should be renamed to '{expected_name}'",
    )

    # Verify tab was renamed
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 1, "Should still have 1 tab"
    assert tabs[0].text == expected_name, (
        f"Tab should be renamed from '{original_name}' to '{expected_name}', "
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
    dash_duo.start_server(app, port=get_free_port())
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
