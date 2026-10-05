"""Tests for dash_prism component instantiation and rendering."""

from __future__ import annotations

import warnings

import pytest
from dash import Dash, html
from dash.development import base_component

import dash_prism
from dash_prism.PrismComponent import PrismComponent


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


def test_actions_reach_the_browser_as_component_specs() -> None:
    """The renderer gives StatusBar each action as a spec, which it renders with ExternalWrapper.

    Dash renders a prop into React elements only when the class named like the
    component's ``_type`` lists the prop in its own ``_children_props``.
    Python still walks the actions, so the IDs of the actions are in the layout.
    """
    children_props = base_component.ComponentRegistry.children_props["dash_prism"]
    assert not children_props["Prism"]
    assert dash_prism.Prism._children_props == ["actions"]


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
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        dash_prism.Prism(id="p", persistence=True, persistence_type="local", style={})
        dash_prism.Prism(id="p", persistence=True, persistence_type="session", style={})
        dash_prism.Prism(id="p", persistence=False, persistence_type="local", style={})
        dash_prism.Prism(id="p", persistence_type="local", style={})
        dash_prism.Prism(id="p", style={})


def test_prop_docstrings_match_behaviour() -> None:
    """Both docstring sources must describe the real behaviour.

    ``PrismComponent`` is generated from the TypeScript JSDoc; ``Prism`` carries
    the hand-written docstring that Sphinx publishes (``docs/api.rst`` autoclass)
    and ``help()`` shows. The two sources drifted apart once, so the test checks
    both.
    """
    claims = (
        "counts every panel together",  # maxTabs is global, not per panel
        "500 ms after the last change",  # readWorkspace debounces, not throttles
        "send updates to each other",  # what an echoing callback really does
    )
    # Claims that were wrong before and must not come back.
    wrong = (
        "allowed per panel",  # maxTabs is global
        "at most every 500 ms",  # implies a periodic refresh; it is a debounce
    )
    # The generator wraps lines, so compare whitespace-normalised text.
    for cls in (dash_prism.Prism, PrismComponent):
        doc = " ".join((cls.__doc__ or "").split())
        for claim in claims:
            assert claim in doc, f"{cls.__name__} docstring is missing {claim!r}"
        for bad in wrong:
            assert bad not in doc, f"{cls.__name__} docstring still claims {bad!r}"

    generated = " ".join((PrismComponent.__doc__ or "").split())
    assert "Prism -> Dash" in generated
    assert "Dash -> Prism" in generated


def test_prism_warns_on_quiet_empty_tab_combination() -> None:
    with pytest.warns(UserWarning, match="emptyTabView='none'"):
        dash_prism.Prism(id="p", emptyTabView="none", newTabOpensDropdown=False, style={})


def test_prism_does_not_warn_for_other_empty_tab_combinations() -> None:
    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        dash_prism.Prism(id="p", emptyTabView="none", style={})
        dash_prism.Prism(id="p", emptyTabView="none", newTabOpensDropdown=True, style={})
        dash_prism.Prism(id="p", emptyTabView="hint", newTabOpensDropdown=False, style={})
        dash_prism.Prism(id="p", emptyTabView="layouts", newTabOpensDropdown=False, style={})


def test_prism_warns_when_actions_are_hidden_by_show_status_bar() -> None:
    action = dash_prism.Action(id="save", label="Save")
    with pytest.warns(UserWarning, match="showStatusBar=False"):
        dash_prism.Prism(id="p", showStatusBar=False, actions=[action], style={})

    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        dash_prism.Prism(id="p", showStatusBar=False, style={})
        dash_prism.Prism(id="p", showStatusBar=False, actions=[], style={})
        dash_prism.Prism(id="p", showStatusBar=True, actions=[action], style={})
        dash_prism.Prism(id="p", actions=[action], style={})


@pytest.mark.parametrize(
    "prop,value",
    [
        ("emptyTabView", "none"),
        ("showStatusBar", False),
        ("statusBarItems", ["count", "updated"]),
        ("enableKeyboardShortcuts", False),
        ("enableShareLinks", False),
        ("maxPanels", 1),
    ],
)
def test_prism_forwards_a_prop_only_when_it_is_set(prop: str, value: object) -> None:
    """An unset prop stays out of the JSON, so the TypeScript default applies."""
    prism = dash_prism.Prism(id="test-prism", style={}, **{prop: value})

    assert getattr(prism, prop) == value
    assert prop in prism.available_properties
    assert prism.to_plotly_json()["props"][prop] == value
    assert prop not in dash_prism.Prism(id="p", style={}).to_plotly_json()["props"]
