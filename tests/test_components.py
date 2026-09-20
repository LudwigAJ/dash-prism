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


def test_prism_warns_when_persistence_true_but_type_is_memory() -> None:
    """persistence=True with the default persistence_type='memory' persists nothing."""
    with pytest.warns(UserWarning, match="persistence_type is 'memory'"):
        dash_prism.Prism(id="p", persistence=True, style={})
    with pytest.warns(UserWarning, match="persistence_type is 'memory'"):
        dash_prism.Prism(id="p", persistence=True, persistence_type="memory", style={})


def test_prism_does_not_warn_for_effective_persistence_combinations() -> None:
    """Only the no-op combination warns."""
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("error")
        dash_prism.Prism(id="p", persistence=True, persistence_type="local", style={})
        dash_prism.Prism(id="p", persistence=True, persistence_type="session", style={})
        dash_prism.Prism(id="p", persistence=False, persistence_type="local", style={})
        dash_prism.Prism(id="p", persistence_type="local", style={})
        dash_prism.Prism(id="p", style={})


def test_prop_docstrings_match_behaviour() -> None:
    """Both docstring sources must describe the real behaviour (02 B-4).

    ``PrismComponent`` is generated from the TypeScript JSDoc; ``Prism`` carries
    the hand-written docstring that Sphinx publishes (``docs/api.rst`` autoclass)
    and ``help()`` shows. B-4 was exactly these two drifting apart, so both are
    checked here.
    """
    from dash_prism.PrismComponent import PrismComponent

    claims = (
        "counting every panel together",  # maxTabs is global, not per panel
        "500 ms",  # readWorkspace sync cadence
        "ping-pongs with Prism",  # what an echoing callback really does
    )
    # The generator wraps lines, so compare whitespace-normalised text.
    for cls in (dash_prism.Prism, PrismComponent):
        doc = " ".join((cls.__doc__ or "").split())
        assert "allowed per panel" not in doc, cls.__name__
        for claim in claims:
            assert claim in doc, f"{cls.__name__} docstring is missing {claim!r}"

    generated = " ".join((PrismComponent.__doc__ or "").split())
    assert "Prism -> Dash" in generated
    assert "Dash -> Prism" in generated


def test_prism_component_empty_tab_view_prop() -> None:
    """emptyTabView is a first-class prop on the wrapper and the generated class."""
    prism = dash_prism.Prism(id="test-prism", emptyTabView="none", style={})

    assert prism.emptyTabView == "none"
    assert "emptyTabView" in prism.available_properties
    assert prism.to_plotly_json()["props"]["emptyTabView"] == "none"


def test_prism_component_empty_tab_view_default_unset() -> None:
    """Unset props are not serialized, so the TS default ('layouts') applies."""
    prism = dash_prism.Prism(id="test-prism", style={})

    assert "emptyTabView" not in prism.to_plotly_json()["props"]


def test_prism_warns_on_quiet_empty_tab_combination() -> None:
    with pytest.warns(UserWarning, match="emptyTabView='none'"):
        dash_prism.Prism(id="p", emptyTabView="none", newTabOpensDropdown=False, style={})


def test_prism_does_not_warn_for_other_empty_tab_combinations() -> None:
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        dash_prism.Prism(id="p", emptyTabView="none", style={})
        dash_prism.Prism(id="p", emptyTabView="none", newTabOpensDropdown=True, style={})
        dash_prism.Prism(id="p", emptyTabView="hint", newTabOpensDropdown=False, style={})
        dash_prism.Prism(id="p", emptyTabView="layouts", newTabOpensDropdown=False, style={})


def test_prism_component_show_status_bar_prop() -> None:
    prism = dash_prism.Prism(id="test-prism", showStatusBar=False, style={})

    assert prism.showStatusBar is False
    assert "showStatusBar" in prism.available_properties
    assert prism.to_plotly_json()["props"]["showStatusBar"] is False
    assert "showStatusBar" not in dash_prism.Prism(id="p", style={}).to_plotly_json()["props"]


def test_prism_warns_when_actions_are_hidden_by_show_status_bar() -> None:
    action = dash_prism.Action(id="save", label="Save")
    with pytest.warns(UserWarning, match="showStatusBar=False"):
        dash_prism.Prism(id="p", showStatusBar=False, actions=[action], style={})

    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        dash_prism.Prism(id="p", showStatusBar=False, style={})
        dash_prism.Prism(id="p", showStatusBar=False, actions=[], style={})
        dash_prism.Prism(id="p", showStatusBar=True, actions=[action], style={})
        dash_prism.Prism(id="p", actions=[action], style={})


def test_prism_component_status_bar_items_prop() -> None:
    prism = dash_prism.Prism(id="test-prism", statusBarItems=["count", "updated"], style={})

    assert list(prism.statusBarItems) == ["count", "updated"]
    assert "statusBarItems" in prism.available_properties
    assert prism.to_plotly_json()["props"]["statusBarItems"] == ["count", "updated"]
    assert "statusBarItems" not in dash_prism.Prism(id="p", style={}).to_plotly_json()["props"]


def test_prism_component_enable_keyboard_shortcuts_prop() -> None:
    prism = dash_prism.Prism(id="test-prism", enableKeyboardShortcuts=False, style={})

    assert prism.enableKeyboardShortcuts is False
    assert "enableKeyboardShortcuts" in prism.available_properties
    assert prism.to_plotly_json()["props"]["enableKeyboardShortcuts"] is False
    assert (
        "enableKeyboardShortcuts"
        not in dash_prism.Prism(id="p", style={}).to_plotly_json()["props"]
    )


def test_prism_component_enable_share_links_prop() -> None:
    prism = dash_prism.Prism(id="test-prism", enableShareLinks=False, style={})

    assert prism.enableShareLinks is False
    assert "enableShareLinks" in prism.available_properties
    assert prism.to_plotly_json()["props"]["enableShareLinks"] is False
    assert "enableShareLinks" not in dash_prism.Prism(id="p", style={}).to_plotly_json()["props"]
