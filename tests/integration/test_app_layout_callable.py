"""Integration tests for callable vs static app.layout.

Tests that dash_prism.init() properly handles both:
1. Static layouts (app.layout = html.Div(...)) - recommended approach
2. Callable layouts (app.layout = lambda: html.Div(...)) - supported for compatibility
"""

from __future__ import annotations

import pytest
from dash import Dash, html

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_static_layout_integration(dash_duo):
    """Test that Prism works correctly with static app.layout (recommended approach)."""
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(
        id="static-test",
        name="Static Test",
        description="Test layout for static app.layout",
        layout=html.Div(
            [
                html.H1("Static Layout Test"),
                html.P("This content comes from a static layout", id="static-test-content"),
            ]
        ),
    )
    app.layout = html.Div(
        [
            html.H1("Dash Prism Integration Test - Static Layout"),
            dash_prism.Prism(
                id="test-prism",
                theme="light",
                size="md",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh", "width": "100%"},
            ),
        ],
        style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
    )

    # init injects the metadata into a static layout once and leaves it a component tree.
    dash_prism.init("test-prism", app)
    assert not callable(app.layout), "Static layout should not be callable after init"

    duo = testutils.start_app(dash_duo, app)
    testutils.wait_for_tab_count(duo, 1)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)


def test_callable_layout_integration(dash_duo):
    """Test that Prism works correctly with callable app.layout (supported for compatibility)."""
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(
        id="callable-test",
        name="Callable Test",
        description="Test layout for callable app.layout",
        layout=html.Div(
            [
                html.H1("Callable Layout Test"),
                html.P("This content comes from a callable layout", id="callable-test-content"),
            ]
        ),
    )

    def layout():
        return html.Div(
            [
                html.H1("Dash Prism Integration Test - Callable Layout"),
                dash_prism.Prism(
                    id="test-prism-callable",
                    theme="light",
                    size="md",
                    persistence=False,
                    persistence_type="memory",
                    style={"height": "100vh", "width": "100%"},
                ),
            ],
            style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
        )

    app.layout = layout

    # init wraps a callable layout, so the metadata goes into each render.
    dash_prism.init("test-prism-callable", app)
    assert callable(app.layout), "app.layout should still be callable after init"
    assert hasattr(app.layout, "__wrapped__"), "app.layout should be marked as wrapped"

    duo = testutils.start_app(dash_duo, app)
    testutils.wait_for_tab_count(duo, 1)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
