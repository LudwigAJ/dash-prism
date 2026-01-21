"""
Prism Initialization
====================

This module provides the :func:`init` function that sets up Prism with a Dash app.

Responsibilities
----------------

- Injecting registered layouts metadata into the Prism component
- Creating the callback to render tab contents (sync or async)
- Validating the setup and providing clear error messages

Async Handling
--------------

- If Dash app has ``use_async=True``: uses async callback, awaits async layouts
- If Dash app has ``use_async=False``: uses sync callback, runs async layouts
  via ``asyncio.run()``
"""

from __future__ import annotations

import asyncio
import copy
import warnings
import logging
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from dash import Dash

logger = logging.getLogger("dash_prism")


# =============================================================================
# EXCEPTIONS
# =============================================================================


class InitializationError(Exception):
    """Raised when Prism initialization fails."""

    pass


# =============================================================================
# INTERNAL HELPERS
# =============================================================================


def _find_component_by_id(layout: Any, component_id: str) -> Optional[Any]:
    """Recursively search for a component by ID in the layout tree.

    :param layout: The root component to search.
    :type layout: Any
    :param component_id: The ID to find.
    :type component_id: str
    :returns: The component with matching ID, or ``None`` if not found.
    :rtype: Any | None
    """
    if layout is None:
        return None

    if hasattr(layout, "id") and layout.id == component_id:
        return layout

    if hasattr(layout, "children"):
        children = layout.children
        if children is None:
            return None
        if isinstance(children, (list, tuple)):
            for child in children:
                result = _find_component_by_id(child, component_id)
                if result is not None:
                    return result
        else:
            return _find_component_by_id(children, component_id)

    return None


def _get_layout_root(app: "Dash") -> Optional[Any]:
    """Resolve the app layout root, calling a layout function if needed.

    :param app: The Dash application instance.
    :type app: Dash
    :returns: The resolved layout root, or ``None`` if unavailable.
    :rtype: Any | None
    """
    layout = getattr(app, "layout", None)
    if callable(layout):
        try:
            return layout()
        except Exception as exc:  # pragma: no cover - depends on app layout
            warnings.warn(
                "Failed to call app.layout() while searching for the Prism component. "
                "Ensure your layout function can be called without arguments.",
                UserWarning,
                stacklevel=3,
            )
            logger.exception("Failed to call app.layout() while searching for Prism", exc_info=exc)
            return None
    return layout


def _is_app_async(app: "Dash") -> bool:
    """Check if the Dash app is configured for async callbacks.

    :param app: The Dash application instance.
    :type app: Dash
    :returns: ``True`` if app uses async callbacks, ``False`` otherwise.
    :rtype: bool
    """
    return getattr(app, "use_async", False)


def _run_callback(
    callback: Callable[..., Any],
    is_async: bool,
    params: Dict[str, Any],
    timeout: int = 30,
) -> Any:
    """Execute a layout callback in a SYNC context.

    :param callback: The layout callback function.
    :type callback: Callable[..., Any]
    :param is_async: Whether the callback is async.
    :type is_async: bool
    :param params: Parameters to pass to the callback.
    :type params: dict[str, Any]
    :param timeout: Maximum time in seconds for async callbacks.
    :type timeout: int
    :returns: The rendered layout component.
    :rtype: Any
    :raises TimeoutError: If async callback exceeds timeout duration.

    .. note:: Sync callbacks are called directly (timeout not enforced).
        Async callbacks are run via ``asyncio.run()`` with timeout.
    """
    if is_async:
        # Async callback - run with timeout via asyncio.run
        async def _run_with_timeout():
            try:
                return await asyncio.wait_for(callback(**params), timeout=timeout)
            except asyncio.TimeoutError:
                raise TimeoutError(
                    f"Async layout callback timed out after {timeout}s. "
                    "Consider optimizing the callback or increasing layoutTimeout."
                )

        return asyncio.run(_run_with_timeout())
    # Sync callback - no timeout enforcement (would require threading)
    return callback(**params)


async def _run_callback_async(
    callback: Callable[..., Any],
    is_async: bool,
    params: Dict[str, Any],
    timeout: int = 30,
) -> Any:
    """Execute a layout callback in an ASYNC context with timeout.

    :param callback: The layout callback function.
    :type callback: Callable[..., Any]
    :param is_async: Whether the callback is async.
    :type is_async: bool
    :param params: Parameters to pass to the callback.
    :type params: dict[str, Any]
    :param timeout: Maximum time in seconds before raising TimeoutError.
    :type timeout: int
    :returns: The rendered layout component.
    :rtype: Any
    :raises TimeoutError: If callback exceeds timeout duration.

    .. note:: Async callbacks are awaited directly. Sync callbacks are
        run in an executor to avoid blocking. Both are subject to timeout.
    """
    if is_async:
        # Async callback - await directly with timeout
        try:
            return await asyncio.wait_for(callback(**params), timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Async layout callback timed out after {timeout}s. "
                "Consider optimizing the callback or increasing layoutTimeout."
            )
    else:
        # Sync callback - run in executor with timeout
        loop = asyncio.get_running_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, lambda: callback(**params)),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Layout callback timed out after {timeout}s. "
                "Consider optimizing the callback or increasing layoutTimeout."
            )


def _create_error_component(message: str) -> Any:
    """Create an error display component.

    :param message: The error message to display.
    :type message: str
    :returns: Error component with styling.
    :rtype: dash.html.Div
    """
    from dash import html

    return html.Div(
        [
            html.H3("Layout Error"),
            html.Pre(message),
        ],
        className="prism-error-tab",
    )


def _resolve_layout_params(
    registration: Any,
    layout_id: str,
    layout_params: Optional[Dict[str, Any]],
    layout_option: Optional[str],
) -> Dict[str, Any]:
    """Resolve effective layout parameters.

    If ``layout_option`` is provided, it will be mapped to parameters via
    ``registration.param_options`` on the Python side.

    :param registration: Layout registration metadata.
    :type registration: Any
    :param layout_id: The registered layout ID.
    :type layout_id: str
    :param layout_params: Parameters supplied from the client.
    :type layout_params: dict[str, Any]
    :param layout_option: Selected option key from ``param_options``.
    :type layout_option: str | None
    :returns: Resolved parameters to pass to the layout callback.
    :rtype: dict[str, Any]
    :raises ValueError: If the layout option is invalid or unsupported.
    """
    if layout_params is None:
        resolved_params: Dict[str, Any] = {}
    elif not isinstance(layout_params, dict):
        raise ValueError(
            f"layoutParams must be an object/dict for layout '{layout_id}', "
            f"got {type(layout_params).__name__}"
        )
    else:
        resolved_params = layout_params

    if registration.param_options:
        if layout_option is None:
            raise ValueError(
                f"Layout '{layout_id}' requires layoutOption when param_options is defined."
            )

        if resolved_params:
            raise ValueError(
                f"Layout '{layout_id}' only accepts parameters via param_options; "
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

        return dict(option_params)

    if layout_option is not None:
        raise ValueError(
            f"Layout '{layout_id}' does not define param_options but layoutOption was provided."
        )

    return resolved_params


def _render_tab_layout_impl(
    tab_id: str,
    layout_id: str,
    layout_params: Optional[Dict[str, Any]],
    layout_option: Optional[str],
    timeout: int,
    callback_runner: Callable,
    is_async: bool = False,
) -> Any:
    """Shared implementation for both sync and async layout rendering.

    :param tab_id: The unique tab identifier.
    :type tab_id: str
    :param layout_id: The registered layout ID.
    :type layout_id: str
    :param layout_params: Parameters to pass to layout callback.
    :type layout_params: dict[str, Any] | None
    :param layout_option: Selected option key from ``param_options``.
    :type layout_option: str | None
    :param timeout: Maximum time in seconds for callback execution.
    :type timeout: int
    :param callback_runner: Either _run_callback or _run_callback_async.
    :type callback_runner: Callable
    :param is_async: If True, callback_runner returns awaitable.
    :type is_async: bool
    :returns: The rendered Dash component tree.
    :rtype: Any
    """
    from .registry import get_layout
    from .utils import inject_tab_id

    if not layout_id:
        return None

    registration = get_layout(layout_id)
    if not registration:
        return _create_error_component(f"Layout '{layout_id}' not found")

    try:
        resolved_params = _resolve_layout_params(
            registration,
            layout_id,
            layout_params,
            layout_option,
        )

        if registration.is_callable and registration.callback is not None:
            result = callback_runner(
                registration.callback,
                registration.is_async,
                resolved_params,
                timeout,
            )
            # If async, result is awaitable
            layout = result if is_async else result
        else:
            layout = copy.deepcopy(registration.layout)

        return inject_tab_id(layout, tab_id)

    except TimeoutError as e:
        return _create_error_component(
            f"Layout '{layout_id}' timed out after {timeout}s.\n"
            "The callback took too long to respond. Try refreshing the tab."
        )
    except TypeError as e:
        return _create_error_component(
            f"Error rendering layout '{layout_id}': {e}\n"
            "Check that all required parameters are provided."
        )
    except ValueError as e:
        return _create_error_component(str(e))
    except Exception as e:
        logger.exception(f"Unexpected error rendering layout '{layout_id}'", exc_info=e)
        return _create_error_component(f"Error rendering layout '{layout_id}': {e}")


def _render_tab_layout(
    tab_id: str,
    layout_id: str,
    layout_params: Optional[Dict[str, Any]],
    layout_option: Optional[str] = None,
    timeout: int = 30,
) -> Any:
    """Render a tab's layout (SYNC version).

    :param tab_id: The unique tab identifier.
    :type tab_id: str
    :param layout_id: The registered layout ID.
    :type layout_id: str
    :param layout_params: Parameters to pass to layout callback.
    :type layout_params: dict[str, Any]
    :param layout_option: Selected option key from ``param_options``.
    :type layout_option: str | None
    :param timeout: Maximum time in seconds for async callback execution.
    :type timeout: int
    :returns: The rendered Dash component tree.
    :rtype: Any
    """
    return _render_tab_layout_impl(
        tab_id,
        layout_id,
        layout_params,
        layout_option,
        timeout,
        callback_runner=_run_callback,
        is_async=False,
    )


async def _render_tab_layout_async(
    tab_id: str,
    layout_id: str,
    layout_params: Optional[Dict[str, Any]],
    layout_option: Optional[str] = None,
    timeout: int = 30,
) -> Any:
    """Render a tab's layout (ASYNC version).

    :param tab_id: The unique tab identifier.
    :type tab_id: str
    :param layout_id: The registered layout ID.
    :type layout_id: str
    :param layout_params: Parameters to pass to layout callback.
    :type layout_params: dict[str, Any]
    :param layout_option: Selected option key from ``param_options``.
    :type layout_option: str | None
    :param timeout: Maximum time in seconds for callback execution.
    :type timeout: int
    :returns: The rendered Dash component tree.
    :rtype: Any
    """
    return await _render_tab_layout_impl(
        tab_id,
        layout_id,
        layout_params,
        layout_option,
        timeout,
        callback_runner=_run_callback_async,
        is_async=True,
    )


# =============================================================================
# VALIDATION
# =============================================================================


def _validate_init(app: "Dash", prism_id: str) -> list[str]:
    """Validate the initialization setup.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The Prism component ID.
    :type prism_id: str
    :returns: List of error messages (empty if valid).
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


def _validate_prism_component(app: "Dash", prism_id: str) -> Optional[Any]:
    """Find and validate the Prism component in the app layout.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The Prism component ID.
    :type prism_id: str
    :returns: The Prism component, or ``None`` with warnings if not found.
    :rtype: Any | None
    """
    layout_root = _get_layout_root(app)
    prism_component = _find_component_by_id(layout_root, prism_id)

    if prism_component is None:
        warnings.warn(
            f"Could not find Prism component with id='{prism_id}' in app.layout. "
            "The Prism component must exist in app.layout when init() is called. "
            "If using a function as layout, ensure it returns the Prism component.",
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


# =============================================================================
# PUBLIC API
# =============================================================================


def init(prism_id: str, app: "Dash") -> None:
    """
    Initialize Prism with a Dash application.

    This function performs the following:

    1. Validates the setup and provides clear error messages
    2. Finds the Prism component in ``app.layout`` by ID
    3. Injects ``registeredLayouts`` metadata from the layout registry
    4. Creates the appropriate callback (sync or async) to render tab contents

    The callback type is determined automatically:

    - If app has ``use_async=True``, async callbacks are used
    - Otherwise, sync callbacks are used (async layouts run via ``asyncio.run()``)

    Parameters
    ----------
    prism_id : str
        The ID of the Prism component in the layout.
    app : Dash
        The Dash application instance.

    Raises
    ------
    InitializationError
        If critical validation fails.

    Examples
    --------
    Basic usage::

        >>> import dash_prism
        >>> from dash import Dash, html
        >>>
        >>> app = Dash(__name__)
        >>>
        >>> @dash_prism.register_layout(id='home', name='Home')
        ... def home_layout():
        ...     return html.Div('Welcome!')
        >>>
        >>> app.layout = html.Div([
        ...     dash_prism.Prism(id='prism')
        ... ])
        >>>
        >>> dash_prism.init('prism', app)
    """
    from dash import Input, Output, State, MATCH
    from dash.exceptions import PreventUpdate

    from .registry import registry, get_registered_layouts_metadata

    # Validate setup
    errors = _validate_init(app, prism_id)
    if errors:
        raise InitializationError(
            "Prism initialization failed:\n" + "\n".join(f"  - {e}" for e in errors)
        )

    # Warn if no layouts registered
    if len(registry) == 0:
        warnings.warn(
            "No layouts registered. Register layouts with "
            "@dash_prism.register_layout() before calling init().",
            UserWarning,
            stacklevel=2,
        )

    # Find and validate Prism component
    prism_component = _validate_prism_component(app, prism_id)

    # Validate initialLayout if provided
    if prism_component is not None:
        initial_layout = getattr(prism_component, "initialLayout", None)
        if initial_layout is not None:
            layout_ids = list(registry.layouts.keys())
            if initial_layout not in layout_ids:
                raise InitializationError(
                    f"initialLayout '{initial_layout}' not found in registered layouts. "
                    f"Available layouts: {layout_ids}. "
                    "Register the layout with @dash_prism.register_layout() before calling init()."
                )
            logger.info(f"Initial layout '{initial_layout}' validated successfully")

    # Inject registered layouts metadata
    if prism_component is not None:
        prism_component.registeredLayouts = get_registered_layouts_metadata()
        from . import SERVER_SESSION_ID

        if getattr(prism_component, "serverSessionId", None) is None:
            prism_component.serverSessionId = SERVER_SESSION_ID

    # Determine callback mode
    use_async = _is_app_async(app)

    # Warn about async layouts in sync mode
    has_async_layouts = any(reg.is_async for reg in registry.layouts.values())
    if has_async_layouts and not use_async:
        warnings.warn(
            "Some registered layouts use async callbacks but the Dash app "
            "is not configured for async (use_async=True). Async layouts "
            "will be run synchronously via asyncio.run().",
            UserWarning,
            stacklevel=2,
        )

    # Create the tab rendering callback using pattern matching
    if use_async:

        @app.callback(
            Output({"type": "prism-content", "index": MATCH}, "children"),
            Input({"type": "prism-content", "index": MATCH}, "id"),
            Input({"type": "prism-content", "index": MATCH}, "data"),
            prevent_initial_call=False,
        )
        async def render_prism_content_async(content_id, data):
            """Async callback to render a tab's content."""
            logger.info("render_prism_content_async %s, %s", content_id, data)

            if not isinstance(content_id, dict) or not isinstance(data, dict):
                raise PreventUpdate

            tab_id = content_id.get("index")

            layout_id = data.get("layoutId")
            layout_params = data.get("layoutParams")
            layout_option = data.get("layoutOption") or None
            timeout = data.get("timeout", 30)  # Default to 30s if not provided

            if not layout_id:
                raise PreventUpdate

            result = await _render_tab_layout_async(
                tab_id,
                layout_id,
                layout_params,
                layout_option,
                timeout,
            )
            if result is None:
                raise PreventUpdate

            return result

    else:

        @app.callback(
            Output({"type": "prism-content", "index": MATCH}, "children"),
            Input({"type": "prism-content", "index": MATCH}, "id"),
            Input({"type": "prism-content", "index": MATCH}, "data"),
            prevent_initial_call=False,
        )
        def render_prism_content(content_id, data):
            """Sync callback to render a tab's content."""
            logger.info("render_prism_content %s, %s", content_id, data)
            if not isinstance(content_id, dict) or not isinstance(data, dict):
                raise PreventUpdate

            tab_id = content_id.get("index")
            layout_id = data.get("layoutId")
            layout_params = data.get("layoutParams")
            layout_option = data.get("layoutOption") or None

            if not layout_id:
                raise PreventUpdate

            result = _render_tab_layout(
                tab_id,
                layout_id,
                layout_params,
                layout_option,
            )
            if result is None:
                raise PreventUpdate

            return result

    # Log success
    layout_count = len(registry)
    mode = "async" if use_async else "sync"
    logger.info("Prism initialized with %d layout(s) [%s mode]", layout_count, mode)
