"""
Layout Parameters
=================

This module reads the signature of a layout callback. From that signature it
makes two things:

- The parameter metadata that the search bar shows to the user.
- A pydantic model that validates the values the browser sends back.

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
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import (
    Any,
    Literal,
    NamedTuple,
    TypeAlias,
    TypeGuard,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model
from pydantic.fields import FieldInfo

logger = logging.getLogger("dash_prism")


def _is_base_model(tp: Any) -> TypeGuard[type[BaseModel]]:
    """Tell whether ``tp`` is a pydantic v2 ``BaseModel`` subclass."""
    return isinstance(tp, type) and issubclass(tp, BaseModel)


# =============================================================================
# PUBLIC METADATA CLASS
# =============================================================================

# Maps each constraint field of Param to the JSON Schema keyword that the
# search bar reads.
_CONSTRAINT_TO_SCHEMA = {
    "ge": "minimum",
    "gt": "exclusiveMinimum",
    "le": "maximum",
    "lt": "exclusiveMaximum",
    "min_length": "minLength",
    "max_length": "maxLength",
    "pattern": "pattern",
}


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
        for key in ("description", "title", *_CONSTRAINT_TO_SCHEMA):
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
        return {
            schema_key: getattr(self, key)
            for key, schema_key in _CONSTRAINT_TO_SCHEMA.items()
            if getattr(self, key) is not None
        }


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
        """Convert to a dictionary for JSON serialization."""
        return {
            "field": self.field,
            "message": self.message,
            "input": _json_safe(self.input),
            "code": self.code,
        }


class ParamValidationError(ValueError):
    """Layout parameters that did not validate.

    The validator of a layout raises this error when the parameters that come
    in for the layout are not valid. This error is a subclass of
    :class:`ValueError`, so an ``except ValueError`` that an application already
    has continues to catch it. :func:`dash_prism.init` catches this class
    specifically, and shows the error for each parameter.

    :ivar layout_id: The identifier of the layout that received the parameters.
    :ivar errors: One :class:`FieldError` for each parameter that is not valid.
    """

    def __init__(self, layout_id: str, errors: Sequence[FieldError]) -> None:
        self.layout_id = layout_id
        self.errors: list[FieldError] = list(errors)
        super().__init__(self.format())

    def format(self) -> str:
        """Make the message of the error, with one line for each parameter."""
        lines = [f"Invalid parameters for layout '{self.layout_id}':"]
        for error in self.errors:
            suffix = "" if error.input is None else f" (got {error.input!r})"
            lines.append(f"  - {error.field}: {error.message}{suffix}")
        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        """Convert to a dictionary for JSON serialization (camelCase keys)."""
        return {"layoutId": self.layout_id, "errors": [error.to_dict() for error in self.errors]}


# =============================================================================
# PARAMETER DESCRIPTION (what the frontend sees)
# =============================================================================

ParamType: TypeAlias = Literal[
    "string", "integer", "number", "boolean", "enum", "array", "object", "unknown"
]


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
        """``True`` if the parameter has no default, so the user must give a value."""
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
            "examples": (
                None
                if self.examples is None
                else [_json_safe(example) for example in self.examples]
            ),
            "placeholder": self.placeholder,
        }


# =============================================================================
# INTROSPECTION
# =============================================================================

_NONE_TYPE = type(None)
_EMPTY = inspect.Parameter.empty


@dataclass
class ResolvedParam:
    """Holds one resolved parameter of a layout callback, or one field of its body model.

    This class is internal to the package.
    """

    name: str
    annotation: Any  # the resolved type, or inspect.Parameter.empty
    has_default: bool
    default: Any
    meta: Param
    extra_metadata: list[Any]  # Annotated metadata we do not read, kept for pydantic


@dataclass
class SignatureSpec:
    """Holds the resolved signature of one layout callback.

    This class is internal to the package.
    """

    params: list[ResolvedParam]
    accepts_var_kwargs: bool = False
    body_param: str | None = None  # the name of the one BaseModel parameter
    body_model: type[BaseModel] | None = None


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
    """Split ``Annotated[T, ...]`` into ``T`` and the list of its metadata."""
    if get_origin(tp) is typing.Annotated:
        args = get_args(tp)
        return args[0], list(args[1:])
    return tp, []


def _strip_optional(tp: Any) -> tuple[Any, bool]:
    """Remove ``None`` from a union.

    :returns: A tuple (type, nullable). The type is the one remaining member,
        or the union unchanged when two or more members other than ``None``
        remain. ``nullable`` is ``True`` if the union holds ``None``.
    """
    origin = get_origin(tp)
    if origin is Union or origin is types.UnionType:
        args = get_args(tp)
        non_none = [a for a in args if a is not _NONE_TYPE]
        nullable = len(non_none) != len(args)
        if len(non_none) == 1:
            return non_none[0], nullable
        return tp, nullable
    return tp, False


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
    """Duck-type ``annotated_types`` constraint objects (Ge, Le, MinLen, ...).

    Writes the constraints it finds into ``merged``. A key that ``merged``
    already holds keeps its value.
    """
    for key in _CONSTRAINT_TO_SCHEMA:
        value = getattr(obj, key, None)
        if value is not None and key not in merged:
            merged[key] = value


def _collect_metadata(metadata: Sequence[Any]) -> tuple[Param, list[Any]]:
    """Merge the ``Annotated`` metadata this package knows into one :class:`Param`.

    Returns the merged ``Param`` and the metadata items we did not consume
    (pydantic ``FieldInfo``, ``annotated_types`` objects, arbitrary objects).
    The validator gives those items to pydantic unchanged.
    """
    merged: dict[str, Any] = {}
    leftover: list[Any] = []
    for item in metadata:
        if isinstance(item, Param):
            for param_field in dataclasses.fields(item):
                value = getattr(item, param_field.name)
                if value is not None and param_field.name not in merged:
                    merged[param_field.name] = value
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


def introspect_callable(func: Callable[..., Any]) -> SignatureSpec:
    """Resolve the parameters of a layout callback into a :class:`SignatureSpec`.

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
    params: list[ResolvedParam] = []
    accepts_var_kwargs = False
    body: tuple[str, type[BaseModel]] | None = None

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
            ResolvedParam(
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

    return SignatureSpec(
        params=params,
        accepts_var_kwargs=accepts_var_kwargs,
        body_param=body[0] if body else None,
        body_model=body[1] if body else None,
    )


def _body_model_fields(model: type[BaseModel]) -> Iterator[ResolvedParam]:
    """Read each field of a body model as one parameter.

    :param model: The pydantic model that the layout callback takes.
    :returns: For each field of the model, in the order of the declaration, a
        :class:`ResolvedParam`. Its ``meta`` merges the ``Param`` and the
        pydantic metadata of the field. Its ``extra_metadata`` is empty,
        because the model keeps its own metadata.
    """
    for name, info in model.model_fields.items():
        meta, _ = _collect_metadata([info, *info.metadata])
        has_default = not info.is_required()
        yield ResolvedParam(
            name=name,
            annotation=_EMPTY if info.annotation is None else info.annotation,
            has_default=has_default,
            default=info.get_default(call_default_factory=True) if has_default else None,
            meta=meta,
            extra_metadata=[],
        )


def _user_facing_params(spec: SignatureSpec) -> list[ResolvedParam]:
    """Return the parameters that the user fills in.

    For the body-model style these are the fields of the model, so the search
    bar asks for each field one at a time. For the other styles they are the
    parameters of the signature.
    """
    if spec.body_model is None:
        return spec.params
    return list(_body_model_fields(spec.body_model))


class _TypeDescription(NamedTuple):
    """The simplified form of an annotation that the search bar reads.

    :ivar kind: The simplified type.
    :ivar nullable: ``True`` if the annotation accepts ``None``.
    :ivar choices: The values that a ``Literal`` or an ``Enum`` allows, or ``None``.
    :ivar items: The simplified type of the items when ``kind`` is ``"array"``.
    """

    kind: ParamType
    nullable: bool
    choices: list[Any] | None
    items: ParamType | None


def describe_type(tp: Any) -> _TypeDescription:
    """Map a resolved annotation to the simplified type that the search bar reads."""
    base, _ = _unwrap_annotated(tp)
    base, nullable = _strip_optional(base)
    base, _ = _unwrap_annotated(base)
    origin = get_origin(base)

    if base is _EMPTY or base is Any:
        return _TypeDescription("unknown", nullable, None, None)
    if base is bool:
        return _TypeDescription("boolean", nullable, None, None)
    if base is int:
        return _TypeDescription("integer", nullable, None, None)
    if base is float:
        return _TypeDescription("number", nullable, None, None)
    if base is str:
        return _TypeDescription("string", nullable, None, None)
    if origin is Literal:
        return _TypeDescription("enum", nullable, list(get_args(base)), None)
    if isinstance(base, type) and issubclass(base, enum.Enum):
        return _TypeDescription("enum", nullable, [m.value for m in base], None)
    if origin in (list, tuple, set, frozenset, Sequence, typing.Sequence) or base in (
        list,
        tuple,
        set,
        frozenset,
    ):
        args = get_args(base)
        items: ParamType = describe_type(args[0]).kind if args else "unknown"
        return _TypeDescription("array", nullable, None, items)
    if origin is dict or base is dict or _is_base_model(base) or dataclasses.is_dataclass(base):
        return _TypeDescription("object", nullable, None, None)
    return _TypeDescription("unknown", nullable, None, None)


def _annotation_name(tp: Any) -> str | None:
    if tp is _EMPTY:
        return None
    if isinstance(tp, type):
        return tp.__name__
    return str(tp)


def _json_safe(value: Any) -> Any:
    """Convert a value into a form that :func:`json.dumps` accepts.

    An ``Enum`` member becomes its value. A list, a tuple or a set becomes a
    list, and the keys of a mapping become strings. A pydantic model and a
    dataclass instance become dictionaries. A dataclass class and each other
    object become their ``str()``.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, enum.Enum):
        return _json_safe(value.value)
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_json_safe(v) for v in value]
    if isinstance(value, Mapping):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return _json_safe(dataclasses.asdict(value))
    return str(value)


def _layout_parameter_from_spec(spec: ResolvedParam) -> LayoutParameter:
    """Make the search bar metadata for one parameter.

    A ``Param(choices=...)`` replaces the choices of the annotation. It also
    makes a scalar or an unknown type into ``"enum"``, so the search bar shows
    a pick list.
    """
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


def build_layout_parameters(spec: SignatureSpec) -> list[LayoutParameter]:
    """Build the parameter list that the frontend receives.

    For the body-model style this function reads the fields of the model
    instead of the signature, so the search bar asks for each field one at a
    time.

    :param spec: The resolved signature of the layout callback.
    :returns: One :class:`LayoutParameter` for each parameter or model field.
    """
    return [_layout_parameter_from_spec(p) for p in _user_facing_params(spec)]


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
    return f"Input should be {', '.join(rendered[:-1])} or {rendered[-1]}"


def _check_choice_declaration(layout_id: str, param: ResolvedParam) -> None:
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
    if param.meta.choices is None:
        return
    name = param.name
    declared = list(param.meta.choices)
    if not declared:
        raise ValueError(
            f"Layout '{layout_id}': parameter '{name}' declares Param(choices=[]). "
            "No value can satisfy an empty choice list. Remove the argument, "
            "or list the values the parameter accepts."
        )

    description = describe_type(param.annotation)
    if description.kind == "array" and not all(
        isinstance(choice, (list, tuple, set, frozenset)) for choice in declared
    ):
        raise ValueError(
            f"Layout '{layout_id}': parameter '{name}' is a collection, but "
            f"Param(choices={declared!r}) lists scalar values, so every input is "
            "rejected. Choices for a collection parameter must be whole values for "
            "that collection, such as choices=[[1, 2], [3]]. To restrict the items "
            "instead, annotate the item type: list[Literal['a', 'b']]."
        )

    annotated = description.choices
    if annotated is not None and not _same_choices(annotated, declared):
        raise ValueError(
            f"Layout '{layout_id}': parameter '{name}' declares its choices twice and "
            f"the two disagree -- the annotation allows {_json_safe(annotated)!r} but "
            f"Param(choices=...) lists {_json_safe(declared)!r}. The search bar offers "
            "the second list while the callback enforces the first. Remove one, or "
            "make them match."
        )


def check_choice_declarations(layout_id: str, spec: SignatureSpec) -> None:
    """Check every parameter's choices, for both declaration styles.

    :raises ValueError: If a choice list is empty, scalar on a collection
        parameter, or contradicts the choices the annotation already declares.
    """
    for param in _user_facing_params(spec):
        _check_choice_declaration(layout_id, param)


# =============================================================================
# NORMALIZATION OF THE BROWSER STRINGS
# =============================================================================

# The search bar checks the same input in the browser, in
# src/ts/components/SearchBar/paramValidation.ts. That file mirrors the rules in
# this section, thus the user sees an error before a tab opens. The server is
# the authority. The table tests/fixtures/param_inputs.json holds the inputs
# that both sides must accept or reject in the same way. A test on each side
# reads the table. When you change a rule in this section, change
# paramValidation.ts and the table too.
#
# The client does not replicate these server rules:
# - A number that pydantic reads and the client does not: "5.0" for an integer,
#   "1_000", "nan" and "inf". The client accepts only plain decimal text.
# - The checks of a pydantic model, and a type that the client does not know.
#   The client lets those pass.
# - The choices of the items of a list[Literal[...]].
# - The JSON type of the items of a JSON array. The client reads each item as
#   text. Thus it accepts [true] and [null] for a list[str] and [[1]] for a
#   list[int], and it rejects [true] for a list[int]. The server rejects the
#   first three and accepts the last.
# - An empty string. A required parameter is "Required" in the search bar, but
#   the server accepts "" for a string. A parameter with a default leaves out
#   an empty input, so the server applies the default.
# - The regular-expression syntax. The client uses a JavaScript RegExp, and it
#   lets a pattern pass if JavaScript cannot read it.


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


# =============================================================================
# VALIDATION
# =============================================================================


def _relaxed_field(definition: tuple[Any, FieldInfo]) -> tuple[Any, FieldInfo]:
    """Make a field definition that accepts any value and keeps the default."""
    return (Any, Field(definition[1].default))


def _model_keeping_what_pydantic_accepts(
    model_name: str, config: ConfigDict, fields: Mapping[str, tuple[Any, FieldInfo]]
) -> tuple[type[BaseModel], list[str]]:
    """Rebuild a model, degrading only the fields pydantic refused.

    A single parameter that pydantic cannot make a schema for -- ``dict[str, SomeAppClass]``,
    say -- used to take every other parameter down with it, so a sibling
    annotated ``int`` silently accepted any string at all.

    Returns the model and the names of the parameters it gave up on, so the
    caller can say which ones lost their validation.
    """

    # The field definitions are typed Any, because mypy also matches the values
    # of **items against the other keyword parameters of create_model.
    def build(items: Mapping[str, Any]) -> type[BaseModel]:
        return create_model(model_name, __config__=config, **items)

    kept: dict[str, Any] = {}
    degraded: list[str] = []
    for name, definition in fields.items():
        try:
            build({name: definition})
        except Exception as exc:  # noqa: BLE001 - a type that pydantic cannot model
            logger.debug(
                "pydantic refused parameter %r of model %s: %s",
                name,
                model_name,
                type(exc).__name__,
            )
            kept[name] = _relaxed_field(definition)
            degraded.append(name)
        else:
            kept[name] = definition
    try:
        return build(kept), degraded
    except Exception:  # noqa: BLE001 - a combination of types that pydantic cannot model
        # Reachable when a type only misbehaves in combination -- a custom
        # __get_pydantic_core_schema__ that fails the second time it is asked,
        # for instance. Give up on all of them rather than on registration.
        relaxed = {name: _relaxed_field(definition) for name, definition in fields.items()}
        return build(relaxed), list(fields)


@dataclass(frozen=True)
class _ValidationPlan:
    """The work that a validator does on the browser strings, before and after pydantic.

    :ivar nullable: The parameters for which a blank string becomes ``None``.
    :ivar arrays: The parameters for which a string becomes a list.
    :ivar choices: Every choice list, by parameter. The validator changes the
        string from the browser back into the choice that it stands for.
    :ivar declared_choices: The choice lists that a ``Param`` declares on a
        field of a body model. pydantic does not read a ``Param``, so the
        validator checks these lists itself. The signature style has none.
    :ivar passthrough: The parameters that skip the model and go to the
        callback unchanged. The body-model style has none.
    """

    nullable: frozenset[str]
    arrays: frozenset[str]
    choices: Mapping[str, Sequence[Any]]
    declared_choices: Mapping[str, Sequence[Any]] = field(default_factory=dict)
    passthrough: frozenset[str] = frozenset()


def _plan_for(
    params: Sequence[ResolvedParam],
    *,
    declared_choices: Mapping[str, Sequence[Any]] | None = None,
    passthrough: frozenset[str] = frozenset(),
) -> _ValidationPlan:
    """Make the validation plan for the parameters that the user fills in."""
    described = {p.name: describe_type(p.annotation) for p in params}
    # Every value arrives as a string. Remember what each choice really is, so
    # that "2" can become 2 for Literal[1, 2]. See _match_choice.
    choices: dict[str, Sequence[Any]] = {
        name: description.choices
        for name, description in described.items()
        if description.choices is not None
    }
    for p in params:
        if p.meta.choices is not None:
            choices[p.name] = list(p.meta.choices)
    return _ValidationPlan(
        nullable=frozenset(name for name, d in described.items() if d.nullable),
        arrays=frozenset(name for name, d in described.items() if d.kind == "array"),
        choices=choices,
        declared_choices=declared_choices or {},
        passthrough=passthrough,
    )


class PydanticValidator:
    """Validator of the parameters of one layout, backed by a pydantic model.

    :ivar layout_id: The identifier of the layout, which the error messages use.
    :ivar model: The pydantic model that validates the parameters.
    :ivar body_param: The name of the one model parameter of the callback, or
        ``None`` if the callback does not take a body model.
    """

    def __init__(
        self,
        layout_id: str,
        model: type[BaseModel],
        body_param: str | None,
        plan: _ValidationPlan,
    ) -> None:
        self.layout_id = layout_id
        self.model = model
        self.body_param = body_param
        self._plan = plan

    def validate(self, params: Mapping[str, Any]) -> dict[str, Any]:
        """Change the strings from the browser into the keyword arguments of the callback.

        :param params: The parameters that the browser sent, by name.
        :returns: For a body model, one entry that holds the model instance,
            and the passthrough parameters. For the other styles, the
            parameters that the browser sent, the extra keyword arguments, and
            the passthrough parameters. A parameter that the browser left out
            is absent, so the callback applies its own default.
        :raises ParamValidationError: If one or more parameters are not valid.
            A custom validator or type that raises another exception also
            gives this error, with one ``<root>`` entry.
        """
        plan = self._plan
        data = prepare_client_params(params, plan.nullable, plan.arrays, plan.choices)
        held_back = {name: data.pop(name) for name in list(data) if name in plan.passthrough}
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

    def _reject_unlisted_choices(self, instance: BaseModel) -> None:
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
            for name, choices in self._plan.declared_choices.items()
            if name in instance.model_fields_set
            and not (getattr(instance, name) is None and name in self._plan.nullable)
            and not _is_listed_choice(getattr(instance, name), choices)
        ]
        if errors:
            raise ParamValidationError(self.layout_id, errors)


def _from_body_model(layout_id: str, body_param: str, model: type[BaseModel]) -> PydanticValidator:
    """Make the validator for a callback that takes one pydantic model.

    The validator keeps the model exactly as the application declares it, so
    pydantic never sees the ``Param`` metadata of a field. The field choices
    thus go into the plan. They change the string from the browser into the
    choice, and the validator checks them after the model validates.
    """
    params = list(_body_model_fields(model))
    declared = {p.name: list(p.meta.choices) for p in params if p.meta.choices is not None}
    return PydanticValidator(
        layout_id, model, body_param, _plan_for(params, declared_choices=declared)
    )


def _signature_field(param: ResolvedParam) -> tuple[Any, FieldInfo]:
    """Make the pydantic field definition for one parameter of a signature."""
    tp = param.annotation if param.annotation is not _EMPTY else Any
    base, _ = _unwrap_annotated(tp)
    inner, inner_nullable = _strip_optional(base)
    if param.meta.choices is not None and get_origin(inner) is not Literal:
        # describe_type reports such a parameter nullable, so the search
        # bar offers a blank and prepare_client_params turns it into
        # None. A type rebuilt from the choices alone drops the
        # Optional and rejects that None. The user then has no input
        # that can succeed, except a choice from the list.
        tp = Literal[tuple(param.meta.choices)]
        if inner_nullable:
            tp = typing.Optional[tp]
    field_kwargs = param.meta.as_field_kwargs()
    if describe_type(tp).kind == "unknown":
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
    elif param.extra_metadata:
        tp = typing.Annotated[(tp, *param.extra_metadata)]
    default = param.default if param.has_default else ...
    return (tp, Field(default, **field_kwargs))


def _from_signature(layout_id: str, spec: SignatureSpec) -> PydanticValidator:
    """Make the validator for a callback that declares its parameters in its signature.

    The validator builds one pydantic model from the signature. A parameter
    whose name starts with an underscore skips the model. If pydantic refuses
    a parameter, that parameter goes through without validation, and the
    function writes a warning to the log.
    """
    # pydantic refuses to declare a field whose name starts with an
    # underscore, but a layout callable can correctly have one. Those
    # parameters skip the model, and go to the callback unchanged.
    passthrough = frozenset(p.name for p in spec.params if p.name.startswith("_"))
    fields: dict[str, Any] = {
        p.name: _signature_field(p) for p in spec.params if p.name not in passthrough
    }

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
        model = create_model(model_name, __config__=config, **fields)
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
    plan = _plan_for(spec.params, passthrough=passthrough)
    return PydanticValidator(layout_id, model, None, plan)


def build_validator(layout_id: str, spec: SignatureSpec) -> PydanticValidator:
    """Make the validator for one layout.

    :param layout_id: The identifier of the layout, which the error messages use.
    :param spec: The resolved signature of the layout callback.
    :returns: A validator that coerces and checks the parameters of the layout.
    :raises ValueError: If a choice declaration is not correct. See
        :func:`check_choice_declarations` for the three kinds.
    """
    check_choice_declarations(layout_id, spec)
    if spec.body_model is None or spec.body_param is None:
        return _from_signature(layout_id, spec)
    return _from_body_model(layout_id, spec.body_param, spec.body_model)
