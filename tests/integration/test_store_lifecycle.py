"""Integration tests for prop changes after mount (02 A-8).

The Redux store is created once per mount; ``maxTabs`` is read through a ref
getter so a callback can change it without rebuilding the store (which used to
drop the undo history and, with memory persistence, the whole workspace).
"""

from __future__ import annotations

import time

import pytest
from dash import Dash, Input, Output, ctx, html

from tests.integration import testutils

pytestmark = pytest.mark.integration

UNDO_BUTTON = "[data-testid='prism-statusbar-undo']"
TAB_COUNT = "[data-testid='prism-statusbar-count']"


def _start(dash_duo):
    app = Dash(__name__, suppress_callback_exceptions=True)

    @app.callback(
        Output("prism", "maxTabs"),
        Input("limit-4", "n_clicks"),
        Input("limit-1", "n_clicks"),
        prevent_initial_call=True,
    )
    def set_limit(_n4, _n1):
        return 4 if ctx.triggered_id == "limit-4" else 1

    return testutils.start_prism(
        dash_duo,
        app=app,
        children=[html.Button("Limit 4", id="limit-4"), html.Button("Limit 1", id="limit-1")],
        maxTabs=2,
        style={"height": "90vh", "width": "100%"},
    )


def _undo_enabled(duo) -> bool:
    return duo.find_element(UNDO_BUTTON).get_attribute("disabled") is None


def test_changing_max_tabs_keeps_workspace_and_undo_history(dash_duo):
    duo = _start(dash_duo)

    # Reach the initial limit of 2; the add is undoable.
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    duo.wait_for_contains_text(TAB_COUNT, "2/2", timeout=5)
    assert _undo_enabled(duo)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    time.sleep(0.5)
    assert len(testutils.get_tabs(duo)) == 2, "adding beyond maxTabs must be blocked"

    # Raise the limit from a callback: same tabs, undo history intact.
    duo.find_element("#limit-4").click()
    duo.wait_for_contains_text(TAB_COUNT, "2/4", timeout=5)
    assert len(testutils.get_tabs(duo)) == 2
    assert _undo_enabled(duo)

    # The new limit applies immediately to the next tab action.
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 3)

    # Lower it below the current count: nothing is closed, adds are blocked.
    duo.find_element("#limit-1").click()
    duo.wait_for_contains_text(TAB_COUNT, "3/1", timeout=5)
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    time.sleep(0.5)
    assert len(testutils.get_tabs(duo)) == 3

    # Undo still walks the history recorded before the prop changes.
    duo.find_element(UNDO_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    duo.find_element(UNDO_BUTTON).click()
    testutils.wait_for_tab_count(duo, 1)
