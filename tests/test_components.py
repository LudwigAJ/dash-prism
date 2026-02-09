"""
Tests for dash_prism component instantiation and rendering.
"""

from __future__ import annotations

import pytest
from dash import Dash, html
import dash_prism


def test_prism_component_instantiation() -> None:
    """Test that Prism component can be instantiated."""
    prism = dash_prism.Prism(id="test-prism", style={})

    assert prism.id == "test-prism"
    assert hasattr(prism, "_type")
    assert prism._type == "Prism"


def test_prism_component_with_props() -> None:
    """Test Prism component with various props."""
    prism = dash_prism.Prism(
        id="test-prism",
        theme="dark",
        size="lg",
        maxTabs=10,
        persistence=True,
        persistence_type="local",
        style={},
    )

    assert prism.theme == "dark"
    assert prism.size == "lg"
    assert prism.maxTabs == 10
    assert prism.persistence is True
    assert prism.persistence_type == "local"


def test_prism_action_component() -> None:
    """Test Action component instantiation."""
    action = dash_prism.Action(
        id="test-action",
        label="Test Action",
    )

    assert action.id == "test-action"
    assert action.label == "Test Action"


def test_prism_content_component() -> None:
    """Test PrismContent component instantiation."""
    # PrismContent is internal-only, import directly from the component module
    from dash_prism.PrismContentComponent import PrismContentComponent

    content = PrismContentComponent(
        id="test-content",
        children=html.Div("Test content"),
    )

    assert content.id == "test-content"
    assert content.children is not None


def test_prism_in_app_layout(dash_app: Dash) -> None:
    """Test that Prism can be included in a Dash app layout."""
    dash_app.layout = html.Div([dash_prism.Prism(id="prism", style={})])

    assert dash_app.layout is not None
    assert len(dash_app.layout.children) == 1
