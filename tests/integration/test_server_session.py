"""Integration tests for ``serverSessionId`` reconciliation.

A persisted workspace that references a layout the server no longer registers
must lose that tab on the next load instead of rendering a "Layout not found"
error; the other tabs are kept.
"""

from __future__ import annotations

import json
import time

import pytest
from selenium.webdriver.support.wait import WebDriverWait

from dash_prism.app_init import _compute_server_session_id
from tests.integration import testutils

pytestmark = pytest.mark.integration

STORAGE_KEY = testutils.storage_key("prism")


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


def _read_stored(duo) -> str | None:
    return duo.driver.execute_script("return localStorage.getItem(arguments[0]);", STORAGE_KEY)


def _stored_session_id(duo) -> str | None:
    """The persisted serverSessionId, in either on-disk format.

    redux-persist JSON-encodes each top-level key on its own. The current format
    persists the undo history's ``present`` slice, so the workspace sits one
    level down; the 0.9.x format this test seeds was flat.
    """
    raw = _read_stored(duo)
    if raw is None:
        return None
    outer = json.loads(raw)
    if "present" in outer:
        return json.loads(outer["present"]).get("serverSessionId")
    value = outer.get("serverSessionId")
    return None if value is None else json.loads(value)


def _wait_for_initial_write(duo, timeout: float = 15.0, stable_for: float = 0.6) -> None:
    """Wait until redux-persist has stopped writing the freshly loaded workspace.

    Rehydration, the reconcile that records the session id and the first Dash
    sync each land in their own write a few ticks apart, so a seed dropped after
    the first one can still be overwritten. Wait for the value to hold steady.
    """
    previous, steady_since = None, time.monotonic()

    def stored_value_is_steady(driver) -> bool:
        nonlocal previous, steady_since
        current = _read_stored(duo)
        if current is None or current != previous:
            previous, steady_since = current, time.monotonic()
            return False
        return time.monotonic() - steady_since >= stable_for

    WebDriverWait(duo.driver, timeout, poll_frequency=0.1).until(
        stored_value_is_steady, message="redux-persist kept rewriting the workspace"
    )


def test_tabs_for_removed_layouts_are_closed_on_load(dash_duo):
    duo = testutils.start_prism(dash_duo, persistence=True, persistence_type="local")
    _wait_for_initial_write(duo)

    # Simulate a workspace saved by a previous deployment that still had layout 'gone'.
    duo.driver.execute_script(
        "localStorage.setItem(arguments[0], arguments[1]);",
        STORAGE_KEY,
        _persisted_workspace("stale"),
    )
    assert _stored_session_id(duo) == "stale", "the seed was overwritten before reload"
    duo.driver.refresh()
    duo.wait_for_element(testutils.PRISM_ROOT, timeout=10)

    # The user is told what happened (the toast is raised after mount, not from
    # the reducer during rehydration where nothing is listening yet).
    # sonner mounts the toast element before it fills in the text, so wait for
    # the text rather than reading it once.
    duo.wait_for_contains_text(testutils.TOAST, "Closed 1 tab", timeout=10)

    testutils.wait_for_tab_count(duo, 1, timeout=10)
    tabs = duo.find_elements(testutils.TAB_SELECTOR)
    assert [t.text for t in tabs] == ["Home"]
    duo.wait_for_element("[id*='home-content']", timeout=10)
    assert "not found" not in duo.find_element(testutils.PRISM_ROOT).text.lower()

    # The registry change is recorded: the stored fingerprint is now the one
    # derived from the current registry, not the seeded one.
    expected = _compute_server_session_id(["home"])
    WebDriverWait(duo.driver, 10).until(
        lambda _: _stored_session_id(duo) == expected,
        message="expected the derived serverSessionId to be persisted",
    )
