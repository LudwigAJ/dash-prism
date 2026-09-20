# No `from __future__ import annotations` here on purpose: several tests define
# pydantic models inside the test function, and stringified annotations of
# function-local classes cannot be resolved by typing.get_type_hints().

import enum
import sys
from typing import Annotated, Literal, Optional

import pytest
from dash import html

import dash_prism
from dash_prism import Param, ParamValidationError
from dash_prism import params as P


class Color(enum.Enum):
    RED = "red"
    BLUE = "blue"


@pytest.fixture
def no_pydantic(monkeypatch):
    """Force the stdlib fallback even when pydantic is importable."""
    monkeypatch.setattr(P, "_HAS_PYDANTIC", False)
    yield


@pytest.fixture
def pydantic_blocked(monkeypatch):
    """Prove the import path is guarded: `import pydantic` raises ImportError."""
    monkeypatch.setitem(sys.modules, "pydantic", None)
    monkeypatch.setattr(P, "_HAS_PYDANTIC", None)
    yield
    monkeypatch.setattr(P, "_HAS_PYDANTIC", None)


requires_pydantic = pytest.mark.skipif(not P.has_pydantic(), reason="pydantic not installed")


def _plain(country: str, n: int = 10, verbose: bool = False, ratio: Optional[float] = None):
    return html.Div()


def _annotated(
    n: Annotated[int, Param(ge=1, le=100, description="Rows")] = 10,
    kind: Literal["bar", "line"] = "bar",
    color: Color = Color.RED,
    tags: list[str] = [],
):
    return html.Div()


@pytest.mark.parametrize("mode", ["pydantic", "basic"])
def test_coercion_matrix(mode, monkeypatch):
    if mode == "basic":
        monkeypatch.setattr(P, "_HAS_PYDANTIC", False)
    elif not P.has_pydantic():
        pytest.skip("pydantic not installed")
    v = P.build_validator("plain", P.introspect_callable(_plain))
    out = v.validate({"country": "SE", "n": "5", "verbose": "true", "ratio": ""})
    assert out == {"country": "SE", "n": 5, "verbose": True, "ratio": None}


@pytest.mark.parametrize("mode", ["pydantic", "basic"])
def test_field_errors_all_reported(mode, monkeypatch):
    if mode == "basic":
        monkeypatch.setattr(P, "_HAS_PYDANTIC", False)
    elif not P.has_pydantic():
        pytest.skip("pydantic not installed")
    v = P.build_validator("plain", P.introspect_callable(_plain))
    with pytest.raises(ParamValidationError) as exc:
        v.validate({"n": "abc", "verbose": "maybe", "zzz": 1})
    fields = {e.field: e.code for e in exc.value.errors}
    assert set(fields) == {"country", "n", "verbose", "zzz"}
    assert fields["country"] == "missing"


def test_layout_parameters_describe_types():
    params = {p.name: p for p in P.build_layout_parameters(P.introspect_callable(_annotated))}
    assert params["n"].type == "integer" and params["n"].constraints == {
        "minimum": 1,
        "maximum": 100,
    }
    assert params["kind"].type == "enum" and params["kind"].choices == ["bar", "line"]
    assert params["color"].choices == ["red", "blue"]
    assert params["tags"].type == "array" and params["tags"].items == "string"
    assert params["n"].to_dict()["description"] == "Rows"


def test_untyped_params_pass_through(no_pydantic):
    def f(a, b="x"):
        return html.Div()

    v = P.build_validator("f", P.introspect_callable(f))
    assert v.validate({"a": "1", "b": "2"}) == {"a": "1", "b": "2"}


def test_var_kwargs_accept_extra(no_pydantic):
    def f(a: int, **rest):
        return html.Div()

    assert P.build_validator("f", P.introspect_callable(f)).validate({"a": "1", "x": "y"}) == {
        "a": 1,
        "x": "y",
    }


def test_future_annotations_are_resolved():
    src = (
        "from __future__ import annotations\n"
        "from typing import Annotated\n"
        "from dash_prism import Param\n"
        "def f(n: Annotated[int, Param(ge=1)] = 1): ...\n"
    )
    ns: dict = {}
    exec(src, ns)  # test-only: simulates a user module with stringified annotations
    p = P.build_layout_parameters(P.introspect_callable(ns["f"]))[0]
    assert p.type == "integer" and p.constraints == {"minimum": 1}


def test_fallback_without_pydantic_import(pydantic_blocked):
    assert P.has_pydantic() is False
    v = P.build_validator("plain", P.introspect_callable(_plain))
    assert isinstance(v, P.BasicValidator)
    assert v.json_schema() is None
    assert v.validate({"country": "SE"}) == {"country": "SE"}


@requires_pydantic
def test_body_model_style():
    from pydantic import BaseModel, Field

    class M(BaseModel):
        n: int = Field(1, ge=1)
        title: str

    def f(params: M):
        return html.Div()

    spec = P.introspect_callable(f)
    assert spec.body_param == "params"
    assert [p.name for p in P.build_layout_parameters(spec)] == ["n", "title"]
    v = P.build_validator("f", spec)
    assert v.validate({"title": "T", "n": "3"})["params"] == M(n=3, title="T")
    assert v.json_schema()["properties"]["n"]["minimum"] == 1
    with pytest.raises(ParamValidationError) as exc:
        v.validate({"n": "0"})
    assert {e.field for e in exc.value.errors} == {"n", "title"}


@requires_pydantic
def test_body_model_must_be_only_param():
    from pydantic import BaseModel

    class M(BaseModel):
        x: int = 1

    def f(params: M, other: int = 1):
        return html.Div()

    with pytest.raises(ValueError, match="only parameter"):
        P.introspect_callable(f)


def test_param_options_validated_at_registration():
    with pytest.raises(ValueError, match=r"param_options\['bad'\] failed validation"):

        @dash_prism.register_layout(
            id="preset-check",
            name="Preset",
            param_options={"bad": ("Bad", {"n": "abc"})},
        )
        def layout(n: int = 1):
            return html.Div()


def test_registry_metadata_has_schema_and_typed_params():
    @dash_prism.register_layout(id="typed", name="Typed")
    def layout(n: int = 1, kind: Literal["a", "b"] = "a"):
        return html.Div()

    meta = dash_prism.get_registered_layouts_metadata()["typed"]
    assert "schema" in meta
    by_name = {p["name"]: p for p in meta["params"]}
    assert by_name["n"]["type"] == "integer"
    assert by_name["kind"]["choices"] == ["a", "b"]
    if P.has_pydantic():
        assert meta["schema"]["properties"]["n"]["type"] == "integer"
    else:
        assert meta["schema"] is None


# =============================================================================
# Review regressions
# =============================================================================


class _AppType:
    """An arbitrary application class, as an app might annotate a parameter with."""


def test_unknown_annotation_does_not_break_registration():
    """pydantic cannot schematise a DataFrame or an app's own class.

    Before this guard, importing an app whose layout annotated one raised
    PydanticSchemaGenerationError from register_layout.
    """

    def layout(repo: _AppType, n: int = 1):
        return html.Div()

    validator = P.build_validator("unknown-anno", P.introspect_callable(layout))

    # The value is passed through untouched, as an unannotated parameter is.
    assert validator.validate({"repo": "anything", "n": "2"}) == {"repo": "anything", "n": 2}


def test_registering_a_layout_with_an_unknown_annotation_succeeds():
    @dash_prism.register_layout(id="unknown-anno-reg", name="Unknown")
    def layout(repo: _AppType, n: int = 1):
        return html.Div()

    assert dash_prism.registry.get("unknown-anno-reg") is not None


class _Level(enum.Enum):
    LOW = 1
    HIGH = 2


@pytest.mark.parametrize(
    "annotation,sent,expected",
    [
        (Literal[1, 2], "2", 2),
        (Literal[True, False], "False", False),
        (_Level, "1", _Level.LOW),
    ],
)
def test_non_string_choices_accept_the_string_the_browser_sends(annotation, sent, expected):
    """Every value arrives as a string, so "2" must reach Literal[1, 2] as 2.

    The pick list offers these values, so rejecting them left the user with no
    way to submit the parameter at all.
    """

    def layout(x=None):
        return html.Div()

    layout.__annotations__ = {"x": annotation}
    validator = P.build_validator("choices", P.introspect_callable(layout))

    assert validator.validate({"x": sent}) == {"x": expected}


def test_param_choices_accept_non_string_values():
    def layout(x: Annotated[int, Param(choices=[1, 2])] = 1):
        return html.Div()

    validator = P.build_validator("param-choices", P.introspect_callable(layout))

    assert validator.validate({"x": "2"}) == {"x": 2}


def test_parameter_named_with_a_leading_underscore_is_passed_through():
    """pydantic refuses such a field name; the layout callable does not care."""

    def layout(_internal: str = "x", n: int = 1):
        return html.Div()

    validator = P.build_validator("underscore", P.introspect_callable(layout))

    assert validator.validate({"_internal": "y", "n": "2"}) == {"_internal": "y", "n": 2}


def test_constraints_are_json_safe():
    """A compiled pattern would break Dash's serialisation of the metadata."""
    import json
    import re as _re

    def layout(code: Annotated[str, Param(pattern=_re.compile(r"^[a-z]+$"))] = "abc"):
        return html.Div()

    params = P.build_layout_parameters(P.introspect_callable(layout))
    json.dumps([p.to_dict() for p in params])


def test_none_is_accepted_for_an_untyped_parameter(no_pydantic):
    """The fallback must not be stricter than pydantic for an untyped parameter."""

    def layout(anything=None):
        return html.Div()

    validator = P.build_validator("untyped", P.introspect_callable(layout))

    assert validator.validate({"anything": None}) == {"anything": None}
