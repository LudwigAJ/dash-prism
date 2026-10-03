"""
Prism Initialization
====================

This module supplies the :func:`dash_prism.init` function. That function connects
Prism to a Dash app. You must call that function after you register your layouts
and after you set ``app.layout``.

Responsibilities
----------------

- It injects the metadata of the registered layouts into the Prism component.
- It makes the Dash callback that renders the contents of a tab. The callback is
  sync or async.
- It validates the setup and raises clear error messages.

Async Handling
--------------

- If the Dash app has ``use_async=True``, ``init`` registers an async callback.
  That callback awaits an async layout, and runs a sync layout in the default
  executor. The timeout applies to the two kinds of layout.
- If the Dash app has ``use_async=False``, ``init`` registers a sync callback.
  That callback calls a sync layout directly, and runs an async layout through
  ``asyncio.run()``. The timeout applies to an async layout only.
"""

from __future__ import annotations

import asyncio
import copy
import functools
import hashlib
import inspect
import logging
import math
import traceback
import warnings
from collections.abc import Awaitable, Callable, Iterable
from typing import Any, ParamSpec, TypeVar, cast
from weakref import WeakSet

from dash import MATCH, Dash, Input, Output, html
from dash.exceptions import PreventUpdate

# dash_prism/__init__.py imports this module before it rebinds the name
# ``registry`` to the registry object, so this import gets the module.
from dash_prism import params, registry, utils

logger = logging.getLogger(__name__)

#: The number of seconds that a layout callback can take before the tab shows an
#: error. This value is the same as the default of the ``layoutTimeout`` prop on
#: :class:`dash_prism.Prism`.
DEFAULT_LAYOUT_TIMEOUT: float = 30.0

_P = ParamSpec("_P")
_R = TypeVar("_R")

# Holds the layout wrappers that init() made. A second call to init() finds its
# own wrapper in app.layout and does not wrap that wrapper again.
_wrapped_layouts: WeakSet[Callable] = WeakSet()


class InitializationError(Exception):
    """The setup is not correct, and :func:`dash_prism.init` cannot connect Prism to the Dash app.

    ``init`` raises this exception in four conditions. The ``app`` argument is
    not a Dash application. The ``prism_id`` argument is not a string that has
    content. The ``app.layout`` attribute is not set. The ``initialLayout`` prop
    names a layout that is not in the registry.

    ``init`` reports the problems together, one for each line of the message.
    """


def _compute_server_session_id(layout_ids: Iterable[str]) -> str:
    """Make a fingerprint of the set of registered layout IDs.

    The function sorts the IDs before it makes the hash. Thus the fingerprint is
    identical on every worker and after a restart, for the same set of layouts.
    The fingerprint changes when you add a layout or remove a layout.

    The frontend stores the fingerprint with the persisted workspace. On load,
    the frontend closes the tabs whose layouts are not in ``registeredLayouts``,
    and then records the new fingerprint. For more data, see the
    ``serverSessionId`` prop of :class:`dash_prism.Prism`.

    :param layout_ids: The registered layout IDs. The order does not matter.
    :type layout_ids: Iterable[str]
    :returns: A hexadecimal fingerprint of 12 characters.
    :rtype: str
    """
    joined = "\n".join(sorted(layout_ids))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:12]


def _inject_metadata_into_layout(
    layout_tree: Any,
    prism_id: str,
    layouts_metadata: dict[str, Any],
    session_id: str,
) -> Any:
    """Find the Prism component in a layout tree and write the metadata to it.

    The function changes the Prism component in place, and returns the same
    layout tree object. If the tree holds no component with the ID ``prism_id``,
    the function changes nothing. The function writes ``serverSessionId`` only
    when that prop is ``None`` or is not set, so a value that you gave by hand
    stays. If a layout function returned ``None``, the function writes a warning
    to the log and returns ``None``.

    :param layout_tree: The layout component tree to search.
    :type layout_tree: Any
    :param prism_id: The ID of the Prism component to write the metadata to.
    :type prism_id: str
    :param layouts_metadata: The metadata of the registered layouts. The
        function writes it to the ``registeredLayouts`` prop.
    :type layouts_metadata: dict[str, Any]
    :param session_id: The fingerprint of the layout registry. The function
        writes it to the ``serverSessionId`` prop.
    :type session_id: str
    :returns: The same layout tree that you supplied, or ``None`` if
        ``layout_tree`` was ``None``.
    :rtype: Any
    """
    if layout_tree is None:
        logger.warning(
            "Layout function returned None. Prism component '%s' may not be available.", prism_id
        )
        return None

    prism = utils.find_component_by_id(layout_tree, prism_id)
    if prism is not None:
        prism.registeredLayouts = layouts_metadata
        if getattr(prism, "serverSessionId", None) is None:
            prism.serverSessionId = session_id
    return layout_tree


def _create_layout_wrapper(
    original_layout: Callable[_P, _R],
    prism_id: str,
    layouts_metadata: dict[str, Any],
    session_id: str,
    is_async: bool,
) -> Callable[_P, _R]:
    """Make a wrapper that injects the Prism metadata into a callable layout.

    Dash calls a callable layout again for each page request. The wrapper thus
    injects the metadata again for each page request. The wrapper holds
    ``prism_id``, ``layouts_metadata`` and ``session_id`` in a closure, so it
    does not read the layout registry at render time.

    The wrapper keeps the signature (``_P``) and the return type (``_R``) of the
    original layout function. It changes only the tree that the function
    returns. If the original layout function raises an exception, the wrapper
    writes the traceback to the log and raises the same exception again.

    :param original_layout: The layout function to wrap.
    :type original_layout: Callable
    :param prism_id: The ID of the Prism component to write the metadata to.
    :type prism_id: str
    :param layouts_metadata: The metadata of the registered layouts.
    :type layouts_metadata: dict[str, Any]
    :param session_id: The fingerprint of the layout registry.
    :type session_id: str
    :param is_async: Set this to ``True`` if ``original_layout`` is a coroutine
        function. The factory then makes an async wrapper.
    :type is_async: bool
    :returns: The wrapped layout function. The wrapper is async if ``is_async``
        is ``True``, and sync if ``is_async`` is ``False``.
    :rtype: Callable
    """
    if is_async:

        @functools.wraps(original_layout)
        async def async_wrapper(*args: _P.args, **kwargs: _P.kwargs) -> Any:
            try:
                # _R is the coroutine type for an async layout. mypy cannot see that.
                layout_tree = await cast(Awaitable[Any], original_layout(*args, **kwargs))
            except Exception:
                logger.exception("Error in async layout function")
                raise

            return _inject_metadata_into_layout(layout_tree, prism_id, layouts_metadata, session_id)

        return cast(Callable[_P, _R], async_wrapper)
    else:

        @functools.wraps(original_layout)
        def sync_wrapper(*args: _P.args, **kwargs: _P.kwargs) -> Any:
            try:
                layout_tree = original_layout(*args, **kwargs)
            except Exception:
                logger.exception("Error in sync layout function")
                raise

            return _inject_metadata_into_layout(layout_tree, prism_id, layouts_metadata, session_id)

        return cast(Callable[_P, _R], sync_wrapper)


def _get_layout_root(app: Dash) -> Any | None:
    """Resolve the root of the app layout, and call a layout function if necessary.

    ``app.layout`` is a component tree or a function that returns one. If it is
    a sync function, this function calls it with no arguments. If it is a
    coroutine function, this function returns ``None``, because it cannot await
    the coroutine here. Prism then validates the Prism component at render time
    instead.

    If the call to the layout function raises an exception, this function sends
    a :class:`UserWarning`, writes the traceback to the log, and returns
    ``None``.

    :param app: The Dash application instance.
    :type app: Dash
    :returns: The layout root. The function returns ``None`` if ``app.layout``
        is a coroutine function, or if the call to ``app.layout()`` failed.
    :rtype: Any | None
    """
    layout = getattr(app, "layout", None)

    if not callable(layout):
        return layout

    # Prism cannot validate an async layout here, because this function is sync
    # and cannot await the coroutine.
    if inspect.iscoroutinefunction(layout):
        logger.info(
            "Skipping Prism component validation for async callable layout. "
            "Validation will occur at runtime when layout is first rendered."
        )
        return None

    try:
        return layout()
    except Exception:  # pragma: no cover - depends on app layout
        warnings.warn(
            "Failed to call app.layout() while searching for the Prism component. "
            "Make sure that your layout function can be called with no arguments.",
            UserWarning,
            stacklevel=3,
        )
        logger.exception("Failed to call app.layout() while searching for Prism")
        return None


def _is_app_async(app: Dash) -> bool:
    """Find out whether the Dash app is set to use async callbacks.

    :param app: The Dash application instance.
    :type app: Dash
    :returns: ``True`` if you made the app with ``use_async=True``. The result
        is ``False`` if you did not, and also ``False`` on a Dash version that
        does not know the ``use_async`` argument.
    :rtype: bool
    """
    # Dash keeps the async mode in a private attribute.
    return getattr(app, "_use_async", False)


def _validate_init(app: Dash, prism_id: str) -> list[str]:
    """Do the checks that must pass before :func:`init` can continue.

    The function does three checks:

    - The ``app`` argument has a ``callback`` attribute, which shows that it is
      a Dash application.
    - The ``prism_id`` argument is a string that is not empty.
    - The app has a ``layout`` attribute, and that attribute is not ``None``.

    The function collects all the problems. It does not stop at the first
    problem. Thus :func:`init` can report the problems together.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The ID of the Prism component.
    :type prism_id: str
    :returns: The list of error messages. The list is empty if the setup is
        correct.
    :rtype: list[str]
    """
    errors: list[str] = []

    if not hasattr(app, "callback"):
        errors.append("Invalid 'app' argument: expected a Dash application instance")

    if not prism_id or not isinstance(prism_id, str):
        errors.append("Invalid 'prism_id': must be a non-empty string")

    if not hasattr(app, "layout") or app.layout is None:
        errors.append(
            "app.layout must be set before calling init(). "
            "Make sure you define app.layout = ... before calling dash_prism.init()"
        )

    return errors


def _validate_prism_component(app: Dash, prism_id: str) -> Any | None:
    """Find the Prism component in the app layout and check its type.

    The function sends a :class:`UserWarning` if the layout holds no component
    with the ID ``prism_id``. It sends a different :class:`UserWarning` if the
    component that it finds is not a Prism component. A warning does not stop
    :func:`init`.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The ID of the Prism component.
    :type prism_id: str
    :returns: The component that has the ID ``prism_id``, or ``None`` if the
        layout holds no such component. The function returns the component even
        when the type of that component is not Prism.
    :rtype: Any | None
    """
    layout_root = _get_layout_root(app)
    prism_component = utils.find_component_by_id(layout_root, prism_id)

    if prism_component is None:
        warnings.warn(
            f"Could not find Prism component with id='{prism_id}' in app.layout. "
            "The Prism component must exist in app.layout when init() is called. "
            "If the layout is a function, make sure that it returns the Prism component.",
            UserWarning,
            stacklevel=3,
        )
        return None

    component_type = getattr(prism_component, "_type", None)
    if component_type != "Prism":
        warnings.warn(
            f"Component with id='{prism_id}' is not a Prism component "
            f"(found {component_type}). Make sure you're using dash_prism.Prism().",
            UserWarning,
            stacklevel=3,
        )

    return prism_component


def _check_registry(prism_component: Any | None) -> None:
    """Check the registry against the Prism component, and warn about problems.

    The function sends a :class:`UserWarning` if no layout is registered. A
    warning does not stop :func:`init`. If the ``initialLayout`` prop of the
    Prism component names a layout that is not registered, the function raises
    an error, because the Prism component could not open that layout.

    :param prism_component: The Prism component from the app layout, or
        ``None`` if the layout holds no Prism component.
    :type prism_component: Any | None
    :raises InitializationError: If ``initialLayout`` names a layout that is not
        in the registry.
    """
    if not registry.registry:
        warnings.warn(
            "No layouts registered. Register layouts with "
            "@dash_prism.register_layout() before calling init().",
            UserWarning,
            stacklevel=3,
        )

    initial_layout = getattr(prism_component, "initialLayout", None)
    if initial_layout is None:
        return
    if initial_layout not in registry.registry:
        raise InitializationError(
            f"initialLayout '{initial_layout}' not found in registered layouts. "
            f"Available layouts: {sorted(registry.registry)}. "
            "Register the layout with @dash_prism.register_layout() before calling init()."
        )
    logger.info("Initial layout '%s' validated successfully", initial_layout)


def _attach_metadata(app: Dash, prism_id: str) -> None:
    """Make the Prism component receive the metadata of the registered layouts.

    The function reads the registry one time. A layout that the application
    registers after this call is not part of the metadata.

    If ``app.layout`` is a function, the function replaces it with a wrapper
    that injects the metadata at each render. If ``app.layout`` is a static
    component tree, Dash builds it one time, so the function injects the
    metadata one time, directly into the tree.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The ID of the Prism component.
    :type prism_id: str
    """
    layouts_metadata = registry.get_registered_layouts_metadata()
    session_id = _compute_server_session_id(registry.registry)
    original_layout = app.layout

    if not callable(original_layout):
        _inject_metadata_into_layout(original_layout, prism_id, layouts_metadata, session_id)
        return

    if original_layout in _wrapped_layouts:
        logger.info("Layout already wrapped, skipping re-wrap")
        return

    is_async = inspect.iscoroutinefunction(original_layout)
    wrapped_layout = _create_layout_wrapper(
        original_layout, prism_id, layouts_metadata, session_id, is_async
    )
    _wrapped_layouts.add(wrapped_layout)
    app.layout = wrapped_layout
    mode = "async" if is_async else "sync"
    logger.info("Wrapped %s callable layout for Prism metadata injection", mode)


def _coerce_timeout(value: Any, default: float = DEFAULT_LAYOUT_TIMEOUT) -> float:
    """Change a timeout from the browser into a positive, finite count of seconds.

    The browser sends the timeout in the ``data`` prop of the ``PrismContent``
    component, so the value can be of any JSON type. The function returns
    ``default`` for each value that is not a positive finite number. ``None``,
    ``0``, a negative number, ``NaN``, an infinite value, a boolean, and a
    string that is not numeric all get ``default``. Thus a malformed request can
    never mean "wait forever". A numeric string such as ``"7"`` is permitted,
    and the function returns ``7.0`` for it.

    :param value: The raw ``data["timeout"]`` value from the input of the render
        callback.
    :type value: Any
    :param default: The value to return when ``value`` is not usable. The
        default is :data:`DEFAULT_LAYOUT_TIMEOUT`.
    :type default: float
    :returns: The timeout in seconds. The result is more than 0 and finite.
    :rtype: float
    """
    if isinstance(value, bool):
        return default
    try:
        timeout = float(value)
    except (TypeError, ValueError, OverflowError):  # OverflowError: int above ~1.8e308
        return default
    if not math.isfinite(timeout) or timeout <= 0:
        return default
    return timeout


def _parse_content_request(
    content_id: Any, data: Any
) -> tuple[str, str, dict[str, Any] | None, str | None, float]:
    """Validate and unpack the inputs of the tab render callback.

    The sync callback and the async callback call this function, so the two
    paths read exactly the same fields. One of those fields is
    ``data["timeout"]``, which carries the ``layoutTimeout`` prop of
    :class:`dash_prism.Prism` through the ``PrismContent`` component.

    The function writes the tab ID and the layout ID to the debug log. It never
    writes the parameters, because they can hold values that the user typed.

    :param content_id: The pattern-matching ``id`` of the ``PrismContent``
        component (``{"type": "prism-content", "index": <tab id>}``).
    :type content_id: Any
    :param data: The ``data`` prop of the ``PrismContent`` component. The
        function reads the ``layoutId``, ``layoutParams``, ``layoutOption`` and
        ``timeout`` keys of that dictionary.
    :type data: Any
    :returns: ``(tab_id, layout_id, layout_params, layout_option, timeout)``.
        The function changes ``tab_id`` and ``layout_id`` into strings, and
        gives ``None`` for ``layout_option`` if the browser sent no option or an
        empty one.
    :rtype: tuple[str, str, dict[str, Any] | None, str | None, float]
    :raises dash.exceptions.PreventUpdate: If the inputs do not describe a tab
        that Prism can render. This occurs if ``content_id`` or ``data`` is not
        a dictionary, if there is no tab ID, or if no layout is selected.
    """
    if not isinstance(content_id, dict) or not isinstance(data, dict):
        raise PreventUpdate

    tab_id = content_id.get("index")
    layout_id = data.get("layoutId")
    if not tab_id or not layout_id:
        raise PreventUpdate

    # The browser sends both IDs, so %r keeps a line break in an ID out of the log.
    logger.debug("Render request: tab_id=%r layout_id=%r", tab_id, layout_id)
    return (
        str(tab_id),
        str(layout_id),
        data.get("layoutParams"),
        data.get("layoutOption") or None,
        _coerce_timeout(data.get("timeout")),
    )


def _run_callback(
    callback: Callable[..., Any],
    is_async: bool,
    kwargs: dict[str, Any],
    timeout: float = DEFAULT_LAYOUT_TIMEOUT,
) -> Any:
    """Call a layout callback in a SYNC context.

    The sync render path uses this function. The function accepts a sync
    callback and an async callback. A layout that you declare with ``async def``
    can still run in an app that has ``use_async=False``.

    :param callback: The layout callback function.
    :type callback: Callable[..., Any]
    :param is_async: Set this to ``True`` if ``callback`` is a coroutine
        function.
    :type is_async: bool
    :param kwargs: The keyword parameters to give to the callback.
    :type kwargs: dict[str, Any]
    :param timeout: The maximum count of seconds for an async callback.
    :type timeout: float
    :returns: The layout component tree that the callback returned.
    :rtype: Any
    :raises TimeoutError: If an async callback takes more than ``timeout``
        seconds.
    :raises RuntimeError: If ``is_async`` is ``True`` and an event loop is
        already in operation in this thread. ``asyncio.run()`` cannot start a
        second loop. To correct this, set ``use_async=True`` on the Dash app, or
        make the layout callback sync.

    .. note:: The function calls a sync callback directly, and ``timeout`` has
        no effect on that callback. A separate thread is necessary to stop a
        sync callback, and the function does not start one. The function runs an
        async callback in a new event loop through ``asyncio.run()``, and
        ``timeout`` does apply to that callback.
    """
    if not is_async:
        return callback(**kwargs)

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_run_callback_async(callback, is_async, kwargs, timeout))
    raise RuntimeError(
        "Cannot run async layout callback from within an existing event loop "
        "(for example Jupyter or uvicorn). Either set use_async=True on your Dash app, "
        "or make the layout callback synchronous."
    )


async def _run_callback_async(
    callback: Callable[..., Any],
    is_async: bool,
    kwargs: dict[str, Any],
    timeout: float = DEFAULT_LAYOUT_TIMEOUT,
) -> Any:
    """Call a layout callback in an ASYNC context, with a timeout.

    The async render path uses this function. The timeout applies to a sync
    callback and to an async callback here. The function runs a sync callback in
    the default executor of the event loop.

    :param callback: The layout callback function.
    :type callback: Callable[..., Any]
    :param is_async: Set this to ``True`` if ``callback`` is a coroutine
        function.
    :type is_async: bool
    :param kwargs: The keyword parameters to give to the callback.
    :type kwargs: dict[str, Any]
    :param timeout: The maximum count of seconds before the function raises
        :exc:`TimeoutError`.
    :type timeout: float
    :returns: The layout component tree that the callback returned.
    :rtype: Any
    :raises TimeoutError: If the callback takes more than ``timeout`` seconds.

    .. note:: The function awaits an async callback directly. It runs a sync
        callback in the default executor, so a slow sync layout does not block
        the event loop. If a sync callback takes too much time, the thread that
        runs it does not stop. But the caller gets a :exc:`TimeoutError`, and
        Prism discards the result.
    """
    async with asyncio.timeout(timeout):
        if is_async:
            return await callback(**kwargs)
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: callback(**kwargs))


def _create_error_component(message: str) -> Any:
    """Make the component that a tab shows when a layout cannot render.

    :param message: The error message to show. The component puts the message
        in an ``html.Pre`` element, so the line breaks in it stay.
    :type message: str
    :returns: An ``html.Div`` that has the class name ``prism-error-tab``. It
        holds the title "Layout Error" and the message.
    :rtype: Any
    """
    return html.Div(
        [
            html.H3("Layout Error"),
            html.Pre(message),
        ],
        className="prism-error-tab",
    )


def _create_validation_error_component(layout_id: str, error: params.ParamValidationError) -> Any:
    """Make the component that shows the parameter errors of one tab.

    The component gives one list item for each field that did not validate. The
    item shows the name of the field and the message of the validator. If the
    error holds the input value that the browser sent, the item shows that value
    too.

    :param layout_id: The ID of the layout whose parameters were not valid.
    :type layout_id: str
    :param error: The validation error. It holds one entry for each field that
        did not validate.
    :type error: ParamValidationError
    :returns: An ``html.Div`` that has the class names ``prism-error-tab`` and
        ``prism-error-validation``. Its ``data-testid`` attribute is
        ``prism-validation-error``.
    :rtype: Any
    """
    items = []
    for err in error.errors:
        suffix = "" if err.input is None else f" (got {err.input!r})"
        items.append(html.Li([html.Code(err.field), f": {err.message}{suffix}"]))

    attrs: dict[str, Any] = {"data-testid": "prism-validation-error"}
    return html.Div(
        [
            html.H3("Invalid parameters"),
            html.P(
                f"Layout '{layout_id}' could not be rendered because some "
                "parameters are invalid."
            ),
            html.Ul(items, className="prism-error-fields"),
            html.P("Open the search bar to enter them again.", className="prism-error-hint"),
        ],
        className="prism-error-tab prism-error-validation",
        **attrs,
    )


def _error_component_for(exc: Exception, layout_id: str, timeout: float) -> Any:
    """Make the component that a tab shows when its layout failed.

    The function selects the component from the class of the exception. There
    is one component for a timeout, one for parameters that are not valid, and
    one for every other exception. The function writes each failure to the log
    one time. A failure of the request or of the parameters gets a warning. Any
    other exception gets an error with the class of the exception and its stack
    frames. No log line holds an exception message or a parameter value,
    because both can hold values that the user typed. The tab shows the
    message.

    :param exc: The exception that the render of the layout raised.
    :type exc: Exception
    :param layout_id: The ID of the layout that failed.
    :type layout_id: str
    :param timeout: The count of seconds that the layout callback could take.
        The error message for a timeout includes this value.
    :type timeout: float
    :returns: The error component for the tab.
    :rtype: Any
    """
    if isinstance(exc, TimeoutError):
        logger.warning("Layout %r timed out after %gs", layout_id, timeout)
        return _create_error_component(
            f"Layout '{layout_id}' timed out after {timeout:g}s.\n"
            "The callback took too long to respond. Try refreshing the tab."
        )
    # ParamValidationError is a subclass of ValueError, so it must come first.
    if isinstance(exc, params.ParamValidationError):
        # The message of the exception holds the input values, so log the field names only.
        fields = ", ".join(error.field for error in exc.errors)
        logger.warning("Layout %r has invalid parameters: %s", layout_id, fields)
        return _create_validation_error_component(layout_id, exc)
    if isinstance(exc, TypeError):
        logger.warning("Layout %r failed with %s", layout_id, type(exc).__name__)
        return _create_error_component(f"Error rendering layout '{layout_id}': {exc}")
    if isinstance(exc, ValueError):
        # resolve_layout_params writes its ValueError messages for the user, so
        # the tab shows them as they are.
        logger.warning("Layout %r failed with %s", layout_id, type(exc).__name__)
        return _create_error_component(str(exc))
    # The log must not hold the message, so it gets the frames and not exc_info.
    frames = "".join(traceback.format_tb(exc.__traceback__))
    logger.error("Layout %r failed with %s\n%s", layout_id, type(exc).__name__, frames)
    return _create_error_component(f"Error rendering layout '{layout_id}': {exc}")


def _lookup_and_resolve(
    layout_id: str, layout_params: dict[str, Any] | None, layout_option: str | None
) -> tuple[registry.LayoutRegistration, dict[str, Any]]:
    """Read the registration of a layout, and resolve the parameters of a tab.

    The sync render path and the async render path use this function, so they
    reject the same requests.

    :param layout_id: The ID of the registered layout.
    :type layout_id: str
    :param layout_params: The parameters from the browser, or ``None``.
    :type layout_params: dict[str, Any] | None
    :param layout_option: The selected option key from ``param_options``, or
        ``None``.
    :type layout_option: str | None
    :returns: The registration, and the keyword arguments for the layout
        callback.
    :rtype: tuple[LayoutRegistration, dict[str, Any]]
    :raises ValueError: If the layout is not registered, or if the request does
        not agree with the registration.
    :raises ParamValidationError: If a parameter value is not valid.
    """
    registration = registry.get_layout(layout_id)
    if registration is None:
        raise ValueError(f"Layout '{layout_id}' not found")
    resolved_params = registry.resolve_layout_params(
        registration, layout_id, layout_params, layout_option
    )
    return registration, resolved_params


def _render_tab_layout(
    tab_id: str,
    layout_id: str,
    layout_params: dict[str, Any] | None,
    layout_option: str | None = None,
    timeout: float = DEFAULT_LAYOUT_TIMEOUT,
) -> Any:
    """Render the layout of a tab (SYNC version).

    The function does four steps. It reads the registration of the layout from
    the registry. It resolves the parameters, which validates them. It calls the
    layout callback, or makes a deep copy of a static layout. Last, it injects
    the tab ID into the component IDs of the tree. Thus the components of one
    tab do not collide with the components of another tab.

    The function catches the exceptions of the layout and returns an error
    component instead. Thus a layout that fails cannot break the render callback
    of Dash. :func:`_error_component_for` makes that component.

    :param tab_id: The unique identifier of the tab.
    :type tab_id: str
    :param layout_id: The ID of the registered layout.
    :type layout_id: str
    :param layout_params: The parameters from the browser, or ``None``.
    :type layout_params: dict[str, Any] | None
    :param layout_option: The selected option key from ``param_options``, or
        ``None``.
    :type layout_option: str | None
    :param timeout: The maximum count of seconds for an async layout callback.
        A sync layout callback has no timeout on this path.
    :type timeout: float
    :returns: The Dash component tree of the tab. The function returns ``None``
        if ``layout_id`` is empty. It returns an error component if the layout
        is not in the registry, or if the render failed.
    :rtype: Any
    """
    if not layout_id:
        return None

    try:
        registration, resolved_params = _lookup_and_resolve(layout_id, layout_params, layout_option)
        if registration.is_callable and registration.callback is not None:
            layout = _run_callback(
                registration.callback, registration.is_async, resolved_params, timeout
            )
        else:
            layout = copy.deepcopy(registration.layout)
        return utils.inject_tab_id(layout, tab_id)
    except Exception as exc:  # noqa: BLE001 - a failed layout must not break the Dash callback
        return _error_component_for(exc, layout_id, timeout)


async def _render_tab_layout_async(
    tab_id: str,
    layout_id: str,
    layout_params: dict[str, Any] | None,
    layout_option: str | None = None,
    timeout: float = DEFAULT_LAYOUT_TIMEOUT,
) -> Any:
    """Render the layout of a tab (ASYNC version).

    The steps and the result are the same as the steps and the result of
    :func:`_render_tab_layout`. The difference is that this function awaits the
    layout callback. A sync layout callback runs in the default executor.

    :param tab_id: The unique identifier of the tab.
    :type tab_id: str
    :param layout_id: The ID of the registered layout.
    :type layout_id: str
    :param layout_params: The parameters from the browser, or ``None``.
    :type layout_params: dict[str, Any] | None
    :param layout_option: The selected option key from ``param_options``, or
        ``None``.
    :type layout_option: str | None
    :param timeout: The maximum count of seconds for the layout callback. The
        timeout applies to a sync layout callback and to an async one.
    :type timeout: float
    :returns: The Dash component tree of the tab. The function returns ``None``
        if ``layout_id`` is empty. It returns an error component if the layout
        is not in the registry, or if the render failed.
    :rtype: Any
    """
    if not layout_id:
        return None

    try:
        registration, resolved_params = _lookup_and_resolve(layout_id, layout_params, layout_option)
        if registration.is_callable and registration.callback is not None:
            layout = await _run_callback_async(
                registration.callback, registration.is_async, resolved_params, timeout
            )
        else:
            layout = copy.deepcopy(registration.layout)
        return utils.inject_tab_id(layout, tab_id)
    except Exception as exc:  # noqa: BLE001 - a failed layout must not break the Dash callback
        return _error_component_for(exc, layout_id, timeout)


def _render_content_request(content_id: Any, data: Any) -> Any:
    """Handle one render request in SYNC mode (the body of the Dash callback).

    The function stays at module level, so a test can call the body of the
    callback directly, without the dispatcher of Dash.

    :param content_id: The pattern-matching ``id`` of the ``PrismContent``
        component.
    :type content_id: Any
    :param data: The ``data`` prop of the ``PrismContent`` component.
    :type data: Any
    :returns: The Dash component tree for the ``children`` prop of the
        ``PrismContent`` component.
    :rtype: Any
    :raises dash.exceptions.PreventUpdate: If the request is malformed, or if
        the layout renders to ``None``.
    """
    tab_id, layout_id, layout_params, layout_option, timeout = _parse_content_request(
        content_id, data
    )
    result = _render_tab_layout(tab_id, layout_id, layout_params, layout_option, timeout)
    if result is None:
        raise PreventUpdate
    return result


async def _render_content_request_async(content_id: Any, data: Any) -> Any:
    """Handle one render request in ASYNC mode (the body of the Dash callback).

    The function stays at module level, so a test can call the body of the
    callback directly, without the dispatcher of Dash.

    :param content_id: The pattern-matching ``id`` of the ``PrismContent``
        component.
    :type content_id: Any
    :param data: The ``data`` prop of the ``PrismContent`` component.
    :type data: Any
    :returns: The Dash component tree for the ``children`` prop of the
        ``PrismContent`` component.
    :rtype: Any
    :raises dash.exceptions.PreventUpdate: If the request is malformed, or if
        the layout renders to ``None``.
    """
    tab_id, layout_id, layout_params, layout_option, timeout = _parse_content_request(
        content_id, data
    )
    result = await _render_tab_layout_async(
        tab_id, layout_id, layout_params, layout_option, timeout
    )
    if result is None:
        raise PreventUpdate
    return result


def _register_render_callback(app: Dash, background: bool) -> None:
    """Register the Dash callback that renders the contents of the tabs.

    The pattern-matching ID with ``MATCH`` gives one callback instance for each
    ``PrismContent`` component in the workspace. The callback is async if the
    app has ``use_async=True``, and sync if it has not. The function sends a
    :class:`UserWarning` if a registered layout is async but the callback is
    sync, because that layout then runs through ``asyncio.run()``. The function
    also writes a warning to the log if the app has
    ``suppress_callback_exceptions=False``, because a callback that targets a
    component inside a tab layout then raises an exception at startup.

    :param app: The Dash application.
    :type app: Dash
    :param background: If ``True``, register the callback with
        ``background=True``.
    :type background: bool
    """
    use_async = _is_app_async(app)

    if not use_async and any(reg.is_async for reg in registry.registry.layouts.values()):
        warnings.warn(
            "Some registered layouts use async callbacks but the Dash app "
            "is not configured for async (use_async=True). Async layouts "
            "will run synchronously through asyncio.run().",
            UserWarning,
            stacklevel=3,
        )

    if not getattr(app.config, "suppress_callback_exceptions", False):
        logger.warning(
            "suppress_callback_exceptions is False. Callbacks targeting "
            "components inside tab layouts will raise exceptions at startup "
            "because those components don't exist in app.layout yet. "
            "Set app = Dash(__name__, suppress_callback_exceptions=True) "
            "to avoid this."
        )

    register = app.callback(
        Output({"type": "prism-content", "index": MATCH}, "children"),
        Input({"type": "prism-content", "index": MATCH}, "id"),
        Input({"type": "prism-content", "index": MATCH}, "data"),
        prevent_initial_call=False,
        background=background,
    )

    if use_async:

        @register
        async def render_prism_content_async(content_id, data):
            """Render the contents of one tab. Dash calls this async callback."""
            return await _render_content_request_async(content_id, data)

    else:

        @register
        def render_prism_content(content_id, data):
            """Render the contents of one tab. Dash calls this sync callback."""
            return _render_content_request(content_id, data)

    mode = "async" if use_async else "sync"
    logger.info("Prism initialized with %d layout(s) [%s mode]", len(registry.registry), mode)


def init(prism_id: str, app: Dash, background: bool = False) -> None:
    """Connect Prism to a Dash application.

    This function does four things:

    1. It validates the setup and raises clear error messages.
    2. It finds the Prism component in ``app.layout`` by its ID.
    3. It injects the ``registeredLayouts`` metadata from the layout registry.
       It also injects a ``serverSessionId`` fingerprint of the registered
       layout IDs, but only if you did not set that prop yourself. With the
       fingerprint, a persisted workspace can close the tabs whose layouts were
       removed.
    4. It makes the Dash callback that renders the contents of the tabs.

    ``init`` selects the type of the callback automatically:

    - If the app has ``use_async=True``, ``init`` registers an async callback.
    - If the app has ``use_async=False``, ``init`` registers a sync callback. An
      async layout then runs through ``asyncio.run()``.

    You must call ``init`` after you register your layouts and after you set
    ``app.layout``. ``init`` reads the registry one time, so a layout that you
    register after the call is not part of the injected metadata.

    ``init`` sends a :class:`UserWarning` and continues in these conditions:

    - No layout is registered.
    - ``app.layout`` holds no component with the ID ``prism_id``, or that
      component is not a Prism component.
    - ``app.layout`` is a function, and a call to it raised an exception.
    - Some registered layouts are async, but the app has ``use_async=False``.

    ``init`` also writes a warning to the log if the Dash app has
    ``suppress_callback_exceptions=False``. A callback that targets a component
    inside a tab layout then raises an exception at startup. That component is
    not in ``app.layout`` yet.

    :param prism_id: The ID of the Prism component in the layout.
    :type prism_id: str
    :param app: The Dash application instance.
    :type app: Dash
    :param background: If ``True``, ``init`` registers the tab render callback
        with ``background=True``. The Background Callback Manager of Dash then
        runs that callback in a separate process (DiskCache) or on a task queue
        (Celery). A ``background_callback_manager`` on the Dash app is necessary
        for this. The default is ``False``.
    :type background: bool
    :raises: :exc:`dash_prism.InitializationError` if a check that is critical
        does not pass. The critical checks are the ``app`` argument, the
        ``prism_id`` argument and the ``app.layout`` attribute. ``init`` also
        raises this error if the ``initialLayout`` prop names a layout that is
        not in the registry.

    .. rubric:: Examples

    Basic usage:

    .. code-block:: python

        import dash_prism
        from dash import Dash, html

        app = Dash(__name__)

        @dash_prism.register_layout(id='home', name='Home')
        def home_layout():
            return html.Div('Welcome!')

        app.layout = html.Div([
            dash_prism.Prism(id='prism')
        ])

        dash_prism.init('prism', app)

    With background callbacks:

    .. code-block:: python

        import dash_prism
        import diskcache
        from dash import Dash, DiskcacheManager

        cache = diskcache.Cache("./cache")
        background_callback_manager = DiskcacheManager(cache)
        app = Dash(__name__, background_callback_manager=background_callback_manager)

        dash_prism.init('prism', app, background=True)
    """
    errors = _validate_init(app, prism_id)
    if errors:
        raise InitializationError(
            "Prism initialization failed:\n" + "\n".join(f"  - {e}" for e in errors)
        )

    prism_component = _validate_prism_component(app, prism_id)
    _check_registry(prism_component)
    _attach_metadata(app, prism_id)
    _register_render_callback(app, background)
