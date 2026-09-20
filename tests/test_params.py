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


class _RefusesTheUnion:
    """Stands in for Python 3.10's ``typing``, which cannot put an unhashable
    ``Literal`` inside a union."""

    def __getitem__(self, item):
        raise TypeError("unhashable type: 'list'")  # what 3.10 raises


def test_a_nullable_choice_type_takes_whichever_route_typing_allows(monkeypatch):
    """3.11 puts the Literal in a union; 3.10 cannot and uses a None member."""
    assert P._nullable_choice_type(["a", "b"]) == Optional[Literal["a", "b"]]

    monkeypatch.setattr(P.typing, "Optional", _RefusesTheUnion())

    assert P._nullable_choice_type(["a", "b"]) == Literal["a", "b", None]


def test_an_optional_choice_is_still_nullable_when_typing_refuses_the_union(monkeypatch):
    """The 3.10 route has to behave like the 3.11 one, not merely register.

    An earlier fix kept the type non-null when ``typing`` refused the union,
    which left exactly the bug it was fixing in place on 3.10: the search bar
    offered a blank the server would not take.
    """

    def layout(ticker: Annotated[Optional[str], Param(choices=["BTPS", "FRTR"])] = None):
        return html.Div()

    monkeypatch.setattr(P.typing, "Optional", _RefusesTheUnion())
    validator = P.build_validator("refused-union", P.introspect_callable(layout))

    assert validator.validate({"ticker": ""}) == {"ticker": None}
    assert validator.validate({"ticker": "FRTR"}) == {"ticker": "FRTR"}
    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"ticker": "DBR"})
    assert [e.field for e in exc.value.errors] == ["ticker"]


def test_unhashable_choices_on_an_optional_parameter_stay_nullable():
    """Choices that cannot form a union must register *and* keep their blank.

    On 3.11+ both assertions hold whatever route is taken, so this is a guard
    there; on 3.10, where the union cannot be built at all, the second one is
    the whole point.
    """

    def layout(rows: Annotated[Optional[list], Param(choices=[[1, 2], [3, 4]])] = None):
        return html.Div()

    validator = P.build_validator("unhashable-choices", P.introspect_callable(layout))

    assert validator.validate({"rows": "[1, 2]"}) == {"rows": [1, 2]}
    assert validator.validate({"rows": ""}) == {"rows": None}


# =============================================================================
# Choice declarations that cannot be satisfied
# =============================================================================


def test_empty_choices_are_rejected_at_registration():
    """An empty choice list admits no value, and used to disable the layout.

    ``Literal[()]`` defeats pydantic, so the model fell back to one ``Any``
    field per parameter -- and the sibling annotated ``int`` below then
    accepted any string at all.
    """

    def layout(x: Annotated[str, Param(choices=[])], n: int):
        return html.Div()

    with pytest.raises(ValueError, match=r"parameter 'x' declares Param\(choices=\[\]\)"):
        P.build_validator("empty-choices", P.introspect_callable(layout))


def test_a_parameter_pydantic_cannot_model_does_not_disable_its_siblings():
    """One unschematisable parameter used to take every other one down with it.

    ``describe_type`` only rewrites a bare unknown class to ``Any``; nested in a
    container it reaches pydantic, which refuses the whole model. The fallback
    then made *every* field ``Any``, so ``n`` silently accepted anything.
    """

    def layout(cfg: dict[str, _AppType], n: int = 1):
        return html.Div()

    validator = P.build_validator("partly-modelable", P.introspect_callable(layout))

    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"cfg": "anything", "n": "not-an-int"})
    assert [e.field for e in exc.value.errors] == ["n"]

    # The parameter it could not model is still passed through untouched.
    assert validator.validate({"cfg": "anything", "n": "7"}) == {"cfg": "anything", "n": 7}


def test_body_model_choices_are_enforced_not_just_advertised():
    """A body model is the app's own, so pydantic never sees our Param.

    The search bar offered the pick list and nothing held the request to it:
    a value that was never on the list reached the callback.
    """
    from pydantic import BaseModel

    class Body(BaseModel):
        ticker: Annotated[str, Param(choices=["BTPS", "FRTR"])]

    def layout(params: Body):
        return html.Div()

    spec = P.introspect_callable(layout)
    assert P.build_layout_parameters(spec)[0].choices == ["BTPS", "FRTR"]
    validator = P.build_validator("body-choices", spec)

    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"ticker": "DBR"})
    assert [(e.field, e.message) for e in exc.value.errors] == [
        ("ticker", "Input should be 'BTPS' or 'FRTR'")
    ]

    assert validator.validate({"ticker": "FRTR"})["params"] == Body(ticker="FRTR")


def test_a_blank_still_clears_an_optional_body_model_choice():
    """Guard: enforcing the list must not swallow the nullable blank."""
    from pydantic import BaseModel

    class Body(BaseModel):
        ticker: Annotated[Optional[str], Param(choices=["BTPS", "FRTR"])] = None

    def layout(params: Body):
        return html.Div()

    validator = P.build_validator("body-optional-choices", P.introspect_callable(layout))

    assert validator.validate({"ticker": ""})["params"].ticker is None


def test_scalar_choices_on_a_collection_parameter_are_rejected():
    """Every input failed: the string was split into a list, then compared
    against scalar choices, so no value could ever match."""

    def layout(tags: Annotated[list[str], Param(choices=["a", "b"])]):
        return html.Div()

    with pytest.raises(ValueError, match="is a collection"):
        P.build_validator("array-choices", P.introspect_callable(layout))


def test_whole_value_choices_on_a_collection_parameter_are_still_allowed():
    """Guard: the rejection must not catch choices that are whole collections."""

    def layout(rows: Annotated[Optional[list], Param(choices=[[1, 2], [3, 4]])] = None):
        return html.Div()

    validator = P.build_validator("whole-list-choices", P.introspect_callable(layout))

    assert validator.validate({"rows": "[1, 2]"}) == {"rows": [1, 2]}


def test_choices_that_contradict_the_annotation_are_rejected():
    """The metadata took Param's list and the model kept the Literal, so the
    search bar offered a value the callback was certain to refuse."""

    def layout(x: Annotated[Optional[Literal["a", "b"]], Param(choices=["a", "b", "c"])] = None):
        return html.Div()

    with pytest.raises(ValueError, match="declares its choices twice"):
        P.build_validator("conflicting-choices", P.introspect_callable(layout))


def test_choices_that_match_the_annotation_are_allowed():
    """Guard: saying the same thing twice is redundant, not wrong."""

    def layout(x: Annotated[Literal["a", "b"], Param(choices=["a", "b"])] = "a"):
        return html.Div()

    validator = P.build_validator("agreeing-choices", P.introspect_callable(layout))

    assert validator.validate({"x": "b"}) == {"x": "b"}


def test_a_bad_choice_declaration_fails_the_registration_itself():
    """The error must name the parameter and reach the decorator, not the request."""

    with pytest.raises(ValueError, match=r"parameter 'tags'"):

        @dash_prism.register_layout(id="bad-choices", name="Bad")
        def layout(tags: Annotated[list[str], Param(choices=["a", "b"])]):
            return html.Div()
