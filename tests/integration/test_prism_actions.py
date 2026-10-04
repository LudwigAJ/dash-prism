"""Integration tests for Action components.

Tests action rendering in status bar and n_clicks callback pattern.
"""

from __future__ import annotations

import pytest
from dash import Dash, Input, Output, html

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_prism_action_renders_in_statusbar(dash_duo):
    """Test that Action components render in status bar."""
    action1 = dash_prism.Action(id="action1", label="Action 1")
    action2 = dash_prism.Action(id="action2", label="Action 2")
    duo = testutils.start_prism(dash_duo, actions=[action1, action2])

    action1_button = duo.wait_for_element("[data-testid='prism-action-action1']", timeout=5)
    duo.wait_for_element("[data-testid='prism-action-action2']", timeout=5)
    assert "Action 1" in action1_button.text, "Action 1 should have correct label"


def test_prism_action_click_triggers_callback(dash_duo):
    """Test that clicking Action triggers Dash callback."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    action = dash_prism.Action(id="test-action", label="Test Action")

    @app.callback(Output("output", "children"), Input("test-action", "n_clicks"))
    def handle_action_click(n_clicks):
        if n_clicks is None:
            return "Not clicked"
        return f"Clicked {n_clicks} times"

    duo = testutils.start_prism(
        dash_duo,
        app=app,
        children=[html.Div(id="output", children="Not clicked")],
        actions=[action],
    )

    assert duo.find_element("#output").text == "Not clicked"

    action_button = duo.wait_for_element("[data-testid='prism-action-test-action']", timeout=5)
    action_button.click()
    duo.wait_for_text_to_equal("#output", "Clicked 1 times", timeout=5)

    action_button.click()
    duo.wait_for_text_to_equal("#output", "Clicked 2 times", timeout=5)


def test_prism_action_renders_text_label(dash_duo):
    """Test Action renders its text label correctly."""
    action = dash_prism.Action(id="label-action", label="Label Action")
    duo = testutils.start_prism(dash_duo, actions=[action])

    action_button = duo.wait_for_element("[data-testid='prism-action-label-action']", timeout=5)
    assert "Label Action" in action_button.text, "Action should have correct label"
