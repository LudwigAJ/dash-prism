"""
Layout Parameters
=================

Parameter metadata, signature introspection, and validation for
parameterized layouts.

Three declaration styles are supported::

    # 1. Plain type hints with defaults
    def layout(country: str, n: int = 10): ...

    # 2. Annotated metadata (dash_prism.Param, or pydantic.Field when installed)
    def layout(n: Annotated[int, Param(ge=1, le=100, description="Rows")] = 10): ...

    # 3. A single pydantic BaseModel ("body model" style, requires pydantic)
    def layout(params: ChartParams): ...

When pydantic v2 is installed (``pip install dash-prism[pydantic]``) a model is
built per layout and used for validation, coercion and JSON-schema export.
Without pydantic a stdlib-only coercer handles ``str``, ``int``, ``float``,
``bool``, ``Literal``, ``Enum``, ``Optional``/``X | None`` and ``list[T]``.
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

_HAS_PYDANTIC: bool | None = None


def has_pydantic() -> bool:
    """Return ``True`` if pydantic v2 is importable.

    The result is cached; tests may reset ``_HAS_PYDANTIC`` to ``None``.
    """
    global _HAS_PYDANTIC
    if _HAS_PYDANTIC is None:
        try:
            import pydantic

            major = int(str(pydantic.VERSION).split(".")[0])
            _HAS_PYDANTIC = major >= 2
            if not _HAS_PYDANTIC:
                logger.warning(
                    "dash_prism: pydantic %s found but v2 is required for parameter "
                    "validation; falling back to basic coercion.",
                    pydantic.VERSION,
                )
        except Exception:  # ImportError, or a broken install
            _HAS_PYDANTIC = False
    return _HAS_PYDANTIC


def _is_base_model(tp: Any) -> bool:
    """Check whether ``tp`` is a pydantic v2 ``BaseModel`` subclass."""
    if not has_pydantic() or not isinstance(tp, type):
        return False
    from pydantic import BaseModel

    return issubclass(tp, BaseModel)


# =============================================================================
# PUBLIC METADATA CLASS
# =============================================================================


@dataclass(frozen=True)
class Param:
    """Metadata for a layout parameter, used inside :data:`typing.Annotated`.

    Works with or without pydantic. When pydantic is installed the metadata
    is translated to :func:`pydantic.Field` constraints.

    **Example**::

        from typing import Annotated
        from dash_prism import Param

        def layout(n: Annotated[int, Param(ge=1, le=100, description="Rows")] = 10):
            ...

    :ivar description: Help text shown in the search bar.
    :ivar title: Human-readable label (defaults to the parameter name).
    :ivar ge: Value must be ``>= ge`` (numbers only).
    :ivar gt: Value must be ``> gt``.
    :ivar le: Value must be ``<= le``.
    :ivar lt: Value must be ``< lt``.
    :ivar min_length: Minimum length for strings and lists.
    :ivar max_length: Maximum length for strings and lists.
    :ivar pattern: Regular expression the (string) value must match.
    :ivar choices: Allowed values. Alternative to ``Literal[...]``.
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
    """A single validation failure for one parameter.

    :ivar field: Dotted path to the parameter (e.g. ``"n"`` or ``"filters.0"``).
    :ivar message: Human-readable message.
    :ivar input: The offending input value (JSON-safe).
    :ivar code: Machine-readable error code (pydantic error type or a basic code).
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
    """Raised when incoming layout parameters fail validation.

    Subclasses :class:`ValueError` so existing ``except ValueError`` paths keep
    working; :func:`dash_prism.init` catches it explicitly to render a
    field-level error component.

    :ivar layout_id: The layout whose parameters were invalid.
    :ivar errors: One :class:`FieldError` per failing parameter.
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


class _CoercionError(Exception):
    """Internal: raised by the basic coercer for one value."""

    def __init__(self, message: str, code: str) -> None:
        self.message = message
        self.code = code
        super().__init__(message)


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
    """Internal: one resolved callback parameter."""

    name: str
    annotation: Any  # resolved type, or inspect.Parameter.empty
    has_default: bool
    default: Any
    meta: Param
    extra_metadata: list[Any]  # unrecognised Annotated metadata (kept for pydantic)


@dataclass
class CallableSpec:
    """Internal: resolved signature of a layout callback."""

    params: list[ParamSpec]
    accepts_var_kwargs: bool = False
    body_param: str | None = None  # name of the single BaseModel parameter
    body_model: type | None = None


def _resolve_hints(func: Callable[..., Any]) -> dict[str, Any]:
    """Resolve annotations, including stringified ones from
    ``from __future__ import annotations``.

    Uses :func:`typing.get_type_hints`, which evaluates strings in the
    function's own module namespace (never in ours). Unresolvable forward
    references are skipped with a debug log; they are treated as unannotated.
    """
    try:
        return get_type_hints(func, include_extras=True)
    except Exception as exc:  # NameError, TypeError for odd callables, ...
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


def _absorb_constraints(obj: Any, merged: dict[str, Any]) -> None:
    """Duck-type ``annotated_types`` constraint objects (Ge, Le, MinLen, ...)."""
    for key in ("ge", "gt", "le", "lt", "min_length", "max_length", "pattern"):
        value = getattr(obj, key, None)
        if value is not None and key not in merged:
            merged[key] = value


def _collect_metadata(metadata: Sequence[Any]) -> tuple[Param, list[Any]]:
    """Merge recognised ``Annotated`` metadata into one :class:`Param`.

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
    """Resolve a layout callback's parameters.

    :raises ValueError: If a ``BaseModel`` parameter is mixed with other parameters.
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
            f"parameter '{body[0]}'; a model parameter must be the only parameter."
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
    """Build the frontend-facing parameter list.

    For the body-model style the model's fields are flattened so the search
    bar prompts for each field individually.
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


# =============================================================================
# BASIC (STDLIB) COERCION
# =============================================================================

_TRUE = {"true", "1", "yes", "on", "y", "t"}
_FALSE = {"false", "0", "no", "off", "n", "f"}


def _coerce_scalar(base: Any, value: Any, path: str) -> Any:
    origin = get_origin(base)

    if base is _EMPTY or base is Any:
        return value

    if base is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)) and value in (0, 1):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in _TRUE:
                return True
            if lowered in _FALSE:
                return False
        raise _CoercionError("Input should be a valid boolean", "bool_parsing")

    if base is int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            try:
                return int(value.strip())
            except ValueError:
                pass
        raise _CoercionError("Input should be a valid integer", "int_parsing")

    if base is float:
        if isinstance(value, bool):
            return float(value)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.strip())
            except ValueError:
                pass
        raise _CoercionError("Input should be a valid number", "float_parsing")

    if base is str:
        if isinstance(value, str):
            return value
        if isinstance(value, (int, float, bool)):
            return str(value)
        raise _CoercionError("Input should be a valid string", "string_type")

    if origin is Literal:
        allowed = get_args(base)
        if value in allowed:
            return value
        for candidate in allowed:  # allow "1" -> 1 for Literal[1, 2]
            try:
                if _coerce_scalar(type(candidate), value, path) == candidate:
                    return candidate
            except _CoercionError:
                continue
        expected = " or ".join(repr(a) for a in allowed)
        raise _CoercionError(f"Input should be {expected}", "literal_error")

    if isinstance(base, type) and issubclass(base, enum.Enum):
        if isinstance(value, base):
            return value
        try:
            return base(value)
        except ValueError:
            pass
        if isinstance(value, str):
            for member in base:
                if member.name == value or str(member.value) == value:
                    return member
        expected = " or ".join(repr(m.value) for m in base)
        raise _CoercionError(f"Input should be {expected}", "enum")

    if origin in (list, tuple, set, frozenset, Sequence, typing.Sequence) or base in (
        list,
        tuple,
        set,
        frozenset,
    ):
        args = get_args(base)
        item_type = args[0] if args else Any
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                try:
                    parts = json.loads(text)
                except json.JSONDecodeError:
                    raise _CoercionError("Input should be a valid JSON array", "list_type")
            else:
                parts = [p.strip() for p in text.split(",") if p.strip()]
        elif isinstance(value, (list, tuple, set, frozenset)):
            parts = list(value)
        else:
            raise _CoercionError("Input should be a valid list", "list_type")
        items = [_coerce(item_type, p, f"{path}[{i}]") for i, p in enumerate(parts)]
        container = origin or base
        if container in (tuple, set, frozenset):
            return container(items)
        return items

    if origin is dict or base is dict:
        if isinstance(value, Mapping):
            return dict(value)
        if isinstance(value, str):
            try:
                loaded = json.loads(value)
            except json.JSONDecodeError:
                raise _CoercionError("Input should be a valid JSON object", "dict_type")
            if isinstance(loaded, dict):
                return loaded
        raise _CoercionError("Input should be a valid dictionary", "dict_type")

    # Unknown / user-defined type: pass through unchanged.
    return value


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
    """Normalise string-only client input before validation.

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


def _coerce(tp: Any, value: Any, path: str) -> Any:
    base, metadata = _unwrap_annotated(tp)
    base, nullable = _strip_optional(base)
    base, inner_meta = _unwrap_annotated(base)
    meta, _ = _collect_metadata([*metadata, *inner_meta])

    if value is None or (nullable and _is_blank(value)):
        # An unannotated or Any parameter takes whatever it is given, including
        # None; only a parameter with a real type rejects it.
        if nullable or base is _EMPTY or base is Any:
            return None
        raise _CoercionError("Input should not be null", "none_forbidden")

    result = _coerce_scalar(base, value, path)
    _apply_constraints(meta, result)
    return result


def _apply_constraints(meta: Param, value: Any) -> None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if meta.ge is not None and value < meta.ge:
            raise _CoercionError(
                f"Input should be greater than or equal to {meta.ge}", "greater_than_equal"
            )
        if meta.gt is not None and value <= meta.gt:
            raise _CoercionError(f"Input should be greater than {meta.gt}", "greater_than")
        if meta.le is not None and value > meta.le:
            raise _CoercionError(
                f"Input should be less than or equal to {meta.le}", "less_than_equal"
            )
        if meta.lt is not None and value >= meta.lt:
            raise _CoercionError(f"Input should be less than {meta.lt}", "less_than")
    if isinstance(value, (str, list, tuple, set, frozenset)):
        unit = "characters" if isinstance(value, str) else "items"
        if meta.min_length is not None and len(value) < meta.min_length:
            raise _CoercionError(
                f"Input should have at least {meta.min_length} {unit}", "too_short"
            )
        if meta.max_length is not None and len(value) > meta.max_length:
            raise _CoercionError(f"Input should have at most {meta.max_length} {unit}", "too_long")
    if isinstance(value, str) and meta.pattern is not None:
        if re.search(meta.pattern, value) is None:
            raise _CoercionError(
                f"String should match pattern '{meta.pattern}'", "string_pattern_mismatch"
            )
    if meta.choices is not None and value not in meta.choices:
        expected = " or ".join(repr(c) for c in meta.choices)
        raise _CoercionError(f"Input should be {expected}", "literal_error")


def coerce_basic(tp: Any, value: Any, meta: Param | None = None) -> Any:
    """Coerce ``value`` to annotation ``tp`` using only the standard library.

    :raises ValueError: If coercion fails (message describes the problem).
    """
    try:
        result = _coerce(tp, value, "")
        if meta is not None:
            _apply_constraints(meta, result)
        return result
    except _CoercionError as exc:
        raise ValueError(exc.message) from None


# =============================================================================
# VALIDATORS
# =============================================================================


class LayoutValidator(typing.Protocol):
    """Validates and coerces incoming parameters for one layout."""

    layout_id: str

    def validate(self, params: Mapping[str, Any]) -> dict[str, Any]:
        """Return coerced kwargs for the callback or raise :class:`ParamValidationError`."""
        ...

    def json_schema(self) -> dict[str, Any] | None:
        """Return a JSON Schema for the parameters, or ``None`` if unavailable."""
        ...


class BasicValidator:
    """Stdlib-only validator used when pydantic is not installed."""

    def __init__(self, layout_id: str, spec: CallableSpec) -> None:
        self.layout_id = layout_id
        self.spec = spec
        self._by_name = {p.name: p for p in spec.params}

    def validate(self, params: Mapping[str, Any]) -> dict[str, Any]:
        errors: list[FieldError] = []
        out: dict[str, Any] = {}

        for name, raw in params.items():
            spec = self._by_name.get(name)
            if spec is None:
                if self.spec.accepts_var_kwargs:
                    out[name] = raw
                else:
                    errors.append(FieldError(name, "Unexpected parameter", raw, "extra_forbidden"))
                continue
            try:
                out[name] = _coerce(spec.annotation, raw, name)
                _apply_constraints(spec.meta, out[name])
            except _CoercionError as exc:
                errors.append(FieldError(name, exc.message, raw, exc.code))

        for spec in self.spec.params:
            if not spec.has_default and spec.name not in params:
                errors.append(FieldError(spec.name, "Field required", None, "missing"))

        if errors:
            raise ParamValidationError(self.layout_id, errors)
        return out

    def json_schema(self) -> dict[str, Any] | None:
        return None


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
    ) -> None:
        self.layout_id = layout_id
        self.model = model
        self.body_param = body_param
        self._nullable = nullable
        self._arrays = arrays
        self._choices = dict(choices or {})
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
        # Every value arrives as a string; remember what each choice really is so
        # "2" can become 2 for Literal[1, 2] (see _match_choice).
        choices: dict[str, Sequence[Any]] = {
            name: d[2] for name, d in described.items() if d[2] is not None
        }
        if spec.body_model is None:
            for p in spec.params:
                if p.meta.choices is not None:
                    choices[p.name] = list(p.meta.choices)

        if spec.body_model is not None:
            return cls(layout_id, spec.body_model, spec.body_param, nullable, arrays, choices)

        # pydantic refuses to declare a field whose name starts with an
        # underscore, but a layout callable may perfectly well have one. Those
        # parameters skip the model and are passed through unchanged.
        passthrough = frozenset(p.name for p in spec.params if p.name.startswith("_"))

        fields: dict[str, Any] = {}
        for p in spec.params:
            if p.name in passthrough:
                continue
            tp = p.annotation if p.annotation is not _EMPTY else Any
            base, _ = _unwrap_annotated(tp)
            if p.meta.choices is not None and get_origin(_strip_optional(base)[0]) is not Literal:
                tp = Literal[tuple(p.meta.choices)]  # type: ignore[valid-type]
            field_kwargs = p.meta.as_field_kwargs()
            if describe_type(tp)[0] == "unknown":
                # pydantic cannot build a schema for an arbitrary class (a
                # DataFrame, a Figure, an app's own type), and an unhandled
                # PydanticSchemaGenerationError here would abort the import of
                # any app that annotates one. Such a parameter is passed through
                # untouched instead, which is what an unannotated one already
                # does; its constraints would be meaningless on Any, so only the
                # descriptive metadata is kept.
                tp = Any
                field_kwargs = {
                    key: value
                    for key, value in field_kwargs.items()
                    if key in ("description", "title", "examples", "json_schema_extra")
                }
            elif p.extra_metadata:
                tp = typing.Annotated[(tp, *p.extra_metadata)]  # type: ignore[misc]
            default = p.default if p.has_default else ...
            fields[p.name] = (tp, Field(default, **field_kwargs))

        model_name = (
            "".join(part.capitalize() for part in re.split(r"[^0-9a-zA-Z]+", layout_id)) + "Params"
        )
        config = ConfigDict(
            extra="allow" if spec.accepts_var_kwargs else "forbid",
            coerce_numbers_to_str=True,
            # A parameter may legitimately be named "model_id" or start with an
            # underscore; neither is pydantic's business here.
            protected_namespaces=(),
        )
        try:
            model = create_model(  # type: ignore[call-overload]
                model_name or "LayoutParams",
                __config__=config,
                **fields,
            )
        except Exception as exc:  # pragma: no cover - depends on the app's types
            # Registration must not fail because a signature defeats pydantic.
            # Fall back to a model that accepts every parameter unchanged.
            logger.warning(
                "dash_prism: could not build a validation model for layout '%s' (%s); "
                "its parameters will be passed through without validation.",
                layout_id,
                exc,
            )
            model = create_model(  # type: ignore[call-overload]
                model_name or "LayoutParams",
                __config__=config,
                **{name: (Any, Field(field[1].default)) for name, field in fields.items()},
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
        except Exception as exc:  # a custom validator or type raising on its own
            # Callers handle ParamValidationError and render the invalid-parameter
            # panel; anything else would surface as a generic server error.
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
            return {self.body_param: instance, **held_back}

        # Only pass what the client actually supplied (plus extras); omitted
        # parameters fall back to the callback's own defaults, as before.
        out = {name: getattr(instance, name) for name in instance.model_fields_set}
        out.update(instance.model_extra or {})
        out.update(held_back)
        return out

    def json_schema(self) -> dict[str, Any] | None:
        try:
            schema: dict[str, Any] = self.model.model_json_schema()
            return schema
        except Exception as exc:  # unschematizable custom types
            logger.debug("No JSON schema for layout '%s': %s", self.layout_id, exc)
            return None


def build_validator(layout_id: str, spec: CallableSpec) -> LayoutValidator:
    """Create the validator for a layout (pydantic if available, else basic)."""
    if has_pydantic():
        return PydanticValidator.from_spec(layout_id, spec)
    if spec.body_model is not None:  # pragma: no cover - cannot happen without pydantic
        raise ValueError("Model-style parameters require pydantic")
    return BasicValidator(layout_id, spec)
