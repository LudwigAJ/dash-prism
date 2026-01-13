"""
Layout Registry for Prism
=========================

This module handles registration of layouts that can be opened in Prism tabs.
Layouts can be static (pre-built) or dynamic (generated on-demand via callbacks).

Usage Examples
--------------

Static layout registration::

    register_layout(
        id='home',
        name='Home',
        layout=html.Div('Welcome!')
    )

Decorator for callback-based layouts::

    @register_layout(
        id='chart',
        name='Chart View',
        param_options={
            'bar': ('Bar Chart', {'chart_type': 'bar'}),
            'line': ('Line Chart', {'chart_type': 'line'}),
        }
    )
    def chart_layout(chart_type: str = 'bar'):
        return dcc.Graph(...)
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Tuple,
    Union,
    overload,
)


# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class LayoutParameter:
    """Describes a parameter for a parameterized layout callback.

    :ivar name: The parameter name.
    :type name: str
    :ivar has_default: Whether the parameter has a default value.
    :type has_default: bool
    :ivar default: The default value, if any.
    :type default: Any
    :ivar annotation: The type annotation as a string.
    :type annotation: str | None
    """

    name: str
    has_default: bool = False
    default: Any = None
    annotation: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to a dictionary for JSON serialization.

        :returns: Dictionary with camelCase keys for frontend consumption.
        :rtype: dict[str, Any]
        """
        return {
            'name': self.name,
            'hasDefault': self.has_default,
            'default': self.default,
            'annotation': self.annotation,
        }


@dataclass
class LayoutRegistration:
    """Represents a registered layout in the Prism system.

    :ivar id: Unique identifier for this layout.
    :type id: str
    :ivar name: Human-readable display name.
    :type name: str
    :ivar description: Description shown in the layout picker.
    :type description: str
    :ivar keywords: Searchable keywords for finding this layout.
    :type keywords: list[str]
    :ivar allow_multiple: Whether multiple instances can be open simultaneously.
    :type allow_multiple: bool
    :ivar layout: Static layout component (mutually exclusive with callback).
    :type layout: Any
    :ivar callback: Function to generate layout (mutually exclusive with layout).
    :type callback: Callable[..., Any] | None
    :ivar is_async: Whether the callback is an async function.
    :type is_async: bool
    :ivar parameters: Parameters the callback accepts.
    :type parameters: list[LayoutParameter]
    :ivar param_options: Pre-defined parameter configurations for quick access.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    """

    id: str
    name: str
    description: str = ''
    keywords: List[str] = field(default_factory=list)
    allow_multiple: bool = False
    layout: Any = None
    callback: Optional[Callable[..., Any]] = None
    is_async: bool = False
    parameters: List[LayoutParameter] = field(default_factory=list)
    param_options: Optional[Dict[str, Tuple[str, Dict[str, Any]]]] = None

    @property
    def is_callable(self) -> bool:
        """Check if this layout is generated via callback.

        :returns: True if layout uses a callback, False if static.
        :rtype: bool
        """
        return self.callback is not None

    def to_metadata(self) -> Dict[str, Any]:
        """Convert to metadata dict for frontend consumption.

        Does **not** include the actual layout component or callback function.

        :returns: Metadata dictionary with camelCase keys.
        :rtype: dict[str, Any]
        """
        result: Dict[str, Any] = {
            'name': self.name,
            'description': self.description,
            'keywords': self.keywords,
            'allowMultiple': self.allow_multiple,
            'params': [p.to_dict() for p in self.parameters],  # Changed from 'parameters'
            'paramOptions': None,  # Changed from 'parameterOptions'
        }

        if self.param_options:
            result['paramOptions'] = {
                key: {'description': label, 'params': params}  # Changed 'label' to 'description'
                for key, (label, params) in self.param_options.items()
            }

        return result


# =============================================================================
# REGISTRY CLASS
# =============================================================================


class LayoutRegistry:
    """Global registry of all layouts available in Prism.

    Provides methods to register, retrieve, and manage layouts.
    Supports iteration and membership testing.

    **Example**::

        >>> registry = LayoutRegistry()
        >>> len(registry)
        0
        >>> 'home' in registry
        False
    """

    def __init__(self) -> None:
        self._layouts: Dict[str, LayoutRegistration] = {}

    @property
    def layouts(self) -> Dict[str, LayoutRegistration]:
        """Get a copy of all registered layouts.

        :returns: Dictionary mapping layout IDs to registrations.
        :rtype: dict[str, LayoutRegistration]
        """
        return self._layouts.copy()

    def __contains__(self, layout_id: str) -> bool:
        """Check if a layout ID is registered."""
        return layout_id in self._layouts

    def __len__(self) -> int:
        """Return the number of registered layouts."""
        return len(self._layouts)

    def __iter__(self):
        """Iterate over layout IDs."""
        return iter(self._layouts)

    def get(self, layout_id: str) -> Optional[LayoutRegistration]:
        """Get a registered layout by ID.

        :param layout_id: The unique identifier of the layout.
        :type layout_id: str
        :returns: The registration if found, None otherwise.
        :rtype: LayoutRegistration | None
        """
        return self._layouts.get(layout_id)

    def register(self, registration: LayoutRegistration) -> None:
        """Register a layout.

        :param registration: The layout registration to add.
        :type registration: LayoutRegistration
        :raises ValueError: If the layout ID is already registered.
        """
        if registration.id in self._layouts:
            raise ValueError(f"Layout '{registration.id}' is already registered")
        self._layouts[registration.id] = registration

    def unregister(self, layout_id: str) -> bool:
        """Remove a layout from the registry.

        :param layout_id: The ID of the layout to remove.
        :type layout_id: str
        :returns: True if removed, False if not found.
        :rtype: bool
        """
        if layout_id in self._layouts:
            del self._layouts[layout_id]
            return True
        return False

    def clear(self) -> None:
        """Clear all registered layouts. Useful for testing."""
        self._layouts.clear()

    def get_metadata(self) -> Dict[str, Dict[str, Any]]:
        """Get metadata for all registered layouts.

        :returns: Dictionary mapping layout IDs to metadata dicts. This is what gets sent to the frontend.
        :rtype: dict[str, dict[str, Any]]
        """
        return {
            layout_id: reg.to_metadata()
            for layout_id, reg in self._layouts.items()
        }


# Global registry instance
registry = LayoutRegistry()


# =============================================================================
# INTERNAL HELPERS
# =============================================================================


def _extract_parameters(func: Callable[..., Any]) -> List[LayoutParameter]:
    """Extract parameter information from a function signature.

    :param func: The function to inspect.
    :type func: Callable[..., Any]
    :returns: Parameter metadata for each function parameter.
    :rtype: list[LayoutParameter]
    """
    sig = inspect.signature(func)
    parameters: List[LayoutParameter] = []

    for param_name, param in sig.parameters.items():
        # Skip *args and **kwargs
        if param.kind in (
            inspect.Parameter.VAR_POSITIONAL,
            inspect.Parameter.VAR_KEYWORD,
        ):
            continue

        has_default = param.default is not inspect.Parameter.empty
        default = param.default if has_default else None

        # Get type annotation as string
        annotation: Optional[str] = None
        if param.annotation is not inspect.Parameter.empty:
            if isinstance(param.annotation, type):
                annotation = param.annotation.__name__
            else:
                annotation = str(param.annotation)

        parameters.append(
            LayoutParameter(
                name=param_name,
                has_default=has_default,
                default=default,
                annotation=annotation,
            )
        )

    return parameters


def _is_async_function(func: Callable[..., Any]) -> bool:
    """Check if a function is an async coroutine function.

    :param func: The function to check.
    :type func: Callable[..., Any]
    :returns: ``True`` if async, ``False`` otherwise.
    :rtype: bool
    """
    return inspect.iscoroutinefunction(func)


def _validate_registration(
    *,
    layout_id: str,
    name: Optional[str],
    description: str,
    keywords: Optional[List[str]],
    allow_multiple: bool,
    param_options: Optional[Dict[str, Tuple[str, Dict[str, Any]]]],
    layout: Any,
    callback: Optional[Callable[..., Any]],
) -> None:
    """Validate registration parameters.

    :param layout_id: Unique identifier for the layout.
    :type layout_id: str
    :param name: Display name.
    :type name: str | None
    :param description: Layout description.
    :type description: str
    :param keywords: Search keywords.
    :type keywords: list[str] | None
    :param allow_multiple: Whether multiple instances are allowed.
    :type allow_multiple: bool
    :param param_options: Parameter presets.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :param layout: Static layout component.
    :type layout: Any
    :param callback: Layout generator function.
    :type callback: Callable[..., Any] | None
    :raises ValueError: If validation fails.
    """
    if not layout_id:
        raise ValueError("Layout 'id' is required")

    if not isinstance(layout_id, str):
        raise ValueError(
            f"Layout 'id' must be a string, got {type(layout_id).__name__}"
        )

    if layout_id in registry:
        raise ValueError(f"Layout '{layout_id}' is already registered")

    if layout is None and callback is None:
        raise ValueError(
            "Either 'layout' (static) or a decorated function (callback) "
            "must be provided"
        )

    if layout is not None and callback is not None:
        raise ValueError(
            "Cannot specify both 'layout' (static) and a callback function. "
            "Use 'layout' for static layouts or decorate a function for "
            "dynamic layouts."
        )

    if param_options is not None:
        if not isinstance(param_options, dict):
            raise ValueError("'param_options' must be a dict")

        for key, value in param_options.items():
            if not isinstance(key, str):
                raise ValueError(
                    f"param_options keys must be strings, got {type(key).__name__}"
                )
            if not isinstance(value, tuple) or len(value) != 2:
                raise ValueError(
                    f"param_options['{key}'] must be a tuple of "
                    "(label: str, params: dict)"
                )
            label, params = value
            if not isinstance(label, str):
                raise ValueError(f"param_options['{key}'] label must be a string")
            if not isinstance(params, dict):
                raise ValueError(f"param_options['{key}'] params must be a dict")


def _validate_param_options(
    param_options: Dict[str, Tuple[str, Dict[str, Any]]],
    parameters: List[LayoutParameter],
) -> None:
    """Validate that param_options reference valid function parameters.

    :param param_options: The parameter options to validate.
    :type param_options: dict[str, tuple[str, dict[str, Any]]]
    :param parameters: The function's actual parameters.
    :type parameters: list[LayoutParameter]
    :raises ValueError: If param_options reference unknown parameters.
    """
    param_names = {p.name for p in parameters}
    for option_key, (_, params) in param_options.items():
        for param_name in params.keys():
            if param_name not in param_names:
                raise ValueError(
                    f"param_options['{option_key}'] references unknown parameter "
                    f"'{param_name}'. Valid parameters: {param_names}"
                )


# =============================================================================
# PUBLIC API - register_layout
# =============================================================================


@overload
def register_layout(
    id: str,  # noqa: A002
    *,
    name: Optional[str] = None,
    description: str = '',
    keywords: Optional[List[str]] = None,
    allow_multiple: bool = False,
    param_options: Optional[Dict[str, Tuple[str, Dict[str, Any]]]] = None,
    layout: Any,
) -> None:
    ...


@overload
def register_layout(
    id: str,  # noqa: A002
    *,
    name: Optional[str] = None,
    description: str = '',
    keywords: Optional[List[str]] = None,
    allow_multiple: bool = False,
    param_options: Optional[Dict[str, Tuple[str, Dict[str, Any]]]] = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    ...


def register_layout(
    id: str,  # noqa: A002
    *,
    name: Optional[str] = None,
    description: str = '',
    keywords: Optional[List[str]] = None,
    allow_multiple: bool = False,
    param_options: Optional[Dict[str, Tuple[str, Dict[str, Any]]]] = None,
    layout: Any = None,
) -> Union[None, Callable[[Callable[..., Any]], Callable[..., Any]]]:
    """Register a layout with Prism.

    Can be used in two ways:

    **Method A: Static Layout**::

        register_layout(
            id='home',
            name='Home',
            description='Welcome page',
            layout=html.Div([html.H1('Welcome!')])
        )

    **Method B: Decorator**::

        @register_layout(
            id='chart',
            name='Chart View',
            param_options={
                'bar': ('Bar Chart', {'chart_type': 'bar'}),
                'line': ('Line Chart', {'chart_type': 'line'}),
            }
        )
        def chart_layout(chart_type: str = 'bar'):
            return dcc.Graph(...)

    :param id: Unique identifier for this layout (required).
    :type id: str
    :param name: Human-readable display name. Defaults to ``id``.
    :type name: str | None
    :param description: Description shown in the layout picker.
    :type description: str
    :param keywords: Searchable keywords for finding this layout.
    :type keywords: list[str] | None
    :param allow_multiple: Whether multiple instances can be open simultaneously. Defaults to False.
    :type allow_multiple: bool
    :param param_options: Pre-defined parameter configurations. Format: ``{'key': ('Display Label', {'param': 'value'})}``.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :param layout: Static Dash component tree (Method A only).
    :type layout: Any | None
    :returns: None if registering a static layout, decorator function otherwise.
    :rtype: None | Callable[[Callable[..., Any]], Callable[..., Any]]
    :raises ValueError: If validation fails or layout is already registered.

    **Examples**

    Static registration::

        >>> register_layout(
        ...     id='about',
        ...     name='About',
        ...     layout=html.Div('About page'),
        ... )

    Decorator registration::

        >>> @register_layout(id='home', name='Home')
        ... def home_layout():
        ...     return html.Div('Welcome!')
    """
    # Method A: Static layout provided
    if layout is not None:
        _validate_registration(
            layout_id=id,
            name=name,
            description=description,
            keywords=keywords,
            allow_multiple=allow_multiple,
            param_options=param_options,
            layout=layout,
            callback=None,
        )

        registry.register(
            LayoutRegistration(
                id=id,
                name=name or id,
                description=description,
                keywords=keywords or [],
                allow_multiple=allow_multiple,
                layout=layout,
                callback=None,
                is_async=False,
                parameters=[],
                param_options=param_options,
            )
        )
        return None

    # Method B: Decorator mode
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        _validate_registration(
            layout_id=id,
            name=name,
            description=description,
            keywords=keywords,
            allow_multiple=allow_multiple,
            param_options=param_options,
            layout=None,
            callback=func,
        )

        parameters = _extract_parameters(func)
        is_async = _is_async_function(func)

        # Validate param_options against function signature
        if param_options:
            _validate_param_options(param_options, parameters)

        registry.register(
            LayoutRegistration(
                id=id,
                name=name or id,
                description=description,
                keywords=keywords or [],
                allow_multiple=allow_multiple,
                layout=None,
                callback=func,
                is_async=is_async,
                parameters=parameters,
                param_options=param_options,
            )
        )

        return func

    return decorator


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================


def get_layout(layout_id: str) -> Optional[LayoutRegistration]:
    """Get a registered layout by ID.

    :param layout_id: The ID of the layout to retrieve.
    :type layout_id: str
    :returns: The registration if found, None otherwise.
    :rtype: LayoutRegistration | None
    """
    return registry.get(layout_id)


def get_registered_layouts_metadata() -> Dict[str, Dict[str, Any]]:
    """Get metadata for all registered layouts.

    :returns: Dictionary mapping layout IDs to metadata dicts. Excludes actual components and callbacks.
    :rtype: dict[str, dict[str, Any]]
    """
    return registry.get_metadata()


def clear_registry() -> None:
    """Clear all registered layouts.

    Useful for testing to reset state between test cases.
    """
    registry.clear()
