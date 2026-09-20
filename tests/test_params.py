# No `from __future__ import annotations` here on purpose: several tests define
# pydantic models inside the test function, and stringified annotations of
# function-local classes cannot be resolved by typing.get_type_hints().

import enum
from typing import Annotated, Literal, Optional

import pytest
from dash import html

import dash_prism
from dash_prism import Param, ParamValidationError
from dash_prism import params as P


class Color(enum.Enum):
    RED = "red"
    BLUE = "blue"


def _plain(country: str, n: int = 10, verbose: bool = False, ratio: Optional[float] = None):
    return html.Div()


def _annotated(
    n: Annotated[int, Param(ge=1, le=100, description="Rows")] = 10,
    kind: Literal["bar", "line"] = "bar",
    color: Color = Color.RED,
    tags: list[str] = [],
):
    return html.Div()


def test_coercion_matrix():
    v = P.build_validator("plain", P.introspect_callable(_plain))
    out = v.validate({"country": "SE", "n": "5", "verbose": "true", "ratio": ""})
    assert out == {"country": "SE", "n": 5, "verbose": True, "ratio": None}


def test_field_errors_all_reported():
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


def test_untyped_params_pass_through():
    def f(a, b="x"):
        return html.Div()

    v = P.build_validator("f", P.introspect_callable(f))
    assert v.validate({"a": "1", "b": "2"}) == {"a": "1", "b": "2"}


def test_var_kwargs_accept_extra():
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
    assert meta["schema"]["properties"]["n"]["type"] == "integer"


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


def test_none_is_accepted_for_an_untyped_parameter():
    """An untyped parameter takes whatever it is given, including None."""

    def layout(anything=None):
        return html.Div()

    validator = P.build_validator("untyped", P.introspect_callable(layout))

    assert validator.validate({"anything": None}) == {"anything": None}


# =============================================================================
# Optional parameters carrying Param(choices=...)
# =============================================================================


def _optional_choices(
    ticker: Annotated[Optional[str], Param(choices=["BTPS", "FRTR"])],
    window: Annotated[Optional[int], Param(choices=[5, 22])] = None,
):
    return html.Div()


def test_optional_param_choices_keep_their_nullability():
    """A blank must reach an Optional ``Param(choices=...)`` parameter as ``None``.

    ``build_layout_parameters`` reports such a parameter nullable, so the search
    bar offers an empty input as valid and ``prepare_client_params`` turns it
    into ``None``. Synthesising a bare ``Literal`` from the choices dropped the
    ``Optional``, so that ``None`` was then rejected and the user was left with
    no input that could succeed except picking a choice.
    """
    spec = P.introspect_callable(_optional_choices)
    reported = {p.name: p for p in P.build_layout_parameters(spec)}
    assert reported["ticker"].nullable is True
    assert reported["ticker"].choices == ["BTPS", "FRTR"]
    assert reported["window"].nullable is True

    validator = P.build_validator("optional-choices", spec)

    assert validator.validate({"ticker": "", "window": "none"}) == {
        "ticker": None,
        "window": None,
    }
    # The choices themselves still arrive as their real types.
    assert validator.validate({"ticker": "FRTR", "window": "22"}) == {
        "ticker": "FRTR",
        "window": 22,
    }


@pytest.mark.parametrize("optional_str", [Optional[str], str | None])
def test_every_optional_spelling_keeps_its_nullability(optional_str):
    """``typing.Optional[str]`` and ``str | None`` are different runtime objects.

    The first is a ``typing.Union``, the second a ``types.UnionType``; both must
    survive the rewrite.
    """

    def layout(ticker=None):
        return html.Div()

    layout.__annotations__ = {"ticker": Annotated[optional_str, Param(choices=["BTPS", "FRTR"])]}
    validator = P.build_validator("optional-spelling", P.introspect_callable(layout))

    assert validator.validate({"ticker": ""}) == {"ticker": None}


def test_optional_param_choices_still_reject_a_value_outside_the_list():
    """Restoring the nullability must not widen the parameter to anything."""
    validator = P.build_validator("optional-choices", P.introspect_callable(_optional_choices))

    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"ticker": "DBR"})

    assert [(e.field, e.input) for e in exc.value.errors] == [("ticker", "DBR")]


def test_required_param_choices_still_reject_a_blank():
    """Only a parameter the signature declares Optional gains the blank."""

    def layout(ticker: Annotated[str, Param(choices=["BTPS", "FRTR"])]):
        return html.Div()

    spec = P.introspect_callable(layout)
    assert P.build_layout_parameters(spec)[0].nullable is False

    with pytest.raises(ParamValidationError) as exc:
        P.build_validator("required-choices", spec).validate({"ticker": ""})

    assert [e.field for e in exc.value.errors] == ["ticker"]


def test_optional_wrap_gives_up_instead_of_raising(monkeypatch):
    """``typing.Optional[...]`` raises for members it cannot hash.

    A Literal built from unhashable choices is exactly that on Python 3.10,
    which hashes a union's members to deduplicate them; 3.11 added a fallback,
    so the refusal has to be injected to test the guard on any version. The
    wrap happens outside the guard that keeps a signature pydantic cannot model
    from aborting the import of the whole app, so it needs one of its own.
    """
    assert P._optional(Literal["a", "b"]) == Optional[Literal["a", "b"]]

    class _RefusesTheUnion:
        def __getitem__(self, item):
            raise TypeError("unhashable type: 'list'")  # what 3.10 raises

    monkeypatch.setattr(P.typing, "Optional", _RefusesTheUnion())

    assert P._optional(Literal["a", "b"]) == Literal["a", "b"]


def test_unhashable_choices_on_an_optional_parameter_still_register():
    """Registration must survive choices that cannot form a union.

    Only discriminating on Python 3.10, which CI covers: 3.11+ builds the union
    happily. Before the guard this raised TypeError out of register_layout and
    killed the import of the app.
    """

    def layout(rows: Annotated[Optional[list], Param(choices=[[1, 2], [3, 4]])] = None):
        return html.Div()

    validator = P.build_validator("unhashable-choices", P.introspect_callable(layout))

    assert validator.validate({"rows": "[1, 2]"}) == {"rows": [1, 2]}
