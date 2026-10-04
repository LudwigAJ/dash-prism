"""
Layout Registry for Prism
=========================

This module keeps the layouts that Prism can open in a tab. A registration
holds the metadata that the search bar shows, and either a Dash component tree
or a callback that makes one.

A layout is one of two kinds. A static layout is a component tree that you
build one time. Prism renders the same tree in every tab that opens the layout.
A callback layout is a function. Prism calls the function each time Prism
renders a tab, and the function receives the parameters that the user selected.

:func:`register_layout` puts a registration into the process-wide
:data:`registry`. :func:`dash_prism.init` reads the registry one time and sends
the metadata to the frontend as the ``registeredLayouts`` prop of the Prism
component. An application thus registers every layout before it calls
:func:`dash_prism.init`.

Usage Examples
--------------

The example that follows registers a static layout::

    register_layout(
        id='home',
        name='Home',
        layout=html.Div('Welcome!')
    )

The example that follows registers a callback layout, and gives the two
parameter options that the search bar shows::

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
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any, overload

from .params import (
    LayoutParameter,  # params.py holds this class. registry.py re-exports it.
    ParamValidationError,
    PydanticValidator,
    build_layout_parameters,
    build_validator,
    introspect_callable,
)

__all__ = [
    "LayoutParameter",
    "LayoutRegistration",
    "LayoutRegistry",
    "registry",
    "register_layout",
    "get_layout",
    "get_registered_layouts_metadata",
    "resolve_layout_params",
    "clear_registry",
]

# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class LayoutRegistration:
    """One layout that is registered with Prism.

    :func:`register_layout` makes a registration and puts it into the
    :data:`registry`. A registration holds either ``layout``, which is a static
    Dash component tree, or ``callback``, which is a function that makes such a
    tree. A registration does not hold the two together.

    :ivar id: The identifier of this layout. No two registrations in one
        registry can have the same identifier.
    :type id: str
    :ivar name: The name that Prism shows in the search bar and on the tab.
    :type name: str
    :ivar description: The text that the search bar shows next to the name.
    :type description: str
    :ivar keywords: More words that the search bar examines when the user types
        a query. The search bar also examines the identifier, the name, and the
        description.
    :type keywords: list[str]
    :ivar allow_multiple: If this is ``False``, Prism prevents a new tab of this
        layout while a tab of this layout is open. This applies both when the
        user opens a layout and when the user duplicates a tab.
    :type allow_multiple: bool
    :ivar layout: The static Dash component tree. It is ``None`` for a callback
        layout.
    :type layout: Any
    :ivar callback: The function that makes the component tree. It is ``None``
        for a static layout.
    :type callback: Callable[..., Any] | None
    :ivar is_async: ``True`` if the callback is a coroutine function.
        :func:`dash_prism.init` reads this field to know if it must await the
        callback.
    :type is_async: bool
    :ivar parameters: One ``LayoutParameter`` for each parameter of the
        callback. The list is empty for a static layout.
    :type parameters: list[LayoutParameter]
    :ivar param_options: Named sets of parameter values that the search bar
        offers as a list. Only a callback layout can have parameter options.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :ivar validator: The validator that registration builds from the signature
        of the callback. The validator changes each string that the browser
        sends into the type that the callback declares. It is ``None`` for a
        static layout.
    :type validator: PydanticValidator | None
    :ivar body_param: The name of the one pydantic ``BaseModel`` parameter, if
        the callback declares such a parameter. If not, it is ``None``.
    :type body_param: str | None
    """

    id: str
    name: str
    description: str = ""
    keywords: list[str] = field(default_factory=list)
    allow_multiple: bool = False
    layout: Any = None
    callback: Callable[..., Any] | None = None
    is_async: bool = False
    parameters: list[LayoutParameter] = field(default_factory=list)
    param_options: dict[str, tuple[str, dict[str, Any]]] | None = None
    validator: PydanticValidator | None = field(default=None, repr=False, compare=False)
    body_param: str | None = None

    @property
    def is_callable(self) -> bool:
        """Tell if a callback makes this layout.

        :returns: ``True`` if the registration holds a callback, ``False`` if
            the registration holds a static component tree.
        :rtype: bool
        """
        return self.callback is not None

    def to_metadata(self) -> dict[str, Any]:
        """Make the metadata dictionary that the frontend receives.

        The dictionary does **not** hold the layout component or the callback
        function, because Prism cannot serialize them into JSON.

        The ``"params"`` key has two possible contents. If the registration has
        parameter options, ``"params"`` is an empty list and ``"paramOptions"``
        holds one entry for each option. The search bar then shows the list of
        options in place of the parameter fields, and
        :func:`resolve_layout_params` accepts values only through an option. If
        the registration has no parameter options, ``"params"`` holds one
        dictionary for each parameter of the callback, and ``"paramOptions"``
        is ``None``.

        Each entry in ``"paramOptions"`` holds two keys. The ``"description"``
        key holds the label of the option, which the search bar shows next to
        the key of the option. The ``"params"`` key holds the parameter values
        of the option.

        :returns: The metadata dictionary, with camelCase keys.
        :rtype: dict[str, Any]
        """
        params = [] if self.param_options else [p.to_dict() for p in self.parameters]
        result: dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "keywords": self.keywords,
            "allowMultiple": self.allow_multiple,
            "params": params,
            "paramOptions": None,
        }

        if self.param_options:
            result["paramOptions"] = {
                key: {"description": label, "params": params}
                for key, (label, params) in self.param_options.items()
            }

        return result


# =============================================================================
# REGISTRY CLASS
# =============================================================================


class LayoutRegistry:
    """A collection of the layouts that Prism can open.

    The registry maps each layout identifier to its ``LayoutRegistration``.
    ``len(registry)`` gives the number of layouts, ``'home' in registry`` tells
    you if an identifier is registered, and a ``for`` loop over the registry
    gives each identifier.

    An application uses the process-wide :data:`registry` object that this
    module makes, because :func:`register_layout` writes only to that object.

    **Example**::

        >>> registry = LayoutRegistry()
        >>> len(registry)
        0
        >>> 'home' in registry
        False
    """

    def __init__(self) -> None:
        self._layouts: dict[str, LayoutRegistration] = {}

    @property
    def layouts(self) -> dict[str, LayoutRegistration]:
        """Get a copy of the dictionary of registered layouts.

        The caller receives a new dictionary, thus a change to the result does
        not change the registry. The registrations in the result are the same
        objects that the registry holds.

        :returns: A dictionary that maps each layout identifier to its
            registration.
        :rtype: dict[str, LayoutRegistration]
        """
        return self._layouts.copy()

    def __contains__(self, layout_id: str) -> bool:
        """Tell if a layout identifier is registered."""
        return layout_id in self._layouts

    def __len__(self) -> int:
        """Return the number of registered layouts."""
        return len(self._layouts)

    def __iter__(self) -> Iterator[str]:
        """Return an iterator over the registered layout identifiers."""
        return iter(self._layouts)

    def get(self, layout_id: str) -> LayoutRegistration | None:
        """Get the registration of one layout.

        :param layout_id: The identifier of the layout.
        :type layout_id: str
        :returns: The registration, or ``None`` if no layout has that
            identifier.
        :rtype: LayoutRegistration | None
        """
        return self._layouts.get(layout_id)

    def register(self, registration: LayoutRegistration) -> None:
        """Add a registration to the registry.

        The identifier of the registration becomes its key. The registry does
        not replace a layout that is already registered.

        :param registration: The registration to add.
        :type registration: LayoutRegistration
        :raises ValueError: If a layout with the same identifier is already
            registered.
        """
        if registration.id in self._layouts:
            raise ValueError(f"Layout '{registration.id}' is already registered")
        self._layouts[registration.id] = registration

    def unregister(self, layout_id: str) -> bool:
        """Remove one layout from the registry.

        :param layout_id: The identifier of the layout to remove.
        :type layout_id: str
        :returns: ``True`` if the registry removed the layout, ``False`` if no
            layout has that identifier.
        :rtype: bool
        """
        if layout_id in self._layouts:
            del self._layouts[layout_id]
            return True
        return False

    def clear(self) -> None:
        """Remove all layouts from the registry.

        Tests call this method to reset the registry before the next test.
        """
        self._layouts.clear()

    def get_metadata(self) -> dict[str, dict[str, Any]]:
        """Make the metadata for every layout in this registry.

        :func:`dash_prism.init` gets this metadata one time and puts it into
        the ``registeredLayouts`` prop of the Prism component.

        :returns: A dictionary that maps each layout identifier to the result
            of :meth:`LayoutRegistration.to_metadata`.
        :rtype: dict[str, dict[str, Any]]
        """
        return {layout_id: reg.to_metadata() for layout_id, reg in self._layouts.items()}


# The one registry that this process shares.
registry = LayoutRegistry()
"""The process-wide :class:`LayoutRegistry`.

:func:`dash_prism.register_layout` writes each new registration into this
registry. :func:`dash_prism.init` reads the registry one time, and puts the
layout metadata into the Prism component. An application thus uses this
registry and does not make its own.
"""


# =============================================================================
# INTERNAL HELPERS
# =============================================================================


def _is_async_function(func: Callable[..., Any]) -> bool:
    """Tell if a function is a coroutine function.

    The registration keeps the result as ``is_async``. :func:`dash_prism.init`
    reads that field to know if it must await the callback.

    :param func: The function to examine.
    :type func: Callable[..., Any]
    :returns: ``True`` if ``func`` is a coroutine function, ``False`` if not.
    :rtype: bool
    """
    return inspect.iscoroutinefunction(func)


def _validate_registration(
    *,
    layout_id: str,
    name: str | None,
    description: str,
    keywords: list[str] | None,
    allow_multiple: bool,
    param_options: dict[str, tuple[str, dict[str, Any]]] | None,
    layout: Any,
    callback: Callable[..., Any] | None,
) -> None:
    """Validate the arguments that :func:`register_layout` received.

    The function makes the checks that follow:

    - ``layout_id`` is not empty, is a string, and is not already a key of the
      process-wide :data:`registry`.
    - One of ``layout`` and ``callback`` is given, and not the two together.
    - ``param_options`` is absent for a static layout.
    - Each key of ``param_options`` is a string, and each value is a tuple of
      a string label and a dictionary of parameter values.

    The function accepts ``name``, ``description``, ``keywords`` and
    ``allow_multiple`` so that the two registration methods can give it one set
    of arguments. The function does not examine those four arguments.

    :param layout_id: The identifier for the layout.
    :type layout_id: str
    :param name: The name to show, or ``None`` to use the identifier.
    :type name: str | None
    :param description: The description of the layout.
    :type description: str
    :param keywords: The keywords for the search bar.
    :type keywords: list[str] | None
    :param allow_multiple: ``True`` if more than one tab of this layout can be
        open at the same time.
    :type allow_multiple: bool
    :param param_options: The named sets of parameter values, or ``None``.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :param layout: The static Dash component tree, or ``None``.
    :type layout: Any
    :param callback: The function that makes the layout, or ``None``.
    :type callback: Callable[..., Any] | None
    :raises ValueError: If one of the checks above fails. The message tells
        which check failed.
    """
    if not layout_id:
        raise ValueError("Layout 'id' is required")

    if not isinstance(layout_id, str):
        raise ValueError(f"Layout 'id' must be a string, got {type(layout_id).__name__}")

    if layout_id in registry:
        raise ValueError(f"Layout '{layout_id}' is already registered")

    if layout is None and callback is None:
        raise ValueError(
            "Either 'layout' (static) or a decorated function (callback) " "must be provided"
        )

    if layout is not None and callback is not None:
        raise ValueError(
            "Cannot specify both 'layout' (static) and a callback function. "
            "Use 'layout' for static layouts or decorate a function for "
            "dynamic layouts."
        )

    if param_options is not None and layout is not None:
        raise ValueError("'param_options' is only supported for callback layouts")

    if param_options is not None:
        if not isinstance(param_options, dict):
            raise ValueError("'param_options' must be a dict")

        for key, value in param_options.items():
            if not isinstance(key, str):
                raise ValueError(f"param_options keys must be strings, got {type(key).__name__}")
            if not isinstance(value, tuple) or len(value) != 2:
                raise ValueError(
                    f"param_options['{key}'] must be a tuple of " "(label: str, params: dict)"
                )
            label, params = value
            if not isinstance(label, str):
                raise ValueError(f"param_options['{key}'] label must be a string")
            if not isinstance(params, dict):
                raise ValueError(f"param_options['{key}'] params must be a dict")


def _validate_param_options(
    param_options: dict[str, tuple[str, dict[str, Any]]],
    parameters: list[LayoutParameter],
    validator: PydanticValidator | None = None,
) -> None:
    """Validate the parameter options of a callback layout.

    Each option maps a key to a label and to a dictionary of parameter values.
    Every parameter name in that dictionary must be the name of a parameter of
    the callback.

    When ``validator`` is given, the validator also validates the values of
    each option. A bad option thus raises ``ValueError`` at registration, and
    not when Prism renders a tab. The function does not keep the values that
    the validator returns. The registration keeps the values that the option
    declares, and :func:`resolve_layout_params` validates them again each time
    Prism renders a tab.

    :param param_options: The parameter options to validate.
    :type param_options: dict[str, tuple[str, dict[str, Any]]]
    :param parameters: The parameters that the callback declares.
    :type parameters: list[LayoutParameter]
    :param validator: The validator of the layout, or ``None`` to check only
        the parameter names.
    :type validator: PydanticValidator | None
    :raises ValueError: If an option names a parameter that the callback does
        not declare, or if the validator rejects the values of an option.
    """
    param_names = {p.name for p in parameters}
    for option_key, (_, params) in param_options.items():
        for param_name in params:
            if param_name not in param_names:
                raise ValueError(
                    f"param_options['{option_key}'] references unknown parameter "
                    f"'{param_name}'. Valid parameters: {param_names}"
                )
        if validator is not None:
            try:
                validator.validate(params)
            except ParamValidationError as exc:
                details = "; ".join(f"{e.field}: {e.message}" for e in exc.errors)
                raise ValueError(
                    f"param_options['{option_key}'] failed validation: {details}"
                ) from None


# =============================================================================
# PUBLIC API - register_layout
# =============================================================================


@overload
def register_layout(
    id: str,  # noqa: A002
    *,
    name: str | None = None,
    description: str = "",
    keywords: list[str] | None = None,
    allow_multiple: bool = False,
    param_options: dict[str, tuple[str, dict[str, Any]]] | None = None,
    layout: Any,
) -> None: ...


@overload
def register_layout(
    id: str,  # noqa: A002
    *,
    name: str | None = None,
    description: str = "",
    keywords: list[str] | None = None,
    allow_multiple: bool = False,
    param_options: dict[str, tuple[str, dict[str, Any]]] | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]: ...


def register_layout(
    id: str,  # noqa: A002
    *,
    name: str | None = None,
    description: str = "",
    keywords: list[str] | None = None,
    allow_multiple: bool = False,
    param_options: dict[str, tuple[str, dict[str, Any]]] | None = None,
    layout: Any = None,
) -> None | Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Register a layout with Prism.

    There are two ways to call this function. If you give the ``layout``
    argument, the function registers a static component tree and returns
    ``None``. If you do not give ``layout``, the function returns a decorator,
    and that decorator registers the function below it as a callback layout.

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

    For a callback layout the function reads the signature of the callback.
    From that signature the function makes the parameter metadata that the
    search bar shows, and a validator for the values that the browser sends back.
    The function registers the layout immediately, thus your application must
    register every layout before it calls :func:`dash_prism.init`.

    :param id: The identifier for this layout. You must give this argument,
        and no other registered layout can have the same identifier.
    :type id: str
    :param name: The name that Prism shows in the search bar and on the tab.
        The default is the value of ``id``.
    :type name: str | None
    :param description: The text that the search bar shows next to the name.
    :type description: str
    :param keywords: More words that the search bar examines when the user
        types a query.
    :type keywords: list[str] | None
    :param allow_multiple: If this is ``False`` (the default), Prism prevents a
        new tab of this layout while a tab of this layout is open.
    :type allow_multiple: bool
    :param param_options: Named sets of parameter values, for a callback layout
        only. Format: ``{'key': ('Display Label', {'param': 'value'})}``. The
        search bar shows the key of each option, and shows the label next to
        the key. A layout that has parameter options accepts values only
        through an option.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :param layout: A static Dash component tree. Give this argument for Method
        A only.
    :type layout: Any | None
    :returns: ``None`` for a static layout, or the decorator for a callback
        layout.
    :rtype: None | Callable[[Callable[..., Any]], Callable[..., Any]]
    :raises ValueError: If one of these conditions is true:

        - The ``id`` is empty, is not a string, or is already registered.
        - You give ``layout`` and ``param_options`` together.
        - The ``param_options`` argument has a bad shape or a bad value.
        - The callback mixes a pydantic ``BaseModel`` parameter with other
          parameters.
        - A parameter declares a choice list that is empty, that holds scalar
          values for a collection parameter, or that allows a different set of
          values than its own annotation.

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
    # Method A: the caller gave a static component tree.
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

    # Method B: the caller wants the decorator.
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

        spec = introspect_callable(func)  # raises ValueError for a mixed body model
        parameters = build_layout_parameters(spec)
        validator = build_validator(id, spec)
        is_async = _is_async_function(func)

        if param_options:
            _validate_param_options(param_options, parameters, validator)

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
                validator=validator,
                body_param=spec.body_param,
            )
        )

        return func

    return decorator


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================


def get_layout(layout_id: str) -> LayoutRegistration | None:
    """Get the registration of one layout from the process-wide registry.

    :param layout_id: The identifier of the layout.
    :type layout_id: str
    :returns: The registration, or ``None`` if no layout has that identifier.
    :rtype: LayoutRegistration | None
    """
    return registry.get(layout_id)


def get_registered_layouts_metadata() -> dict[str, dict[str, Any]]:
    """Make the metadata for every layout in the process-wide registry.

    :func:`dash_prism.init` calls this function one time, and puts the result
    into the ``registeredLayouts`` prop of the Prism component. The result
    holds no layout component and no callback function.

    :returns: A dictionary that maps each layout identifier to its metadata.
    :rtype: dict[str, dict[str, Any]]
    """
    return registry.get_metadata()


def resolve_layout_params(
    registration: LayoutRegistration,
    layout_id: str,
    layout_params: dict[str, Any] | None,
    layout_option: str | None,
    *,
    validate: bool = True,
) -> dict[str, Any]:
    """Resolve the parameters for one tab of a layout.

    This function is the one place that resolves parameters.
    :func:`dash_prism.init` calls this function before Prism renders a tab,
    both on the sync path and on the async path. The function decides which
    parameters the layout callback receives, and it rejects a request that does
    not agree with the registration.

    A layout that declares ``param_options`` accepts values only through an
    option. For such a layout the caller must give ``layout_option`` and must
    not give ``layout_params``. The function then resolves to a copy of the
    values of that option.

    A layout that does not declare ``param_options`` accepts ``layout_params``,
    and the caller must not give a ``layout_option``.

    :param registration: The registration of the layout.
    :type registration: LayoutRegistration
    :param layout_id: The identifier of the layout. The function puts this
        identifier into its error messages.
    :type layout_id: str
    :param layout_params: The parameters that the client sent, or ``None`` for
        no parameters.
    :type layout_params: dict[str, Any] | None
    :param layout_option: The key of the selected option in
        ``registration.param_options``, or ``None``.
    :type layout_option: str | None
    :param validate: If this is ``True`` (the default), the function gives the
        resolved parameters to the validator of the layout. The validator
        changes each string into the type that the callback declares. A static
        layout has no validator, thus the function returns the parameters
        unchanged.
    :type validate: bool
    :returns: The keyword arguments for the layout callback.
    :rtype: dict[str, Any]
    :raises ValueError: If ``layout_params`` is not a dictionary, if the layout
        declares ``param_options`` but ``layout_option`` is absent or is not a
        string, if ``layout_params`` and ``param_options`` are given together,
        if ``layout_option`` is not a key of ``param_options``, or if a
        ``layout_option`` is given for a layout that declares no
        ``param_options``.
    :raises ParamValidationError: If ``validate`` is ``True`` and a parameter
        value is not valid.
    """
    # Examine the layout_params input.
    if layout_params is None:
        resolved_params: dict[str, Any] = {}
    elif not isinstance(layout_params, dict):
        raise ValueError(
            f"layoutParams must be an object/dict for layout '{layout_id}', "
            f"got {type(layout_params).__name__}"
        )
    else:
        resolved_params = layout_params

    # A layout with param_options resolves through an option, not through
    # layout_params.
    if registration.param_options:
        if layout_option is None:
            raise ValueError(
                f"Layout '{layout_id}' requires layoutOption when param_options is defined."
            )

        if resolved_params:
            raise ValueError(
                f"Layout '{layout_id}' accepts parameters only through param_options. "
                "layoutParams are not supported."
            )

        if not isinstance(layout_option, str):
            raise ValueError(
                f"layoutOption must be a string for layout '{layout_id}', "
                f"got {type(layout_option).__name__}"
            )

        if not registration.is_callable or registration.callback is None:
            raise ValueError(
                f"Layout options are only supported for callback layouts. "
                f"Layout '{layout_id}' is static."
            )

        option_entry = registration.param_options.get(layout_option)
        if not option_entry:
            raise ValueError(f"Layout option '{layout_option}' not found for layout '{layout_id}'.")

        _, option_params = option_entry
        if not isinstance(option_params, dict):
            raise ValueError(
                f"param_options for layout '{layout_id}' must map to a dict of params."
            )

        return _validated(registration, dict(option_params), validate)

    # A layout_option without param_options is an error.
    if layout_option is not None:
        raise ValueError(
            f"Layout '{layout_id}' does not define param_options but layoutOption was provided."
        )

    return _validated(registration, resolved_params, validate)


def _validated(
    registration: LayoutRegistration, params: dict[str, Any], validate: bool
) -> dict[str, Any]:
    """Give ``params`` to the validator of the registration, if there is one.

    :param registration: The registration whose validator to use.
    :type registration: LayoutRegistration
    :param params: The parameters to validate.
    :type params: dict[str, Any]
    :param validate: If this is ``False``, the function returns ``params``
        unchanged.
    :type validate: bool
    :returns: The validated parameters, or ``params`` unchanged when
        ``validate`` is ``False`` or the registration has no validator.
    :rtype: dict[str, Any]
    :raises ParamValidationError: If a parameter value is not valid.
    """
    if not validate or registration.validator is None:
        return params
    return registration.validator.validate(params)  # raises ParamValidationError


def clear_registry() -> None:
    """Remove every layout from the process-wide registry.

    Tests call this function to reset the registry before the next test.
    """
    registry.clear()
