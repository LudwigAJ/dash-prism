"""Integration tests for workspace persistence.

Tests the persistence props, the storage that they select, and the
readWorkspace and updateWorkspace props.
"""

from __future__ import annotations

import json

import pytest
from dash import Dash, Input, Output, State, dcc, html
from dash.exceptions import PreventUpdate
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_prism_initializes_without_persistence(dash_duo):
    """Test that Prism works with persistence disabled."""
    duo = testutils.start_prism(dash_duo)

    assert len(testutils.get_tabs(duo)) == 1, "Should have 1 initial tab"


def test_prism_initializes_with_local_storage_persistence(dash_duo):
    """Test that Prism initializes with localStorage persistence enabled."""
    duo = testutils.start_prism(dash_duo, persistence=True, persistence_type="local")

    assert len(testutils.get_tabs(duo)) == 1, "Should have 1 initial tab"


def test_prism_initializes_with_session_storage_persistence(dash_duo):
    """Test that Prism initializes with sessionStorage persistence enabled."""
    duo = testutils.start_prism(dash_duo, persistence=True, persistence_type="session")

    assert len(testutils.get_tabs(duo)) == 1, "Should have 1 initial tab"


# =============================================================================
# The persistence flag gates the storage
# =============================================================================

STORAGE_KEY = testutils.storage_key("prism")


def test_persistence_false_writes_nothing_even_with_local_type(dash_duo):
    """persistence=False must win over persistence_type='local'."""
    duo = testutils.start_prism(dash_duo, persistence=False, persistence_type="local")
    duo.driver.execute_script("localStorage.clear(); sessionStorage.clear();")

    # A workspace change that would be written straight away if persistence were on
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    # Nothing may reach either storage.
    with pytest.raises(TimeoutException):
        WebDriverWait(duo.driver, 2.0).until(
            lambda driver: driver.execute_script(
                "return localStorage.getItem(arguments[0]) !== null"
                " || sessionStorage.getItem(arguments[0]) !== null;",
                STORAGE_KEY,
            )
        )


def _stored_tab_count(duo) -> int | None:
    """Number of tabs in the persisted workspace (current on-disk format), or None."""
    raw = duo.driver.execute_script("return localStorage.getItem(arguments[0]);", STORAGE_KEY)
    if raw is None:
        return None
    return len(json.loads(json.loads(raw)["present"])["tabs"])


def _wait_for_stored_tab_count(duo, expected: int, timeout: float = 5.0) -> None:
    WebDriverWait(duo.driver, timeout).until(
        lambda d: _stored_tab_count(duo) == expected,
        message=f"expected the persisted workspace to hold {expected} tab(s)",
    )


def test_persistence_true_with_local_type_writes_workspace(dash_duo):
    """The documented combination stores the workspace in localStorage."""
    duo = testutils.start_prism(dash_duo, persistence=True, persistence_type="local")

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    # The second tab reaches storage a couple of timer ticks after the reducer
    # ran, so wait for the count rather than reading it once.
    _wait_for_stored_tab_count(duo, 2)


def test_undo_is_persisted_across_reload(dash_duo):
    """An undo must reach storage on its own, not only after the next action."""
    duo = testutils.start_prism(dash_duo, persistence=True, persistence_type="local")
    _wait_for_stored_tab_count(duo, 1)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    _wait_for_stored_tab_count(duo, 2)

    duo.find_element("body").send_keys(testutils.get_modifier_key(), "u")
    testutils.wait_for_tab_count(duo, 1)
    _wait_for_stored_tab_count(duo, 1)

    duo.driver.refresh()
    duo.wait_for_element(testutils.PRISM_ROOT, timeout=10)
    testutils.wait_for_tab_count(duo, 1)


# =============================================================================
# readWorkspace / updateWorkspace Integration Tests
# =============================================================================


def test_read_workspace_reflects_tab_creation(dash_duo):
    """Test that readWorkspace prop reflects state after adding a tab.

    This verifies the Prism → Dash sync via readWorkspace.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    @app.callback(
        Output("workspace-output", "children"),
        Input("prism", "readWorkspace"),
    )
    def capture_workspace(workspace):
        if workspace and "tabs" in workspace:
            return f"tabs:{len(workspace['tabs'])}"
        return "no-workspace"

    duo = testutils.start_prism(
        dash_duo,
        app=app,
        children=[
            html.Div(id="workspace-output", children="waiting"),
        ],
        style={"height": "90vh"},
    )

    assert len(testutils.get_tabs(duo)) == 1, "Should start with 1 tab"
    duo.wait_for_text_to_equal("#workspace-output", "tabs:1", timeout=10)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    # The sync runs 500 ms after the last change.
    duo.wait_for_text_to_equal("#workspace-output", "tabs:2", timeout=10)


def test_update_workspace_modifies_state(dash_duo):
    """Test that updateWorkspace prop can modify workspace state.

    This verifies the Dash → Prism sync via updateWorkspace.
    We test by programmatically changing tab names via updateWorkspace,
    demonstrating that Dash can push state changes to the Prism component.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

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

        modified_tabs = []
        for tab in workspace["tabs"]:
            modified_tab = dict(tab)
            modified_tab["name"] = tab["name"] + "-renamed"
            modified_tabs.append(modified_tab)

        return {"tabs": modified_tabs}, "updated"

    duo = testutils.start_prism(
        dash_duo,
        app=app,
        children=[
            html.Button("Rename Tabs", id="rename-btn"),
            html.Div(id="update-status", children="not-updated"),
            dcc.Store(id="workspace-store"),
        ],
        style={"height": "90vh"},
    )

    # The first readWorkspace sync fills the store.
    WebDriverWait(duo.driver, 10).until(
        lambda d: d.execute_script(
            "return document.querySelector('#workspace-store')?.dataset?.dash_is_loading !== 'true'"
        ),
        message="Workspace store should be populated after initial sync",
    )

    tabs = testutils.get_tabs(duo)
    assert len(tabs) == 1, "Should have 1 tab initially"
    original_name = tabs[0].text

    duo.find_element("#rename-btn").click()
    duo.wait_for_text_to_equal("#update-status", "updated", timeout=5)

    expected_name = original_name + "-renamed"
    testutils.wait_for_tab_named(duo, expected_name, timeout=5)
    tabs = testutils.get_tabs(duo)
    assert len(tabs) == 1, "Should still have 1 tab"
    assert tabs[0].text == expected_name, (
        f"Tab should be renamed from '{original_name}' to '{expected_name}', "
        f"but got '{tabs[0].text}'"
    )


def test_read_workspace_update_workspace_roundtrip(dash_duo):
    """Test save/load roundtrip using readWorkspace and updateWorkspace.

    Simulates a pair of save and load callbacks.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

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

    duo = testutils.start_prism(
        dash_duo,
        app=app,
        children=[
            html.Button("Save", id="save-btn"),
            html.Button("Load", id="load-btn"),
            dcc.Store(id="saved-workspace", storage_type="memory"),
            html.Div(id="tab-count-display", children="waiting"),
        ],
        style={"height": "90vh"},
    )

    duo.wait_for_text_to_equal("#tab-count-display", "tabs:1", timeout=10)
    assert len(testutils.get_tabs(duo)) == 1

    add_button = duo.find_element(testutils.ADD_TAB_BUTTON)
    add_button.click()
    testutils.wait_for_tab_count(duo, 2)
    add_button.click()
    testutils.wait_for_tab_count(duo, 3)

    duo.wait_for_text_to_equal("#tab-count-display", "tabs:3", timeout=10)

    duo.find_element("#save-btn").click()
    duo.wait_for_text_to_equal("#tab-count-display", "tabs:3", timeout=10)

    add_button.click()
    testutils.wait_for_tab_count(duo, 4, timeout=10)
    # The sync runs 500 ms after the last change. Under parallel load the callback can take longer.
    duo.wait_for_text_to_equal("#tab-count-display", "tabs:4", timeout=20)

    duo.find_element("#load-btn").click()

    testutils.wait_for_tab_count(duo, 3, timeout=10)
