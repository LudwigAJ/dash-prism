"""Integration tests for the showStatusBar prop (doc 03 §3.1)."""

from __future__ import annotations

import warnings

import pytest
from dash import Dash, html
import dash_prism

from conftest import (
    ADD_TAB_BUTTON,
    PRISM_ROOT,
    check_browser_errors,
    get_free_port,
    wait_for_tab_count,
)

pytestmark = pytest.mark.integration

HELP_BUTTON = "[data-testid='prism-statusbar-help']"
UNDO_BUTTON = "[data-testid='prism-statusbar-undo']"
ACTION_BUTTON = "[data-testid='prism-action-save']"


def _app(show_status_bar: bool) -> Dash:
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    # Passing actions with showStatusBar=False warns on purpose (covered by the
    # unit tests); here we only care that the buttons are not rendered.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        prism = dash_prism.Prism(
            id="prism",
            showStatusBar=show_status_bar,
            actions=[dash_prism.Action(id="save", label="Save")],
            persistence=False,
            persistence_type="memory",
            style={"height": "100vh"},
        )
    app.layout = html.Div([prism], style={"height": "100vh"})
    dash_prism.init("prism", app)
    return app


def test_status_bar_hidden(dash_duo):
    dash_duo.start_server(_app(False), port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    dash_duo.wait_for_element(ADD_TAB_BUTTON, timeout=10)

    assert dash_duo.find_elements(HELP_BUTTON) == []
    assert dash_duo.find_elements(UNDO_BUTTON) == []
    assert dash_duo.find_elements(ACTION_BUTTON) == []

    # The workspace itself keeps working
    dash_duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(dash_duo, 2)
    assert check_browser_errors(dash_duo) == []


def test_status_bar_shown_by_default(dash_duo):
    dash_duo.start_server(_app(True), port=get_free_port())
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)
    assert check_browser_errors(dash_duo) == []
