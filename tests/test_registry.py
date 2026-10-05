"""Tests for dash_prism layout registry functionality."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Annotated, Literal

import pytest
from dash import html
from pydantic import BaseModel, Field

import dash_prism
from dash_prism import LayoutParameter, Param

LAYOUT_META_FIXTURE = Path(__file__).parent / "fixtures" / "layout_meta.json"


# This class is at module level because the annotations of this file are
# strings, and Prism resolves a string with the globals of the module.
class ChartParams(BaseModel):
    chart_type: Literal["bar", "line"] = "bar"
    rows: int = Field(20, ge=1, le=100)


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


def test_layouts_is_a_read_only_view_of_the_registry(sample_layout) -> None:
    layouts = dash_prism.registry.layouts
    dash_prism.register_layout(id="later", layout=sample_layout)

    assert list(layouts) == ["later"]
    with pytest.raises(TypeError):
        layouts["other"] = layouts["later"]  # type: ignore[index]


def test_only_an_omitted_name_falls_back_to_the_id(sample_layout) -> None:
    dash_prism.register_layout(id="no-name", layout=sample_layout)
    dash_prism.register_layout(id="empty-name", name="", layout=html.Div())

    assert dash_prism.get_layout("no-name").name == "no-name"
    assert dash_prism.get_layout("empty-name").name == ""


def _register_reference_layouts() -> None:
    """Register one layout of each kind that the metadata can describe."""

    dash_prism.register_layout(
        id="static",
        name="Static Layout",
        description="A layout with no callback",
        keywords=["fixed", "page"],
        layout=html.Div("Static"),
    )

    @dash_prism.register_layout(id="plain", name="Plain Params", allow_multiple=True)
    def plain_layout(
        label: str,
        rows: int = 10,
        ratio: float = 0.5,
        enabled: bool = False,
        mode: Literal["fast", "slow"] = "fast",
        note: str | None = None,
        tags: list[str] | None = None,
    ):
        return html.Div(label)

    @dash_prism.register_layout(id="annotated", name="Annotated Params")
    def annotated_layout(
        rows: Annotated[
            int,
            Param(
                ge=1,
                le=100,
                description="Rows to show",
                title="Row count",
                examples=[10, 50],
                placeholder="10",
            ),
        ] = 10,
        code: Annotated[str, Param(min_length=2, max_length=8, pattern=r"^[a-z]+$")] = "ab",
        ratio: Annotated[float, Param(gt=0, lt=1)] = 0.5,
        tier: Annotated[str, Param(choices=["gold", "silver"])] = "gold",
    ):
        return html.Div(code)

    @dash_prism.register_layout(id="body-model", name="Body Model")
    def body_model_layout(params: ChartParams):
        return html.Div(params.chart_type)

    @dash_prism.register_layout(
        id="options",
        name="Parameter Options",
        param_options={
            "bar": ("Bar chart", {"chart_type": "bar"}),
            "small": ("Five rows", {"rows": 5}),
            "tagged": ("Two tags", {"tags": ["a", "b"]}),
        },
    )
    def options_layout(chart_type: str = "bar", rows: int = 10, tags: list[str] | None = None):
        return html.Div(chart_type)


def test_layout_metadata_matches_the_fixture_of_the_frontend() -> None:
    """The metadata of the reference layouts equals ``tests/fixtures/layout_meta.json``.

    A Vitest test checks the same file against the ``RegisteredLayouts`` type. A
    change to ``to_metadata()`` thus fails this test, and a change to the
    TypeScript type fails the Vitest test. To write the file again, run pytest
    with ``PRISM_WRITE_FIXTURES=1``.
    """
    _register_reference_layouts()
    text = json.dumps(dash_prism.get_registered_layouts_metadata(), indent=2) + "\n"

    if os.environ.get("PRISM_WRITE_FIXTURES"):
        LAYOUT_META_FIXTURE.write_text(text, encoding="utf-8")

    assert text == LAYOUT_META_FIXTURE.read_text(encoding="utf-8")


def test_layout_parameter_to_dict_contract() -> None:
    """Contract test for LayoutParameter.to_dict() matching frontend LayoutParam type."""
    param = LayoutParameter(
        name="test_param",
        has_default=True,
        default="default_value",
        annotation="str",
    )

    result = param.to_dict()

    # The keys must match the LayoutParam interface in src/ts/types/index.ts.
    assert result == {
        "name": "test_param",
        "hasDefault": True,  # camelCase
        "default": "default_value",
        "annotation": "str",
        "type": "unknown",
        "required": False,
        "nullable": False,
        "choices": None,
        "items": None,
        "constraints": {},
        "description": None,
        "title": None,
        "examples": None,
        "placeholder": None,
    }
