"""
Layout Parameters
=================

This module reads the signature of a layout callback. From that signature it
makes three things:

- The parameter metadata that the search bar shows to the user.
- A pydantic model that validates the values the browser sends back.
- A JSON Schema of that model, which the frontend receives as ``meta.schema``.

A layout declares its parameters in one of three styles::

    # 1. Plain type hints with defaults
    def layout(country: str, n: int = 10): ...

    # 2. Annotated metadata (dash_prism.Param, or pydantic.Field)
    def layout(n: Annotated[int, Param(ge=1, le=100, description="Rows")] = 10): ...

    # 3. One pydantic BaseModel ("body model" style)
    def layout(params: ChartParams): ...

Every value arrives from the browser as a string. The validator changes each
string into the type that the callback declares, and reports the parameters
that are not correct. pydantic v2 is a dependency of this package, so a model
is always available.
"""

from __future__ import annotations

import dataclasses
import enum
import inspect
import json
import logging
import re
import types
import typing
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal, Union, get_args, get_origin, get_type_hints

logger = logging.getLogger("dash_prism")

# =============================================================================
# OPTIONAL PYDANTIC DETECTION
# =============================================================================


def _is_base_model(tp: Any) -> bool:
    """Check whether ``tp`` is a pydantic v2 ``BaseModel`` subclass."""
    if not isinstance(tp, type):
        return False
    from pydantic import BaseModel

    return issubclass(tp, BaseModel)


# =============================================================================
# PUBLIC METADATA CLASS
# =============================================================================


@dataclass(frozen=True)
class Param:
    """Describes one layout parameter, inside a :data:`typing.Annotated`.

    Each field becomes a :func:`pydantic.Field` constraint for the validator,
    and part of the metadata that the search bar shows.

    **Example**::

        from typing import Annotated
        from dash_prism import Param

        def layout(n: Annotated[int, Param(ge=1, le=100, description="Rows")] = 10):
            ...

    :ivar description: The help text that the search bar shows.
    :ivar title: The label to show. The default is the parameter name.
    :ivar ge: Value must be ``>= ge`` (numbers only).
    :ivar gt: Value must be ``> gt``.
    :ivar le: Value must be ``<= le``.
    :ivar lt: Value must be ``< lt``.
    :ivar min_length: Minimum length for strings and lists.
    :ivar max_length: Maximum length for strings and lists.
    :ivar pattern: Regular expression the (string) value must match.
    :ivar choices: The values that the parameter accepts. This is an
        alternative to ``Literal[...]``. Registration fails in three
        conditions:

        - The list is empty.
        - The annotation declares choices, and this list allows a different
          set of values. The sequence of the values does not matter.
        - The list holds scalar values for a collection parameter. To restrict
          the items, annotate the item type with ``list[Literal[...]]``.

        A blank still clears an ``Optional`` parameter. On a field of a
        pydantic model, the value that the callback receives must be one of
        the choices. Thus the validators of the model run first, and a field
        that an alias sets cannot go around the list.
    :ivar examples: Example values shown as hints.
    :ivar placeholder: Placeholder text for the search bar input.
    """

    description: str | None = None
    title: str | None = None
    ge: float | None = None
    gt: float | None = None
    le: float | None = None
    lt: float | None = None
    min_length: int | None = None
    max_length: int | None = None
    pattern: str | None = None
    choices: Sequence[Any] | None = None
    examples: Sequence[Any] | None = None
    placeholder: str | None = None

    def as_field_kwargs(self) -> dict[str, Any]:
        """Translate to keyword arguments for :func:`pydantic.Field`."""
        kwargs: dict[str, Any] = {}
        for key in (
            "description",
            "title",
            "ge",
            "gt",
            "le",
            "lt",
            "min_length",
            "max_length",
            "pattern",
        ):
            value = getattr(self, key)
            if value is not None:
                kwargs[key] = value
        if self.examples is not None:
            kwargs["examples"] = list(self.examples)
        extra: dict[str, Any] = {}
        if self.placeholder is not None:
            extra["placeholder"] = self.placeholder
        if extra:
            kwargs["json_schema_extra"] = extra
        return kwargs

    def constraints(self) -> dict[str, Any]:
        """JSON-schema-style constraint dict for the frontend."""
        out: dict[str, Any] = {}
        if self.ge is not None:
            out["minimum"] = self.ge
        if self.gt is not None:
            out["exclusiveMinimum"] = self.gt
        if self.le is not None:
            out["maximum"] = self.le
        if self.lt is not None:
            out["exclusiveMaximum"] = self.lt
        if self.min_length is not None:
            out["minLength"] = self.min_length
        if self.max_length is not None:
            out["maxLength"] = self.max_length
        if self.pattern is not None:
            out["pattern"] = self.pattern
        return out


# =============================================================================
# ERRORS
# =============================================================================


@dataclass(frozen=True)
class FieldError:
    """Reports one parameter that is not valid.

    :ivar field: The path to the parameter, for example ``"n"`` or ``"filters.0"``.
    :ivar message: The message to show to the user.
    :ivar input: The value that caused the error. It is always JSON-safe.
    :ivar code: The pydantic error type, which identifies the kind of error.
    """

    field: str
    message: str
    input: Any = None
    code: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "field": self.field,
            "message": self.message,
            "input": _json_safe(self.input),
            "code": self.code,
        }


class ParamValidationError(ValueError):
    """Occurs when the parameters that come in for a layout are not valid.

    This error is a subclass of :class:`ValueError`, so an ``except ValueError``
    that an application already has continues to catch it. :func:`dash_prism.init`
    catches this class specifically, and shows the error for each parameter.

    :ivar layout_id: The identifier of the layout that received the parameters.
    :ivar errors: One :class:`FieldError` for each parameter that is not valid.
    """

    def __init__(self, layout_id: str, errors: Sequence[FieldError]) -> None:
        self.layout_id = layout_id
        self.errors: list[FieldError] = list(errors)
        super().__init__(self.format())

    def format(self) -> str:
        lines = [f"Invalid parameters for layout '{self.layout_id}':"]
        for err in self.errors:
            suffix = "" if err.input is None else f" (got {err.input!r})"
            lines.append(f"  - {err.field}: {err.message}{suffix}")
        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        return {"layoutId": self.layout_id, "errors": [e.to_dict() for e in self.errors]}


# =============================================================================
# PARAMETER DESCRIPTION (what the frontend sees)
# =============================================================================

ParamType = Literal["string", "integer", "number", "boolean", "enum", "array", "object", "unknown"]


@dataclass
class LayoutParameter:
    """Describes a parameter for a parameterized layout callback.

    :ivar name: The parameter name.
    :ivar has_default: Whether the parameter has a default value.
    :ivar default: The default value, if any.
    :ivar annotation: The type annotation as a string (informational).
    :ivar type: Simplified type for the frontend.
    :ivar nullable: Whether ``None`` is accepted (``Optional[X]`` / ``X | None``).
    :ivar choices: Allowed values for ``Literal``/``Enum``/``Param(choices=...)``.
    :ivar items: Element type when ``type == "array"``.
    :ivar constraints: JSON-schema-style constraints (``minimum``, ``pattern`` ...).
    :ivar description: Help text.
    :ivar title: Display label.
    :ivar examples: Example values.
    :ivar placeholder: Input placeholder.
    """

    name: str
    has_default: bool = False
    default: Any = None
    annotation: str | None = None
    type: ParamType = "unknown"
    nullable: bool = False
    choices: list[Any] | None = None
    items: ParamType | None = None
    constraints: dict[str, Any] = field(default_factory=dict)
    description: str | None = None
    title: str | None = None
    examples: list[Any] | None = None
    placeholder: str | None = None

    @property
    def required(self) -> bool:
        return not self.has_default

    def to_dict(self) -> dict[str, Any]:
        """Convert to a dictionary for JSON serialization (camelCase keys)."""
        return {
            "name": self.name,
            "hasDefault": self.has_default,
            "default": _json_safe(self.default),
            "annotation": self.annotation,
            "type": self.type,
            "required": self.required,
            "nullable": self.nullable,
            "choices": None if self.choices is None else [_json_safe(c) for c in self.choices],
            "items": self.items,
            "constraints": {k: _json_safe(v) for k, v in self.constraints.items()},
            "description": self.description,
            "title": self.title,
            "examples": None if self.examples is None else [_json_safe(e) for e in self.examples],
            "placeholder": self.placeholder,
        }


# =============================================================================
# INTROSPECTION
# =============================================================================

_NONE_TYPE = type(None)
_EMPTY = inspect.Parameter.empty


@dataclass
class ParamSpec:
    """Holds one resolved parameter of a layout callback.

    This class is internal to the package.
    """

    name: str
    annotation: Any  # the resolved type, or inspect.Parameter.empty
    has_default: bool
    default: Any
    meta: Param
    extra_metadata: list[Any]  # Annotated metadata we do not read, kept for pydantic


@dataclass
class CallableSpec:
    """Holds the resolved signature of one layout callback.

    This class is internal to the package.
    """

    params: list[ParamSpec]
    accepts_var_kwargs: bool = False
    body_param: str | None = None  # the name of the one BaseModel parameter
    body_model: type | None = None


def _resolve_hints(func: Callable[..., Any]) -> dict[str, Any]:
    """Resolve the annotations of ``func``, strings included.

    ``from __future__ import annotations`` turns every annotation into a
    string. :func:`typing.get_type_hints` evaluates those strings in the
    module of ``func``, never in this one.

    A forward reference that does not resolve is written to the debug log and
    then left out. The parameter is treated as if it carried no annotation.
    """
    try:
        return get_type_hints(func, include_extras=True)
    except Exception as exc:  # noqa: BLE001 - NameError, TypeError for odd callables, ...
        logger.debug("Could not resolve type hints for %r: %s", func, exc)
        raw = getattr(func, "__annotations__", {}) or {}
        return {k: v for k, v in raw.items() if not isinstance(v, str)}


def _unwrap_annotated(tp: Any) -> tuple[Any, list[Any]]:
    if get_origin(tp) is typing.Annotated:
        args = get_args(tp)
        return args[0], list(args[1:])
    return tp, []


def _strip_optional(tp: Any) -> tuple[Any, bool]:
    origin = get_origin(tp)
    if origin is Union or origin is types.UnionType:
        args = get_args(tp)
        non_none = [a for a in args if a is not _NONE_TYPE]
        nullable = len(non_none) != len(args)
        if len(non_none) == 1:
            return non_none[0], nullable
        return tp, nullable
    return tp, False


def _nullable_choice_type(choices: Sequence[Any]) -> Any:
    """Build ``Optional[Literal[*choices]]`` by whichever route typing allows.

    Python 3.10 removes the duplicates from a union by a hash of its members.
    Thus a ``Literal`` of unhashable choices, such as a list or a dictionary,
    cannot go into an ``Optional`` on that version. Python 3.11 added a
    fallback and accepts it.

    ``Literal`` itself accepts unhashable members on all supported versions.
    Thus the blank becomes a ``None`` member of the ``Literal``, and the
    parameter stays nullable on every version.

    :param choices: The values the parameter accepts.
    :returns: A type that accepts those values and ``None``.
    """
    literal = Literal[tuple(choices)]  # type: ignore[valid-type]
    try:
        return typing.Optional[literal]
    except TypeError:
        logger.debug(
            "typing refused Optional[%r]. The blank becomes a Literal member instead.", literal
        )
        return Literal[tuple([*choices, None])]


def _same_choices(left: Sequence[Any], right: Sequence[Any]) -> bool:
    """Whether two choice lists allow the same values, whatever their order.

    Order is presentation only -- it decides what the pick list shows first --
    so it must not make two agreeing declarations look like a contradiction.
    A choice can be unhashable, a list of lists for example, so this function
    cannot use sets.

    :returns: True if the two lists allow the same values.
    """
    remaining = _json_safe(list(right))
    for item in _json_safe(list(left)):
        if item not in remaining:
            return False
        remaining.remove(item)
    return not remaining


def _is_listed_choice(value: Any, choices: Sequence[Any]) -> bool:
    """Find ``value`` in ``choices``, in any of the forms it can take.

    pydantic converts the value before this function receives it. A choice
    written as a tuple thus comes back as a tuple, where the declaration holds
    a list. An ``Enum`` field comes back as a member, where the declaration
    holds the value of that member.

    :returns: True if the value is one of the choices.
    """
    if any(value == choice for choice in choices):
        return True
    safe = _json_safe(value)
    return any(safe == _json_safe(choice) for choice in choices)


def _absorb_constraints(obj: Any, merged: dict[str, Any]) -> None:
    """Duck-type ``annotated_types`` constraint objects (Ge, Le, MinLen, ...)."""
    for key in ("ge", "gt", "le", "lt", "min_length", "max_length", "pattern"):
        value = getattr(obj, key, None)
        if value is not None and key not in merged:
            merged[key] = value


def _collect_metadata(metadata: Sequence[Any]) -> tuple[Param, list[Any]]:
    """Merge the ``Annotated`` metadata this package knows into one :class:`Param`.

    Returns the merged ``Param`` and the metadata items we did not consume
    (pydantic ``FieldInfo``, ``annotated_types`` objects, arbitrary objects),
    which are handed to pydantic untouched when it is available.
    """
    merged: dict[str, Any] = {}
    leftover: list[Any] = []
    for item in metadata:
        if isinstance(item, Param):
            for f in dataclasses.fields(item):
                value = getattr(item, f.name)
                if value is not None and f.name not in merged:
                    merged[f.name] = value
            continue
        if isinstance(item, str):
            merged.setdefault("description", item)
            continue
        leftover.append(item)
        inner = getattr(item, "metadata", None)
        if isinstance(inner, (list, tuple)):  # pydantic FieldInfo
            for key in ("description", "title"):
                value = getattr(item, key, None)
                if value is not None:
                    merged.setdefault(key, value)
            examples = getattr(item, "examples", None)
            if examples:
                merged.setdefault("examples", list(examples))
            for constraint in inner:
                _absorb_constraints(constraint, merged)
        else:
            _absorb_constraints(item, merged)
    return Param(**merged), leftover


def introspect_callable(func: Callable[..., Any]) -> CallableSpec:
    """Resolve the parameters of a layout callback into a :class:`CallableSpec`.

    A callback declares its parameters as plain type hints, as
    :data:`typing.Annotated` metadata, or as one pydantic ``BaseModel``. The
    model style is the only one that cannot be mixed with the others.

    :param func: The layout callback to read.
    :returns: The resolved signature.
    :raises ValueError: If a ``BaseModel`` parameter occurs together with other
        parameters.
    """
    sig = inspect.signature(func)
    hints = _resolve_hints(func)
    params: list[ParamSpec] = []
    accepts_var_kwargs = False
    body: tuple[str, type] | None = None

    for name, param in sig.parameters.items():
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            accepts_var_kwargs = True
            continue
        if param.kind is inspect.Parameter.VAR_POSITIONAL:
            continue

        annotation = hints.get(name, param.annotation)
        if isinstance(annotation, str):  # unresolvable forward ref
            annotation = _EMPTY
        base, metadata = _unwrap_annotated(annotation)
        meta, leftover = _collect_metadata(metadata)
        has_default = param.default is not _EMPTY

        if _is_base_model(base):
            body = (name, base)

        params.append(
            ParamSpec(
                name=name,
                annotation=annotation,
                has_default=has_default,
                default=param.default if has_default else None,
                meta=meta,
                extra_metadata=leftover,
            )
        )

    if body is not None and len(params) != 1:
        raise ValueError(
            f"Layout callback '{getattr(func, '__name__', func)}' declares a pydantic model "
            f"parameter '{body[0]}'. A model parameter must be the only parameter."
        )

    return CallableSpec(
        params=params,
        accepts_var_kwargs=accepts_var_kwargs,
        body_param=body[0] if body else None,
        body_model=body[1] if body else None,
    )


def describe_type(tp: Any) -> tuple[ParamType, bool, list[Any] | None, ParamType | None]:
    """Map a resolved annotation to ``(type, nullable, choices, items)``."""
    base, _ = _unwrap_annotated(tp)
    base, nullable = _strip_optional(base)
    base, _ = _unwrap_annotated(base)
    origin = get_origin(base)

    if base is _EMPTY or base is Any:
        return "unknown", nullable, None, None
    if base is bool:
        return "boolean", nullable, None, None
    if base is int:
        return "integer", nullable, None, None
    if base is float:
        return "number", nullable, None, None
    if base is str:
        return "string", nullable, None, None
    if origin is Literal:
        return "enum", nullable, list(get_args(base)), None
    if isinstance(base, type) and issubclass(base, enum.Enum):
        return "enum", nullable, [m.value for m in base], None
    if origin in (list, tuple, set, frozenset, Sequence, typing.Sequence) or base in (
        list,
        tuple,
        set,
        frozenset,
    ):
        args = get_args(base)
        items: ParamType = describe_type(args[0])[0] if args else "unknown"
        return "array", nullable, None, items
    if origin is dict or base is dict or _is_base_model(base) or dataclasses.is_dataclass(base):
        return "object", nullable, None, None
    return "unknown", nullable, None, None


def _annotation_name(tp: Any) -> str | None:
    if tp is _EMPTY:
        return None
    if isinstance(tp, type):
        return tp.__name__
    return str(tp)


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, enum.Enum):
        return _json_safe(value.value)
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_json_safe(v) for v in value]
    if isinstance(value, Mapping):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if _is_base_model(type(value)):
        return value.model_dump(mode="json")
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return _json_safe(dataclasses.asdict(value))
    return str(value)


def _layout_parameter_from_spec(spec: ParamSpec) -> LayoutParameter:
    ptype, nullable, choices, items = describe_type(spec.annotation)
    if spec.meta.choices is not None:
        choices = list(spec.meta.choices)
        if ptype in ("string", "integer", "number", "unknown"):
            ptype = "enum"
    return LayoutParameter(
        name=spec.name,
        has_default=spec.has_default,
        default=spec.default,
        annotation=_annotation_name(_unwrap_annotated(spec.annotation)[0]),
        type=ptype,
        nullable=nullable,
        choices=choices,
        items=items,
        constraints=spec.meta.constraints(),
        description=spec.meta.description,
        title=spec.meta.title,
        examples=None if spec.meta.examples is None else list(spec.meta.examples),
        placeholder=spec.meta.placeholder,
    )


def build_layout_parameters(spec: CallableSpec) -> list[LayoutParameter]:
    """Build the parameter list that the frontend receives.

    For the body-model style this function reads the fields of the model
    instead of the signature, so the search bar asks for each field one at a
    time.

    :param spec: The resolved signature of the layout callback.
    :returns: One :class:`LayoutParameter` for each parameter or model field.
    """
    if spec.body_model is None:
        return [_layout_parameter_from_spec(p) for p in spec.params]

    result: list[LayoutParameter] = []
    for name, info in spec.body_model.model_fields.items():  # type: ignore[attr-defined]
        meta, _ = _collect_metadata([info, *info.metadata])
        has_default = not info.is_required()
        default = None
        if has_default:
            default = info.get_default(call_default_factory=True)
        result.append(
            _layout_parameter_from_spec(
                ParamSpec(
                    name=name,
                    annotation=info.annotation if info.annotation is not None else _EMPTY,
                    has_default=has_default,
                    default=default,
                    meta=meta,
                    extra_metadata=[],
                )
            )
        )
    return result


def _choice_message(choices: Sequence[Any]) -> str:
    """Render a choice list the way pydantic renders a ``Literal``.

    The wording is the same as pydantic's for the ordinary cases, which are
    strings, numbers and booleans. Thus the message reads the same whichever
    path reports it. The ``repr`` of an unusual object can differ from the
    form pydantic gives it.
    """
    rendered = [repr(c) if isinstance(c, str) else str(c) for c in choices]
    if len(rendered) == 1:
        return f"Input should be {rendered[0]}"
    return "Input should be " + ", ".join(rendered[:-1]) + f" or {rendered[-1]}"


def _check_choice_declaration(layout_id: str, name: str, annotation: Any, meta: Param) -> None:
    """Reject a choice declaration the search bar and the callback cannot both obey.

    The search bar builds the pick list from the parameter metadata, and the
    validator holds the callback to its model. Each declaration below lets the
    two disagree, so the search bar offers a value that the server then
    refuses.

    These are mistakes in the signature of the layout. This function thus
    raises them at registration, where the author can see them, and not later
    as a parameter that no input satisfies.

    :raises ValueError: If the declaration is one of the three below.
    """
    if meta.choices is None:
        return
    declared = list(meta.choices)
    if not declared:
        raise ValueError(
            f"Layout '{layout_id}': parameter '{name}' declares Param(choices=[]). "
            "No value can satisfy an empty choice list. Remove the argument, "
            "or list the values the parameter accepts."
        )

    ptype, _, annotated, _ = describe_type(annotation)
    if ptype == "array" and not all(
        isinstance(choice, (list, tuple, set, frozenset)) for choice in declared
    ):
        raise ValueError(
            f"Layout '{layout_id}': parameter '{name}' is a collection, but "
            f"Param(choices={declared!r}) lists scalar values, so every input is "
            "rejected. Choices for a collection parameter must be whole values for "
            "that collection, such as choices=[[1, 2], [3]]. To restrict the items "
            "instead, annotate the item type: list[Literal['a', 'b']]."
        )

    if annotated is not None and not _same_choices(annotated, declared):
        raise ValueError(
            f"Layout '{layout_id}': parameter '{name}' declares its choices twice and "
            f"the two disagree -- the annotation allows {_json_safe(annotated)!r} but "
            f"Param(choices=...) lists {_json_safe(declared)!r}. The search bar offers "
            "the second list while the callback enforces the first. Remove one, or "
            "make them match."
        )


def check_choice_declarations(layout_id: str, spec: CallableSpec) -> None:
    """Check every parameter's choices, for both declaration styles.

    :raises ValueError: If a choice list is empty, scalar on a collection
        parameter, or contradicts the choices the annotation already declares.
    """
    if spec.body_model is None:
        for param in spec.params:
            _check_choice_declaration(layout_id, param.name, param.annotation, param.meta)
        return
    for name, info in spec.body_model.model_fields.items():  # type: ignore[attr-defined]
        meta, _ = _collect_metadata([info, *info.metadata])
        annotation = info.annotation if info.annotation is not None else _EMPTY
        _check_choice_declaration(layout_id, name, annotation, meta)


# =============================================================================
# BASIC (STDLIB) COERCION
# =============================================================================

_TRUE = {"true", "1", "yes", "on", "y", "t"}
_FALSE = {"false", "0", "no", "off", "n", "f"}


def _is_blank(value: Any) -> bool:
    return value is None or (
        isinstance(value, str) and value.strip().lower() in ("", "none", "null")
    )


def _split_list_string(value: str) -> Any:
    """Turn the search bar's single string into a list: JSON array or CSV."""
    text = value.strip()
    if text.startswith("["):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return value  # let the validator report it
    return [part.strip() for part in text.split(",") if part.strip()]


def _match_choice(value: str, choices: Sequence[Any]) -> Any:
    """Map the string a browser sent back onto the choice it stands for.

    Every parameter arrives as a string, so ``Literal[1, 2]`` receives ``"2"``
    and an ``Enum`` with integer values receives ``"1"``. Without this the pick
    list offers values that the validator then rejects, with no way to succeed.
    Ambiguous input (two choices with the same text) is left alone for the
    validator to report.
    """
    exact = [c for c in choices if str(c) == value]
    if len(exact) == 1:
        return exact[0]
    folded = [c for c in choices if str(c).casefold() == value.casefold()]
    if len(folded) == 1:
        return folded[0]
    return value


def prepare_client_params(
    params: Mapping[str, Any],
    nullable: frozenset[str],
    arrays: frozenset[str],
    choices: Mapping[str, Sequence[Any]] | None = None,
) -> dict[str, Any]:
    """Normalize the strings that come from the browser, before validation.

    * ``""``/``"none"``/``"null"`` become ``None`` for Optional parameters.
    * A string for a list-typed parameter is split (JSON array or comma-separated).
    * A string standing for a non-string choice becomes that choice.
    """
    out: dict[str, Any] = {}
    for name, value in params.items():
        if name in nullable and _is_blank(value):
            out[name] = None
        elif name in arrays and isinstance(value, str):
            out[name] = _split_list_string(value)
        elif choices and isinstance(value, str) and name in choices:
            out[name] = _match_choice(value, choices[name])
        else:
            out[name] = value
    return out


def _model_keeping_what_pydantic_accepts(
    model_name: str, config: Any, fields: Mapping[str, Any]
) -> tuple[Any, list[str]]:
    """Rebuild a model, degrading only the fields pydantic refused.

    A single parameter that pydantic cannot make a schema for -- ``dict[str, SomeAppClass]``,
    say -- used to take every other parameter down with it, so a sibling
    annotated ``int`` silently accepted any string at all.

    Returns the model and the names of the parameters it gave up on, so the
    caller can say which ones lost their validation.
    """
    from pydantic import Field, create_model

    def build(items: Mapping[str, Any]) -> Any:
        return create_model(model_name or "LayoutParams", __config__=config, **items)

    def relaxed(field: Any) -> Any:
        return (Any, Field(field[1].default))

    kept: dict[str, Any] = {}
    degraded: list[str] = []
    for name, spec in fields.items():
        try:
            build({name: spec})
        except Exception:  # noqa: BLE001 - a type that pydantic cannot model
            kept[name] = relaxed(spec)
            degraded.append(name)
        else:
            kept[name] = spec
    try:
        return build(kept), degraded
    except Exception:  # noqa: BLE001 - a combination of types that pydantic cannot model
        # Reachable when a type only misbehaves in combination -- a custom
        # __get_pydantic_core_schema__ that fails the second time it is asked,
        # for instance. Give up on all of them rather than on registration.
        return build({name: relaxed(field) for name, field in fields.items()}), list(fields)


class LayoutValidator(typing.Protocol):
    """Validates and coerces incoming parameters for one layout."""

    layout_id: str

    def validate(self, params: Mapping[str, Any]) -> dict[str, Any]:
        """Return coerced kwargs for the callback or raise :class:`ParamValidationError`."""
        ...

    def json_schema(self) -> dict[str, Any] | None:
        """Return a JSON Schema for the parameters, or ``None`` if unavailable."""
        ...


class PydanticValidator:
    """Validator backed by a pydantic model built from the callback signature."""

    def __init__(
        self,
        layout_id: str,
        model: Any,
        body_param: str | None,
        nullable: frozenset[str] = frozenset(),
        arrays: frozenset[str] = frozenset(),
        choices: Mapping[str, Sequence[Any]] | None = None,
        passthrough: frozenset[str] = frozenset(),
        declared_choices: Mapping[str, Sequence[Any]] | None = None,
    ) -> None:
        self.layout_id = layout_id
        self.model = model
        self.body_param = body_param
        self._nullable = nullable
        self._arrays = arrays
        # Every choice we know of, used to turn the browser's string back into
        # the value it stands for.
        self._choices = dict(choices or {})
        # Only those a Param(choices=...) declared, which is what nothing else
        # enforces for a body model.
        self._declared_choices = dict(declared_choices or {})
        self._passthrough = passthrough

    @classmethod
    def from_spec(cls, layout_id: str, spec: CallableSpec) -> PydanticValidator:
        from pydantic import ConfigDict, Field, create_model

        if spec.body_model is not None:
            described = {
                name: describe_type(info.annotation)
                for name, info in spec.body_model.model_fields.items()  # type: ignore[attr-defined]
            }
        else:
            described = {p.name: describe_type(p.annotation) for p in spec.params}
        nullable = frozenset(name for name, d in described.items() if d[1])
        arrays = frozenset(name for name, d in described.items() if d[0] == "array")
        # Every value arrives as a string. Remember what each choice really
        # is, so that "2" can become 2 for Literal[1, 2]. See _match_choice.
        choices: dict[str, Sequence[Any]] = {
            name: d[2] for name, d in described.items() if d[2] is not None
        }
        if spec.body_model is None:
            for p in spec.params:
                if p.meta.choices is not None:
                    choices[p.name] = list(p.meta.choices)
        else:
            # A body model is kept exactly as the app declared it, so pydantic
            # never sees our Param metadata. Collect the field choices anyway:
            # they drive both the coercion of the string the browser sends and
            # the membership check in validate().
            declared: dict[str, Sequence[Any]] = {}
            for name, info in spec.body_model.model_fields.items():  # type: ignore[attr-defined]
                meta, _ = _collect_metadata([info, *info.metadata])
                if meta.choices is not None:
                    declared[name] = list(meta.choices)
                    choices[name] = list(meta.choices)
            return cls(
                layout_id,
                spec.body_model,
                spec.body_param,
                nullable,
                arrays,
                choices,
                declared_choices=declared,
            )

        # pydantic refuses to declare a field whose name starts with an
        # underscore, but a layout callable can correctly have one. Those
        # parameters skip the model, and go to the callback unchanged.
        passthrough = frozenset(p.name for p in spec.params if p.name.startswith("_"))

        fields: dict[str, Any] = {}
        for p in spec.params:
            if p.name in passthrough:
                continue
            tp = p.annotation if p.annotation is not _EMPTY else Any
            base, _ = _unwrap_annotated(tp)
            inner, inner_nullable = _strip_optional(base)
            if p.meta.choices is not None and get_origin(inner) is not Literal:
                # describe_type reports such a parameter nullable, so the search
                # bar offers a blank and prepare_client_params turns it into
                # None. A type rebuilt from the choices alone drops the
                # Optional and rejects that None. The user then has no input
                # that can succeed, except a choice from the list.
                tp = (
                    _nullable_choice_type(p.meta.choices)
                    if inner_nullable
                    else Literal[tuple(p.meta.choices)]
                )
            field_kwargs = p.meta.as_field_kwargs()
            if describe_type(tp)[0] == "unknown":
                # pydantic cannot make a schema for an arbitrary class, such
                # as a DataFrame, a Figure, or a type of the application. An
                # unhandled PydanticSchemaGenerationError here stops the import
                # of every application that annotates one. Such a parameter
                # goes through untouched instead, which is what a parameter
                # with no annotation already does. Its constraints have no
                # meaning on Any, so only the descriptive metadata stays.
                tp = Any
                field_kwargs = {
                    key: value
                    for key, value in field_kwargs.items()
                    if key in ("description", "title", "examples", "json_schema_extra")
                }
            elif p.extra_metadata:
                tp = typing.Annotated[(tp, *p.extra_metadata)]
            default = p.default if p.has_default else ...
            fields[p.name] = (tp, Field(default, **field_kwargs))

        model_name = (
            "".join(part.capitalize() for part in re.split(r"[^0-9a-zA-Z]+", layout_id)) + "Params"
        )
        config = ConfigDict(
            extra="allow" if spec.accepts_var_kwargs else "forbid",
            coerce_numbers_to_str=True,
            # A parameter can correctly be named "model_id", or start with an
            # underscore. Neither is the business of pydantic here.
            protected_namespaces=(),
        )
        try:
            model = create_model(
                model_name or "LayoutParams",
                __config__=config,
                **fields,
            )
        except Exception as exc:  # noqa: BLE001 - a signature that defeats pydantic
            # Registration must not fail because a signature defeats pydantic.
            # Keep every field it can still model. The rest go through
            # without validation.
            model, degraded = _model_keeping_what_pydantic_accepts(model_name, config, fields)
            logger.warning(
                "dash_prism: could not build a validation model for layout '%s' (%s); "
                "%s passed through without validation.",
                layout_id,
                exc,
                ("parameter " + ", ".join(sorted(degraded)) if degraded else "its parameters are"),
            )
        return cls(layout_id, model, None, nullable, arrays, choices, passthrough)

    def validate(self, params: Mapping[str, Any]) -> dict[str, Any]:
        from pydantic import ValidationError

        data = prepare_client_params(params, self._nullable, self._arrays, self._choices)
        held_back = {name: data.pop(name) for name in list(data) if name in self._passthrough}
        try:
            instance = self.model.model_validate(data)
        except ValidationError as exc:
            errors = [
                FieldError(
                    field=".".join(str(loc) for loc in err["loc"]) or "<root>",
                    message=err["msg"],
                    input=None if err.get("type") == "missing" else err.get("input"),
                    code=err.get("type"),
                )
                for err in exc.errors(include_url=False)
            ]
            raise ParamValidationError(self.layout_id, errors) from None
        except Exception as exc:  # noqa: BLE001 - a custom validator or type raising on its own
            # Callers catch ParamValidationError and render the panel for
            # invalid parameters. Any other error becomes a server error,
            # which tells the user nothing.
            logger.warning(
                "dash_prism: validating parameters for layout '%s' raised %s: %s",
                self.layout_id,
                type(exc).__name__,
                exc,
            )
            raise ParamValidationError(
                self.layout_id,
                [FieldError("<root>", "Could not validate the parameters", None, "invalid")],
            ) from None

        if self.body_param is not None:
            self._reject_unlisted_choices(instance)
            return {self.body_param: instance, **held_back}

        # Pass only what the client supplied, and the extras. A parameter the
        # client left out keeps the default of the callback.
        out = {name: getattr(instance, name) for name in instance.model_fields_set}
        out.update(instance.model_extra or {})
        out.update(held_back)
        return out

    def _reject_unlisted_choices(self, instance: Any) -> None:
        """Hold a body model's fields to the choices the search bar offered.

        The signature style rewrites a choice-carrying parameter into a
        ``Literal``, so pydantic enforces the list for us. A body model is the
        app's own type and reaches pydantic untouched, and pydantic ignores our
        ``Param`` metadata -- so the pick list was advertised and nothing held
        anyone to it.

        This runs *after* the model validates the request, against the
        canonical field values, for three reasons. The validators of the model run first, so
        the value is already in its final form. A field that the request set
        through an alias cannot go around the list. And ``'[1,2]'`` is now the
        tuple that the field declares, not the list that it first parsed to.
        Thus the declaration describes the value that the callback receives.

        Only choices a ``Param`` declared are checked -- pydantic owns the ones
        that come from a ``Literal`` or ``Enum`` annotation. A field the request
        did not set keeps its default, checked no more than it was before.
        """
        errors = [
            FieldError(
                name,
                _choice_message(choices),
                _json_safe(getattr(instance, name)),
                "literal_error",
            )
            for name, choices in self._declared_choices.items()
            if name in instance.model_fields_set
            and not (getattr(instance, name) is None and name in self._nullable)
            and not _is_listed_choice(getattr(instance, name), choices)
        ]
        if errors:
            raise ParamValidationError(self.layout_id, errors)

    def json_schema(self) -> dict[str, Any] | None:
        try:
            schema: dict[str, Any] = self.model.model_json_schema()
            return schema
        except Exception as exc:  # noqa: BLE001 - unschematizable custom types
            logger.debug("No JSON schema for layout '%s': %s", self.layout_id, exc)
            return None


def build_validator(layout_id: str, spec: CallableSpec) -> LayoutValidator:
    """Make the validator for one layout.

    :param layout_id: The identifier of the layout, which the error messages use.
    :param spec: The resolved signature of the layout callback.
    :returns: A validator that coerces and checks the parameters of the layout.
    :raises ValueError: If a choice declaration is not correct. See
        :func:`check_choice_declarations` for the three kinds.
    """
    check_choice_declarations(layout_id, spec)
    return PydanticValidator.from_spec(layout_id, spec)
