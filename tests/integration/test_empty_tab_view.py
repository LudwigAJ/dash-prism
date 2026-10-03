"""Integration tests for the emptyTabView prop (doc 03 §2)."""

from __future__ import annotations

import pytest
from dash import Dash, html

import dash_prism

from conftest import PRISM_ROOT, SEARCHBAR_INPUT, check_browser_errors, get_free_port

pytestmark = pytest.mark.integration

HINT = "[data-testid='prism-empty-tab-hint']"
BLANK = "[data-testid='prism-empty-tab-blank']"
LAYOUTS = "[data-testid='prism-empty-tab-layouts']"


def _app(empty_tab_view: str) -> Dash:
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                emptyTabView=empty_tab_view,
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh"},
            )
        ],
        style={"height": "100vh"},
    )
    dash_prism.init("prism", app)
    return app


def test_empty_tab_view_none_renders_blank_pane(dash_duo):
    dash_duo.start_server(_app("none"), port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    dash_duo.wait_for_element(BLANK, timeout=10)

    assert dash_duo.find_elements(HINT) == []
    # The layout grid is what 'none' replaces; asserting on the blank pane's own
    # text would pass whatever the grid does, since that div has no children.
    assert dash_duo.find_elements(LAYOUTS) == []
    # The search bar is still the way in
    dash_duo.wait_for_element(SEARCHBAR_INPUT, timeout=5)
    assert check_browser_errors(dash_duo) == []


def test_empty_tab_view_hint_renders_hint(dash_duo):
    dash_duo.start_server(_app("hint"), port=get_free_port())
    dash_duo.wait_for_element(HINT, timeout=10)

    assert "search bar" in dash_duo.find_element(HINT).text.lower()
    assert dash_duo.find_elements(BLANK) == []
    assert dash_duo.find_elements(LAYOUTS) == []
    assert check_browser_errors(dash_duo) == []


def test_empty_tab_view_layouts_keeps_the_layout_grid(dash_duo):
    dash_duo.start_server(_app("layouts"), port=get_free_port())
    # Assert on the grid itself: the layout name alone also appears in the
    # search dropdown, which opens on a fresh tab whatever emptyTabView says.
    dash_duo.wait_for_element(LAYOUTS, timeout=10)

    assert dash_duo.find_elements(HINT) == []
    assert dash_duo.find_elements(BLANK) == []
    assert "Home" in dash_duo.find_element(LAYOUTS).text
    assert check_browser_errors(dash_duo) == []
