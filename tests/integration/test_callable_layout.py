"""
Integration tests for callable vs static app.layout.

Tests that dash_prism.init() properly handles both:
1. Static layouts (app.layout = html.Div(...)) - recommended approach
2. Callable layouts (app.layout = lambda: html.Div(...)) - supported for compatibility

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from dash import Dash, html
import dash_prism

# Import helpers from conftest
from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    wait_for_tab_count,
    get_tabs,
    check_browser_errors,
    get_free_port,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def test_static_layout_integration(dash_duo):
    """Test that Prism works correctly with static app.layout (recommended approach)."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    # Register test layouts
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

    # Define static layout (recommended approach)
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

    # Initialize Prism (this injects metadata once for static layouts)
    dash_prism.init("test-prism", app)

    # Verify app.layout is not callable
    assert not callable(app.layout), "Static layout should not be callable after init"

    # Start the app
    port = get_free_port()
    dash_duo.start_server(app, port=port)

    # Wait for initial tab to appear (Prism always starts with a "New Layout" tab)
    wait_for_tab_count(dash_duo, 1)

    # Verify initial tab exists
    initial_tabs = get_tabs(dash_duo)
    assert len(initial_tabs) == 1, "Should start with 1 initial tab"

    # Create a second tab by clicking add button to verify functionality
    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(dash_duo, 2)

    # Verify we now have 2 tabs
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 2, "Should have 2 tabs after clicking add"

    # Check for browser console errors
    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"


def test_callable_layout_integration(dash_duo):
    """Test that Prism works correctly with callable app.layout (supported for compatibility)."""
    app = Dash(__name__, suppress_callback_exceptions=True)

    # Register test layouts
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

    # Define callable layout (function that returns layout)
    # This is supported but static layouts are recommended for better performance
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

    # Initialize Prism (this wraps the callable to inject metadata on every render)
    dash_prism.init("test-prism-callable", app)

    # Verify the layout function was wrapped
    assert callable(app.layout), "app.layout should still be callable after init"
    assert hasattr(app.layout, "__wrapped__"), "app.layout should be marked as wrapped"

    # Start the app
    port = get_free_port()
    dash_duo.start_server(app, port=port)

    # Wait for initial tab to appear
    wait_for_tab_count(dash_duo, 1)

    # Verify initial tab exists
    initial_tabs = get_tabs(dash_duo)
    assert len(initial_tabs) == 1, "Should start with 1 initial tab"

    # Create a second tab by clicking add button to verify functionality
    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(dash_duo, 2)

    # Verify we now have 2 tabs
    tabs = get_tabs(dash_duo)
    assert len(tabs) == 2, "Should have 2 tabs after clicking add"

    # Check for browser console errors
    errors = check_browser_errors(dash_duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"
