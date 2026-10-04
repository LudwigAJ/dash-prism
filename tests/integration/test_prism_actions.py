"""
Integration tests for Action components.

Tests action rendering in status bar and n_clicks callback pattern.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from dash import Dash, Input, Output, html

import dash_prism
from tests.integration import testutils

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def test_prism_action_renders_in_statusbar(dash_duo):
    """Test that Action components render in status bar."""
    action1 = dash_prism.Action(id="action1", label="Action 1")
    action2 = dash_prism.Action(id="action2", label="Action 2")
    testutils.start_prism(dash_duo, actions=[action1, action2])

    # Wait for actions to render (they're rendered asynchronously)
    dash_duo.wait_for_element("[data-testid='prism-action-action1']", timeout=5)
    dash_duo.wait_for_element("[data-testid='prism-action-action2']", timeout=5)

    # Verify actions render
    action1_button = dash_duo.find_element("[data-testid='prism-action-action1']")
    action2_button = dash_duo.find_element("[data-testid='prism-action-action2']")

    assert action1_button is not None, "Action 1 should render"
    assert action2_button is not None, "Action 2 should render"
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

    testutils.start_prism(
        dash_duo,
        app=app,
        children=[html.Div(id="output", children="Not clicked")],
        actions=[action],
    )

    # Verify initial state
    output = dash_duo.find_element("#output")
    assert output.text == "Not clicked", "Initial state should be 'Not clicked'"

    # Wait for and click action (use wait_for_element for async rendering)
    dash_duo.wait_for_element("[data-testid='prism-action-test-action']", timeout=5)
    action_button = dash_duo.find_element("[data-testid='prism-action-test-action']")
    action_button.click()

    # Wait for callback to update output (explicit wait)
    dash_duo.wait_for_text_to_equal("#output", "Clicked 1 times", timeout=5)

    # Click again
    action_button.click()
    dash_duo.wait_for_text_to_equal("#output", "Clicked 2 times", timeout=5)


def test_prism_action_renders_text_label(dash_duo):
    """Test Action renders its text label correctly."""
    action = dash_prism.Action(id="label-action", label="Label Action")
    testutils.start_prism(dash_duo, actions=[action])

    # Wait for and verify action renders the label
    dash_duo.wait_for_element("[data-testid='prism-action-label-action']", timeout=5)
    action_button = dash_duo.find_element("[data-testid='prism-action-label-action']")
    assert action_button is not None, "Action should render"
    assert "Label Action" in action_button.text, "Action should have correct label"

    # Check no browser errors
    errors = testutils.check_browser_errors(dash_duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"
