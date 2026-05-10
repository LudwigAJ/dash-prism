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
    content = dash_prism.PrismContent(
        id="test-content",
        children=html.Div("Test content"),
    )

    assert content.id == "test-content"
    assert content.children is not None


def test_public_component_serialization_contract() -> None:
    """Public wrappers serialize to the React component names in the JS bundle."""
    prism = dash_prism.Prism(id="test-prism", style={})
    action = dash_prism.Action(id="test-action", label="Test Action")
    content = dash_prism.PrismContent(
        id={"type": "prism-content", "index": "tab-1"},
        children=html.Div("Test content"),
    )

    assert prism.to_plotly_json()["type"] == "Prism"
    assert prism.to_plotly_json()["namespace"] == "dash_prism"
    assert action.to_plotly_json()["type"] == "PrismAction"
    assert action.to_plotly_json()["namespace"] == "dash_prism"
    assert content.to_plotly_json()["type"] == "PrismContent"
    assert content.to_plotly_json()["namespace"] == "dash_prism"


def test_generated_component_classes_are_not_public_exports() -> None:
    """Generated classes remain outside the package-level public API."""
    assert "PrismComponent" not in dash_prism.__all__
    assert "PrismActionComponent" not in dash_prism.__all__
    assert "PrismContentComponent" not in dash_prism.__all__
    assert dash_prism.Prism.__module__ == "dash_prism.Prism"
    assert dash_prism.Action.__module__ == "dash_prism.Action"
    assert dash_prism.PrismContent.__module__ == "dash_prism.PrismContent"


def test_prism_in_app_layout(dash_app: Dash) -> None:
    """Test that Prism can be included in a Dash app layout."""
    dash_app.layout = html.Div([dash_prism.Prism(id="prism", style={})])

    assert dash_app.layout is not None
    assert len(dash_app.layout.children) == 1
