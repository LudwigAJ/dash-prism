"""
Pytest configuration and fixtures for dash_prism tests.
"""

from __future__ import annotations

import pytest
from dash import Dash, html
import dash_prism


@pytest.fixture
def dash_app() -> Dash:
    """
    Create a minimal Dash app for testing.

    Returns
    -------
    Dash
        A Dash application instance.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)
    return app


@pytest.fixture
def prism_app() -> Dash:
    """
    Create a Dash app with a Prism component.

    Returns
    -------
    Dash
        A Dash application with Prism component in layout.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="test-prism",
                theme="light",
                size="md",
                style={},
            )
        ]
    )

    return app


@pytest.fixture(autouse=True)
def clear_registry():
    """
    Clear the layout registry before and after each test.

    Ensures tests don't interfere with each other.
    """
    dash_prism.clear_registry()
    yield
    dash_prism.clear_registry()


@pytest.fixture
def sample_layout():
    """
    Create a simple layout for testing.

    Returns
    -------
    dash component
        A simple Dash component tree.
    """
    return html.Div(
        [
            html.H1("Test Layout"),
            html.P("This is a test layout", id="test-paragraph"),
        ]
    )
