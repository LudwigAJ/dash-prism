"""Tests for dash_prism utility functions."""

from __future__ import annotations

import logging

import pytest
from dash import dcc, html

import dash_prism
from dash_prism import utils


def test_walk_layout_simple() -> None:
    """Test walking a simple layout."""
    layout = html.Div(
        [
            html.H1("Title"),
            html.P("Paragraph"),
        ]
    )

    component_count = 0

    def counter(component):
        nonlocal component_count
        if hasattr(component, "_type"):
            component_count += 1
        return component

    dash_prism.walk_layout(layout, counter)
    assert component_count == 3  # Div, H1, P


def test_inject_tab_id() -> None:
    """Test ID injection for tab isolation."""
    layout = html.Div(
        [
            dcc.Input(id="my-input"),
            html.Div(id="my-output"),
        ]
    )

    injected = dash_prism.inject_tab_id(layout, "tab-123")

    # Check that IDs were transformed
    input_comp = injected.children[0]
    assert isinstance(input_comp.id, dict)
    assert input_comp.id["type"] == "my-input"
    assert input_comp.id["index"] == "tab-123"


def test_inject_tab_id_preserves_dict_ids() -> None:
    """Test that existing dict IDs are preserved."""
    layout = html.Div(
        [
            html.Span(id={"type": "existing", "index": "other"}),
        ]
    )

    injected = dash_prism.inject_tab_id(layout, "tab-123")

    # Dict ID should be unchanged
    span = injected.children[0]
    assert span.id == {"type": "existing", "index": "other"}


def test_validate_workspace_valid() -> None:
    """Test workspace validation with valid workspace."""
    workspace = {
        "tabs": [{"id": "tab1", "name": "Tab 1", "panelId": "panel1", "createdAt": 123}],
        "panel": {
            "id": "panel1",
            "order": 0,
            "direction": "horizontal",
            "children": [],
        },
        "panelTabs": {"panel1": ["tab1"]},
        "activeTabIds": {"panel1": "tab1"},
        "activePanelId": "panel1",
    }

    # Should not raise
    result = dash_prism.validate_workspace(workspace)
    assert result == workspace


def test_validate_workspace_missing_key() -> None:
    """Test workspace validation with missing required key."""
    workspace = {
        "tabs": [],
        # Missing 'panel', 'panelTabs', etc.
    }

    with pytest.raises(dash_prism.InvalidWorkspaceError) as exc_info:
        dash_prism.validate_workspace(workspace)

    assert "Missing required key" in str(exc_info.value)


def test_validate_workspace_rejects_a_value_that_is_not_a_dict(caplog) -> None:
    with pytest.raises(dash_prism.InvalidWorkspaceError, match="Workspace must be a dict, got str"):
        dash_prism.validate_workspace("nope")

    caplog.set_level(logging.ERROR, logger="dash_prism")
    assert dash_prism.validate_workspace("nope", errors="ignore") == "nope"
    assert "Workspace must be a dict, got str" in caplog.text


def test_validate_workspace_ignore_errors() -> None:
    """Test workspace validation with errors='ignore'."""
    workspace = {"tabs": []}  # Invalid, missing keys

    # Should not raise, just log
    result = dash_prism.validate_workspace(workspace, errors="ignore")
    assert result == workspace


def test_find_component_by_id() -> None:
    """Test finding a component by ID."""
    layout = html.Div(
        [
            html.H1("Title", id="title"),
            html.Div(
                [
                    html.P("Paragraph", id="para"),
                ]
            ),
        ]
    )

    found = dash_prism.find_component_by_id(layout, "para")
    assert found is not None
    assert found.id == "para"

    not_found = dash_prism.find_component_by_id(layout, "nonexistent")
    assert not_found is None


def test_find_component_by_id_returns_the_first_match() -> None:
    outer = html.Div([html.P("inner", id="same")], id="same")

    assert dash_prism.find_component_by_id(html.Div([outer]), "same") is outer


def test_the_old_exception_name_is_an_alias() -> None:
    assert dash_prism.InvalidWorkspace is dash_prism.InvalidWorkspaceError
    with pytest.raises(dash_prism.InvalidWorkspace):
        dash_prism.validate_workspace({})


def test_the_utils_module_still_gives_the_moved_names() -> None:
    for name in utils.__all__:
        assert getattr(utils, name) is getattr(dash_prism, name)


def test_update_component_props() -> None:
    """Test updating component props."""
    layout = html.Div(
        [
            dcc.Input(id="my-input", value="old"),
        ]
    )

    updated = dash_prism.update_component_props(
        layout,
        "my-input",
        value="new",
        placeholder="Enter text",
    )

    # Original should be unchanged (deep copy)
    assert layout.children[0].value == "old"

    # Updated should have new values
    assert updated.children[0].value == "new"
    assert updated.children[0].placeholder == "Enter text"
