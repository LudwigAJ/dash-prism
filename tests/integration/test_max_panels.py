"""Integration tests for the maxPanels prop (doc 03 §3.1)."""

from __future__ import annotations

import pytest
from dash import Dash, html
import dash_prism

from conftest import (
    ADD_TAB_BUTTON,
    PRISM_ROOT,
    SPLIT_PANEL_BUTTON,
    check_browser_errors,
    get_free_port,
    wait_for_panel_count,
    wait_for_tab_count,
)

pytestmark = pytest.mark.integration


def _start(dash_duo, max_panels: int):
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                maxPanels=max_panels,
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh", "width": "100%"},
            )
        ],
        style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
    )
    dash_prism.init("prism", app)
    dash_duo.start_server(app, port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    # A second tab makes the panel splittable
    dash_duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(dash_duo, 2)
    return dash_duo


def test_max_panels_one_disables_splitting(dash_duo):
    duo = _start(dash_duo, 1)
    assert duo.find_elements(SPLIT_PANEL_BUTTON) == []
    assert check_browser_errors(duo) == []


def test_split_button_disappears_at_the_limit(dash_duo):
    duo = _start(dash_duo, 2)
    duo.wait_for_element(SPLIT_PANEL_BUTTON, timeout=5)
    duo.find_element(SPLIT_PANEL_BUTTON).click()
    wait_for_panel_count(duo, 2)

    # Both panels are at the limit now: no split button anywhere
    assert duo.find_elements(SPLIT_PANEL_BUTTON) == []
    assert check_browser_errors(duo) == []
