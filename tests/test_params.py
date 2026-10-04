# No `from __future__ import annotations` here on purpose: several tests define
# pydantic models inside the test function, and stringified annotations of
# function-local classes cannot be resolved by typing.get_type_hints().

import enum
import json
import logging
import re
from pathlib import Path
from typing import Annotated, Literal, Optional

import pytest
from dash import html
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import core_schema

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
    # The test needs a list default. The layout function never changes it.
    tags: list[str] = [],  # noqa: B006
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
    with pytest.raises(ParamValidationError) as exc:
        v.validate({"n": "0"})
    assert {e.field for e in exc.value.errors} == {"n", "title"}


def test_body_model_must_be_only_param():
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


def test_registry_metadata_has_typed_params_and_no_schema():
    @dash_prism.register_layout(id="typed", name="Typed")
    def layout(n: int = 1, kind: Literal["a", "b"] = "a"):
        return html.Div()

    meta = dash_prism.get_registered_layouts_metadata()["typed"]
    assert "schema" not in meta
    by_name = {p["name"]: p for p in meta["params"]}
    assert by_name["n"]["type"] == "integer"
    assert by_name["kind"]["choices"] == ["a", "b"]


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

    def layout(code: Annotated[str, Param(pattern=re.compile(r"^[a-z]+$"))] = "abc"):
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


def test_unhashable_choices_on_an_optional_parameter_stay_nullable():
    """Choices that cannot be hashed must register *and* keep their blank."""

    def layout(rows: Annotated[Optional[list], Param(choices=[[1, 2], [3, 4]])] = None):
        return html.Div()

    validator = P.build_validator("unhashable-choices", P.introspect_callable(layout))

    assert validator.validate({"rows": "[1, 2]"}) == {"rows": [1, 2]}
    assert validator.validate({"rows": ""}) == {"rows": None}
    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"rows": "[5, 6]"})
    assert [e.field for e in exc.value.errors] == ["rows"]


# =============================================================================
# Choice declarations that cannot be satisfied
# =============================================================================


def test_empty_choices_are_rejected_at_registration():
    """An empty choice list admits no value, and used to disable the layout.

    ``Literal[()]`` defeats pydantic, so before the sibling-isolating fallback
    landed the model fell back to one ``Any`` field per parameter and the
    ``int`` below accepted any string at all.
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


# =============================================================================
# A body model's own machinery runs before its choices are checked
# =============================================================================


def test_body_model_tuple_choices_survive_pydantic_coercion():
    """A choice written as a tuple comes back from pydantic as a tuple.

    The membership check used to run on the prepared input, where ``'[1,2]'``
    is still the list it parsed to, so it never matched the declared tuple and
    a perfectly valid submission was refused.
    """

    class Body(BaseModel):
        pair: Annotated[tuple[int, int], Param(choices=[(1, 2), (3, 4)])]

    def layout(params: Body):
        return html.Div()

    validator = P.build_validator("body-tuple", P.introspect_callable(layout))

    assert validator.validate({"pair": "[1,2]"})["params"].pair == (1, 2)

    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"pair": "[9,9]"})
    assert [e.field for e in exc.value.errors] == ["pair"]


def test_a_body_models_own_validator_runs_before_its_choices_are_checked():
    """The app's validators normalise the value; the check sees the result.

    Checking the raw input first rejected ``' a '`` for a Literal whose own
    before-validator strips it -- and because ``param_options`` are validated
    at registration, a layout like this could no longer be imported at all.
    """

    class Body(BaseModel):
        kind: Annotated[Literal["a", "b"], Param(choices=["a", "b"])]

        @field_validator("kind", mode="before")
        @classmethod
        def _trim(cls, value):
            return value.strip() if isinstance(value, str) else value

    def layout(params: Body):
        return html.Div()

    validator = P.build_validator("body-validator", P.introspect_callable(layout))

    assert validator.validate({"kind": " a "})["params"].kind == "a"


def test_body_model_enum_choices_accept_the_member_pydantic_builds():
    """Choices written as Enum members are compared against the member.

    ``prepare_client_params`` cannot map ``'a'`` onto ``Color.RED`` (its text is
    ``'Color.RED'``), so the check has to compare across representations rather
    than demand the declaration's own spelling.
    """

    class Body(BaseModel):
        color: Annotated[Color, Param(choices=[Color.RED, Color.BLUE])]

    def layout(params: Body):
        return html.Div()

    validator = P.build_validator("body-enum", P.introspect_callable(layout))

    assert validator.validate({"color": "red"})["params"].color is Color.RED


def test_an_alias_cannot_route_around_a_body_models_choices():
    """The check reads canonical fields off the validated model.

    Keyed on the incoming names it saw no field called ``ticker`` at all, so an
    off-list value submitted under the alias reached the callback untouched.
    """

    class Body(BaseModel):
        ticker: Annotated[str, Param(choices=["BTPS", "FRTR"])] = Field(alias="t")

    def layout(params: Body):
        return html.Div()

    validator = P.build_validator("body-alias", P.introspect_callable(layout))

    with pytest.raises(ParamValidationError) as exc:
        validator.validate({"t": "DBR"})
    assert [(e.field, e.input) for e in exc.value.errors] == [("ticker", "DBR")]

    assert validator.validate({"t": "FRTR"})["params"].ticker == "FRTR"


def test_an_unset_body_field_keeps_its_default_unchecked():
    """Guard: the check must not start validating defaults nobody submitted."""

    class Body(BaseModel):
        ticker: Annotated[str, Param(choices=["BTPS", "FRTR"])] = "DBR"

    def layout(params: Body):
        return html.Div()

    validator = P.build_validator("body-default", P.introspect_callable(layout))

    assert validator.validate({})["params"].ticker == "DBR"


def test_reordered_choices_are_not_a_contradiction():
    """Order decides what the pick list shows first, nothing more.

    Comparing the two declarations as ordered lists turned a working layout
    into one that could not be imported.
    """

    def layout(x: Annotated[Literal["a", "b"], Param(choices=["b", "a"])] = "a"):
        return html.Div()

    spec = P.introspect_callable(layout)
    validator = P.build_validator("reordered-choices", spec)

    # The declared order is what the search bar offers.
    assert P.build_layout_parameters(spec)[0].choices == ["b", "a"]
    assert validator.validate({"x": "b"}) == {"x": "b"}


def test_a_genuinely_different_choice_list_is_still_a_contradiction():
    """Guard: ignoring order must not start ignoring the values themselves."""

    def layout(x: Annotated[Literal["a", "b"], Param(choices=["b", "c"])] = "a"):
        return html.Div()

    with pytest.raises(ValueError, match="declares its choices twice"):
        P.build_validator("still-conflicting", P.introspect_callable(layout))


def test_the_warning_names_the_parameters_that_lost_validation():
    """A log line saying "its parameters" hid which one actually degraded."""

    def layout(cfg: dict[str, _AppType], n: int = 1):
        return html.Div()

    records: list[str] = []
    handler = logging.Handler()
    handler.emit = lambda record: records.append(record.getMessage())  # type: ignore[method-assign]
    logger = logging.getLogger("dash_prism")
    logger.addHandler(handler)
    try:
        P.build_validator("named-degradation", P.introspect_callable(layout))
    finally:
        logger.removeHandler(handler)

    assert any("parameter cfg" in message for message in records)
    assert not any("parameter cfg, n" in message for message in records)


def test_the_last_resort_fallback_gives_up_on_every_field():
    """A type can misbehave only in combination, and that branch has to work.

    Probing each field alone cannot catch a type whose schema hook succeeds the
    first time it is asked and fails the next, so the combined rebuild still
    fails and everything has to be relaxed.
    """

    class _RefusesToBeSchematisedTwice:
        calls = 0

        @classmethod
        def __get_pydantic_core_schema__(cls, source, handler):
            cls.calls += 1
            if cls.calls > 1:
                raise ValueError("this type cannot be schematised again")
            return core_schema.str_schema()

    fields = {
        "odd": (_RefusesToBeSchematisedTwice, Field(None)),
        "n": (int, Field(1)),
    }
    model, degraded = P._model_keeping_what_pydantic_accepts(
        "LastResort", ConfigDict(extra="forbid"), fields
    )

    assert degraded == ["odd", "n"]
    # Everything is Any now, so even the sibling stops being checked.
    assert model.model_validate({"n": "not-an-int"}).n == "not-an-int"


# =============================================================================
# Client and server accept the same input
# =============================================================================

# src/ts/components/SearchBar/paramValidation.test.ts reads the same file.
PARAM_INPUT_CASES = json.loads(
    (Path(__file__).parent / "fixtures" / "param_inputs.json").read_text(encoding="utf-8")
)

_SCALAR_TYPES = {"string": str, "integer": int, "number": float, "boolean": bool}


def _layout_for_case(case):
    """Make a callback with one required parameter of the type that the case names."""
    if case["type"] == "array":
        item_type = _SCALAR_TYPES[case["items"]]
        annotation = list[item_type]
    elif case["type"] == "enum":
        annotation = Literal[tuple(case["choices"])]
    else:
        annotation = _SCALAR_TYPES[case["type"]]
    if case.get("nullable"):
        annotation = Optional[annotation]

    def layout(value):
        return html.Div()

    layout.__annotations__ = {"value": annotation}
    return layout


@pytest.mark.parametrize("case", PARAM_INPUT_CASES, ids=lambda case: json.dumps(case))
def test_server_agrees_with_the_shared_input_table(case):
    """The server accepts or rejects each input as the table says.

    The search bar mirrors these rules in ``paramValidation.ts``. A change on
    one side that the other side lacks fails this test or the Vitest test.
    """
    spec = P.introspect_callable(_layout_for_case(case))
    sent = P.build_layout_parameters(spec)[0].to_dict()
    # The Vitest test builds its parameter from the case, so the case has to
    # describe the metadata that the server sends.
    assert sent["type"] == case["type"]
    assert sent["nullable"] == case.get("nullable", False)
    assert sent["items"] == case.get("items")
    assert sent["choices"] == case.get("choices")

    try:
        P.build_validator("table", spec).validate({"value": case["input"]})
    except ParamValidationError:
        accepted = False
    else:
        accepted = True

    assert accepted == case["ok"]
