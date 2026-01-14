"""
Tests for dash_prism layout registry functionality.
"""

from __future__ import annotations

import pytest
from dash import html
import dash_prism


def test_register_static_layout(sample_layout) -> None:
    """Test registering a static layout."""
    dash_prism.register_layout(
        id="test-static",
        name="Test Static",
        layout=sample_layout,
    )

    assert "test-static" in dash_prism.registry
    registration = dash_prism.get_layout("test-static")
    assert registration is not None
    assert registration.name == "Test Static"
    assert registration.layout is sample_layout
    assert not registration.is_callable


def test_register_callback_layout() -> None:
    """Test registering a callback-based layout."""

    @dash_prism.register_layout(id="test-callback", name="Test Callback")
    def test_layout():
        return html.Div("Dynamic layout")

    assert "test-callback" in dash_prism.registry
    registration = dash_prism.get_layout("test-callback")
    assert registration is not None
    assert registration.is_callable
    assert registration.callback is test_layout


def test_register_parameterized_layout() -> None:
    """Test registering a layout with parameters."""

    @dash_prism.register_layout(
        id="test-params",
        name="Test Params",
        param_options={
            "option1": ("Option 1", {"param": "value1"}),
            "option2": ("Option 2", {"param": "value2"}),
        },
    )
    def test_layout(param: str = "default"):
        return html.Div(param)

    registration = dash_prism.get_layout("test-params")
    assert registration is not None
    assert len(registration.parameters) == 1
    assert registration.parameters[0].name == "param"
    assert registration.param_options is not None


def test_duplicate_registration_error(sample_layout) -> None:
    """Test that duplicate IDs raise an error."""
    dash_prism.register_layout(
        id="duplicate",
        name="First",
        layout=sample_layout,
    )

    with pytest.raises(ValueError, match="already registered"):
        dash_prism.register_layout(
            id="duplicate",
            name="Second",
            layout=sample_layout,
        )


def test_get_layout_metadata() -> None:
    """Test retrieving layout metadata."""
    dash_prism.register_layout(
        id="metadata-test",
        name="Metadata Test",
        description="Test description",
        keywords=["test", "metadata"],
        layout=html.Div("Test"),
    )

    metadata = dash_prism.get_registered_layouts_metadata()
    assert "metadata-test" in metadata
    assert metadata["metadata-test"]["name"] == "Metadata Test"
    assert metadata["metadata-test"]["description"] == "Test description"
    assert "test" in metadata["metadata-test"]["keywords"]


def test_clear_registry(sample_layout) -> None:
    """Test clearing the registry."""
    dash_prism.register_layout(id="to-clear", name="Clear Me", layout=sample_layout)
    assert "to-clear" in dash_prism.registry

    dash_prism.clear_registry()
    assert "to-clear" not in dash_prism.registry
    assert len(dash_prism.registry) == 0


def test_layout_metadata_contract_with_frontend() -> None:
    """
    Contract test ensuring to_metadata() returns exact field names expected by frontend.

    Frontend TypeScript types (src/ts/types/index.ts):
    - LayoutMeta: { name, description?, keywords?, allowMultiple?, params?, paramOptions? }
    - LayoutParam: { name, hasDefault, default? }
    - LayoutOption: { description?, params }
    """

    @dash_prism.register_layout(
        id="contract-test",
        name="Contract Test Layout",
        description="Test description",
        keywords=["test", "contract"],
        allow_multiple=True,
        param_options={
            "option1": ("Option 1 Description", {"chart_type": "bar"}),
        },
    )
    def contract_layout(chart_type: str = "bar"):
        return html.Div(chart_type)

    metadata = dash_prism.get_registered_layouts_metadata()
    layout_meta = metadata["contract-test"]

    # Verify exact field names (not 'parameters', 'parameterOptions', etc.)
    assert "name" in layout_meta
    assert "description" in layout_meta
    assert "keywords" in layout_meta
    assert "allowMultiple" in layout_meta  # camelCase
    assert "params" in layout_meta  # NOT 'parameters'
    assert "paramOptions" in layout_meta  # NOT 'parameterOptions'

    # Verify params structure matches LayoutParam type
    assert isinstance(layout_meta["params"], list)
    if layout_meta["params"]:
        param = layout_meta["params"][0]
        assert "name" in param
        assert "hasDefault" in param  # camelCase
        # 'default' and 'annotation' are optional

    # Verify paramOptions structure matches LayoutOption type
    assert layout_meta["paramOptions"] is not None
    option = layout_meta["paramOptions"]["option1"]
    assert "description" in option  # NOT 'label'
    assert "params" in option


def test_layout_parameter_to_dict_contract() -> None:
    """
    Contract test for LayoutParameter.to_dict() matching frontend LayoutParam type.
    """
    from dash_prism.registry import LayoutParameter

    param = LayoutParameter(
        name="test_param",
        has_default=True,
        default="default_value",
        annotation="str",
    )

    result = param.to_dict()

    # Verify exact field names for frontend
    assert result == {
        "name": "test_param",
        "hasDefault": True,  # camelCase
        "default": "default_value",
        "annotation": "str",
    }
