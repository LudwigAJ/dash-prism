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
import types
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any, overload

from dash_prism import params

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
    :type parameters: list[params.LayoutParameter]
    :ivar param_options: Named sets of parameter values that the search bar
        offers as a list. Only a callback layout can have parameter options.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :ivar validator: The validator that registration builds from the signature
        of the callback. The validator changes each string that the browser
        sends into the type that the callback declares. It is ``None`` for a
        static layout.
    :type validator: PydanticValidator | None
    :ivar body_param: Deprecated, and always ``None``. Registration no longer
        sets this field, and nothing reads it. The validator keeps the name of
        the model parameter. The field stays until version 2.0, because code
        that makes a registration can give it.
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
    parameters: list[params.LayoutParameter] = field(default_factory=list)
    param_options: dict[str, tuple[str, dict[str, Any]]] | None = None
    # A validator holds a generated pydantic model, which has no useful repr or equality.
    validator: params.PydanticValidator | None = field(default=None, repr=False, compare=False)
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
        parameter_dicts = [] if self.param_options else [p.to_dict() for p in self.parameters]
        result: dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "keywords": self.keywords,
            "allowMultiple": self.allow_multiple,
            "params": parameter_dicts,
            "paramOptions": None,
        }

        if self.param_options:
            result["paramOptions"] = {
                key: {"description": label, "params": option_params}
                for key, (label, option_params) in self.param_options.items()
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
    def layouts(self) -> types.MappingProxyType[str, LayoutRegistration]:
        """A read-only view that maps each layout identifier to its registration.

        The view shows each later change to the registry. A change through the
        view raises :exc:`TypeError`. The registrations in the view are the
        same objects that the registry holds.
        """
        return types.MappingProxyType(self._layouts)

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
            raise ValueError(f"Layout is already registered: layout_id={registration.id!r}")
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


#: The process-wide :class:`LayoutRegistry`.
#:
#: :func:`dash_prism.register_layout` writes each new registration into this
#: registry. :func:`dash_prism.init` reads the registry one time, and puts the
#: layout metadata into the Prism component. An application thus uses this
#: registry and does not make its own.
registry = LayoutRegistry()


# =============================================================================
# INTERNAL HELPERS
# =============================================================================


def _validate_registration(
    *,
    layout_id: str,
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

    :param layout_id: The identifier for the layout.
    :type layout_id: str
    :param param_options: The named sets of parameter values, or ``None``.
    :type param_options: dict[str, tuple[str, dict[str, Any]]] | None
    :param layout: The static Dash component tree, or ``None``.
    :type layout: Any
    :param callback: The function that makes the layout, or ``None``.
    :type callback: Callable[..., Any] | None
    :raises ValueError: If one of the checks above fails. The message tells
        which check failed.
    """
    if not isinstance(layout_id, str):
        raise ValueError(f"Layout id is not a string: {layout_id=}")

    if not layout_id:
        raise ValueError("Layout id is an empty string")

    if layout_id in registry:
        raise ValueError(f"Layout is already registered: {layout_id=}")

    if layout is None and callback is None:
        raise ValueError(f"Layout has neither a static layout nor a callback: {layout_id=}")

    if layout is not None and callback is not None:
        raise ValueError(f"Layout has both a static layout and a callback: {layout_id=}")

    if param_options is not None and layout is not None:
        raise ValueError(
            f"param_options is given for a static layout: {layout_id=}. "
            "Only a callback layout accepts param_options."
        )

    if param_options is not None:
        if not isinstance(param_options, dict):
            raise ValueError(
                f"param_options is not a dict: {layout_id=}, "
                f"type={type(param_options).__name__!r}"
            )

        for key, value in param_options.items():
            if not isinstance(key, str):
                raise ValueError(
                    f"param_options has a key that is not a string: {layout_id=}, {key=}"
                )
            if not isinstance(value, tuple) or len(value) != 2:
                raise ValueError(
                    f"param_options[{key!r}] is not a (label, params) tuple: {layout_id=}"
                )
            label, option_params = value
            if not isinstance(label, str):
                raise ValueError(
                    f"param_options[{key!r}] has a label that is not a string: "
                    f"{layout_id=}, {label=}"
                )
            if not isinstance(option_params, dict):
                raise ValueError(
                    f"param_options[{key!r}] has params that are not a dict: {layout_id=}, "
                    f"type={type(option_params).__name__!r}"
                )


def _validate_param_options(
    param_options: dict[str, tuple[str, dict[str, Any]]],
    parameters: list[params.LayoutParameter],
    validator: params.PydanticValidator | None = None,
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
    :type parameters: list[params.LayoutParameter]
    :param validator: The validator of the layout, or ``None`` to check only
        the parameter names.
    :type validator: PydanticValidator | None
    :raises ValueError: If an option names a parameter that the callback does
        not declare, or if the validator rejects the values of an option.
    """
    param_names = {p.name for p in parameters}
    for option_key, (_, option_params) in param_options.items():
        for param_name in option_params:
            if param_name not in param_names:
                raise ValueError(
                    f"param_options[{option_key!r}] names a parameter that the callback "
                    f"does not declare: {param_name=}, declared={sorted(param_names)}"
                )
        if validator is not None:
            try:
                validator.validate(option_params)
            except params.ParamValidationError as exc:
                details = "; ".join(f"{e.field}: {e.message}" for e in exc.errors)
                raise ValueError(
                    f"param_options[{option_key!r}] failed validation: {details}"
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
    # An explicit empty name stays empty. Only an omitted name falls back to the id.
    if name is None:
        name = id
    if keywords is None:
        keywords = []

    if layout is not None:
        _validate_registration(
            layout_id=id, param_options=param_options, layout=layout, callback=None
        )
        registry.register(
            LayoutRegistration(
                id=id,
                name=name,
                description=description,
                keywords=keywords,
                allow_multiple=allow_multiple,
                layout=layout,
                callback=None,
                is_async=False,
                parameters=[],
                param_options=param_options,
            )
        )
        return None

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        _validate_registration(
            layout_id=id, param_options=param_options, layout=None, callback=func
        )

        spec = params.introspect_callable(func)  # raises ValueError for a mixed body model
        parameters = params.build_layout_parameters(spec)
        validator = params.build_validator(id, spec)

        if param_options:
            _validate_param_options(param_options, parameters, validator)

        registry.register(
            LayoutRegistration(
                id=id,
                name=name,
                description=description,
                keywords=keywords,
                allow_multiple=allow_multiple,
                layout=None,
                callback=func,
                is_async=inspect.iscoroutinefunction(func),
                parameters=parameters,
                param_options=param_options,
                validator=validator,
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
    layout_params: dict[str, Any] | None,
    layout_option: str | None,
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

    The validator of the layout then changes each string into the type that the
    callback declares. A static layout has no validator, thus the function
    returns its parameters unchanged.

    :param registration: The registration of the layout.
    :type registration: LayoutRegistration
    :param layout_params: The parameters that the client sent, or ``None`` for
        no parameters.
    :type layout_params: dict[str, Any] | None
    :param layout_option: The key of the selected option in
        ``registration.param_options``, or ``None``.
    :type layout_option: str | None
    :returns: The keyword arguments for the layout callback.
    :rtype: dict[str, Any]
    :raises ValueError: If ``layout_params`` is not a dictionary, if the layout
        declares ``param_options`` but ``layout_option`` is absent or is not a
        string, if ``layout_params`` and ``param_options`` are given together,
        if ``layout_option`` is not a key of ``param_options``, or if a
        ``layout_option`` is given for a layout that declares no
        ``param_options``.
    :raises ParamValidationError: If a parameter value is not valid.
    """
    layout_id = registration.id
    if layout_params is None:
        resolved_params: dict[str, Any] = {}
    elif not isinstance(layout_params, dict):
        raise ValueError(
            f"Request field layoutParams is not an object: {layout_id=}, "
            f"type={type(layout_params).__name__!r}"
        )
    else:
        resolved_params = layout_params

    # The checks below examine the request only. Registration already makes
    # sure that param_options belong to a callback layout and hold dicts.
    if registration.param_options:
        if layout_option is None:
            raise ValueError(
                "Request field layoutOption is missing, and the layout declares "
                f"param_options: {layout_id=}"
            )

        if resolved_params:
            raise ValueError(
                "Request field layoutParams is not empty, and the layout declares "
                f"param_options: {layout_id=}. The layout accepts values only through "
                "an option."
            )

        if not isinstance(layout_option, str):
            raise ValueError(
                f"Request field layoutOption is not a string: {layout_id=}, "
                f"type={type(layout_option).__name__!r}"
            )

        option_entry = registration.param_options.get(layout_option)
        if not option_entry:
            raise ValueError(
                "Request field layoutOption is not a key of param_options: "
                f"{layout_id=}, layoutOption={layout_option!r}"
            )

        _, option_params = option_entry
        resolved_params = dict(option_params)
    elif layout_option is not None:
        raise ValueError(
            "Request field layoutOption is given, and the layout declares no "
            f"param_options: {layout_id=}"
        )

    if registration.validator is None:
        return resolved_params
    return registration.validator.validate(resolved_params)


def clear_registry() -> None:
    """Remove every layout from the process-wide registry.

    Tests call this function to reset the registry before the next test.
    """
    registry.clear()
