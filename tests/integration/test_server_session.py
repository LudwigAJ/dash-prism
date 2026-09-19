"""
Integration tests for ``serverSessionId`` reconciliation (01 §1.3 / 02 B-2).

A persisted workspace that references a layout the server no longer registers
must lose that tab on the next load instead of rendering a "Layout not found"
error; the other tabs are kept.
"""

from __future__ import annotations

import json

import pytest
from dash import Dash, html
from selenium.webdriver.support.wait import WebDriverWait
import dash_prism
from dash_prism.init import _compute_server_session_id

from conftest import (
    PRISM_ROOT,
    TAB_SELECTOR,
    check_browser_errors,
    get_free_port,
    wait_for_tab_count,
)

pytestmark = pytest.mark.integration

STORAGE_KEY = "persist:prism-workspace-prism"
TOAST_SELECTOR = "[data-sonner-toast]"


def _persisted_workspace(server_session_id: str) -> str:
    """A saved workspace in redux-persist's on-disk format (each key JSON-encoded)."""
    state = {
        "tabs": [
            {
                "id": "t-home",
                "name": "Home",
                "panelId": "p1",
                "layoutId": "home",
                "createdAt": 1,
                "mountKey": "m1",
            },
            {
                "id": "t-gone",
                "name": "Gone",
                "panelId": "p1",
                "layoutId": "gone",
                "createdAt": 2,
                "mountKey": "m2",
                "locked": True,
            },
        ],
        "panel": {
            "id": "p1",
            "order": 0,
            "direction": "horizontal",
            "children": [],
            "size": "100%",
        },
        "panelTabs": {"p1": ["t-home", "t-gone"]},
        "activeTabIds": {"p1": "t-gone"},
        "activePanelId": "p1",
        "favoriteLayouts": [],
        "searchBarsHidden": False,
        "serverSessionId": server_session_id,
        "_persist": {"version": 1, "rehydrated": True},
    }
    return json.dumps({key: json.dumps(value) for key, value in state.items()})


def _start_app(dash_duo):
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home", id="home-content"))
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                persistence=True,
                persistence_type="local",
                style={"height": "100vh", "width": "100%"},
            )
        ],
        style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
    )
    dash_prism.init("prism", app)
    dash_duo.start_server(app, port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    return dash_duo


def _wait_for_initial_write(duo, timeout: float = 10.0) -> None:
    """redux-persist writes the freshly loaded workspace a few ticks after rehydration.

    Seeding storage before that write lands would just get overwritten.
    """
    WebDriverWait(duo.driver, timeout).until(
        lambda d: d.execute_script("return localStorage.getItem(arguments[0]);", STORAGE_KEY)
        is not None,
        message="expected redux-persist to write the initial workspace",
    )


def test_tabs_for_removed_layouts_are_closed_on_load(dash_duo):
    duo = _start_app(dash_duo)
    _wait_for_initial_write(duo)

    # Simulate a workspace saved by a previous deployment that still had layout 'gone'.
    duo.driver.execute_script(
        "localStorage.setItem(arguments[0], arguments[1]);",
        STORAGE_KEY,
        _persisted_workspace("stale"),
    )
    duo.driver.refresh()
    duo.wait_for_element(PRISM_ROOT, timeout=10)

    # The user is told what happened (the toast is raised after mount, not from
    # the reducer during rehydration where nothing is listening yet).
    toast = duo.wait_for_element(TOAST_SELECTOR, timeout=10)
    assert "closed 1 tab" in toast.text.lower()

    wait_for_tab_count(duo, 1, timeout=10)
    tabs = duo.find_elements(TAB_SELECTOR)
    assert [t.text for t in tabs] == ["Home"]
    duo.wait_for_element("[id*='home-content']", timeout=10)
    assert "not found" not in duo.find_element(PRISM_ROOT).text.lower()

    # The registry change is recorded: the stored fingerprint is now the one
    # derived from the current registry, not the seeded one.
    expected = _compute_server_session_id(["home"])
    WebDriverWait(duo.driver, 10).until(
        lambda d: expected
        in (d.execute_script("return localStorage.getItem(arguments[0]);", STORAGE_KEY) or ""),
        message="expected the derived serverSessionId to be persisted",
    )
    stored = duo.driver.execute_script("return localStorage.getItem(arguments[0]);", STORAGE_KEY)
    assert '"stale"' not in stored
    assert check_browser_errors(duo) == []
