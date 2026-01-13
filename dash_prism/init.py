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

logger = logging.getLogger('dash_prism')  


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

    if hasattr(layout, 'id') and layout.id == component_id:
        return layout

    if hasattr(layout, 'children'):
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


def _is_app_async(app: 'Dash') -> bool:
    """Check if the Dash app is configured for async callbacks.

    :param app: The Dash application instance.
    :type app: Dash
    :returns: ``True`` if app uses async callbacks, ``False`` otherwise.
    :rtype: bool
    """
    return getattr(app, 'use_async', False)


def _run_callback(
    callback: Callable[..., Any],
    is_async: bool,
    params: Dict[str, Any],
) -> Any:
    """Execute a layout callback in a SYNC context.

    :param callback: The layout callback function.
    :type callback: Callable[..., Any]
    :param is_async: Whether the callback is async.
    :type is_async: bool
    :param params: Parameters to pass to the callback.
    :type params: dict[str, Any]
    :returns: The rendered layout component.
    :rtype: Any

    .. note:: Sync callbacks are called directly. Async callbacks are
        run via ``asyncio.run()``.
    """
    if is_async:
        return asyncio.run(callback(**params))
    return callback(**params)


async def _run_callback_async(
    callback: Callable[..., Any],
    is_async: bool,
    params: Dict[str, Any],
) -> Any:
    """Execute a layout callback in an ASYNC context.

    :param callback: The layout callback function.
    :type callback: Callable[..., Any]
    :param is_async: Whether the callback is async.
    :type is_async: bool
    :param params: Parameters to pass to the callback.
    :type params: dict[str, Any]
    :returns: The rendered layout component.
    :rtype: Any

    .. note:: Async callbacks are awaited directly. Sync callbacks are
        run in an executor to avoid blocking.
    """
    if is_async:
        return await callback(**params)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: callback(**params))


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
            html.H3('Layout Error'),
            html.Pre(message),
        ],
        className='prism-error-tab',
    )


def _render_tab_layout(
    tab_id: str,
    layout_id: str,
    layout_params: Dict[str, Any],
) -> Any:
    """Render a tab's layout (SYNC version).

    :param tab_id: The unique tab identifier.
    :type tab_id: str
    :param layout_id: The registered layout ID.
    :type layout_id: str
    :param layout_params: Parameters to pass to layout callback.
    :type layout_params: dict[str, Any]
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
        if registration.is_callable and registration.callback is not None:
            layout = _run_callback(
                registration.callback,
                registration.is_async,
                layout_params,
            )
        else:
            layout = copy.deepcopy(registration.layout)

        return inject_tab_id(layout, tab_id)

    except TypeError as e:
        return _create_error_component(
            f"Error rendering layout '{layout_id}': {e}\n"
            "Check that all required parameters are provided."
        )
    except Exception as e:
        return _create_error_component(f"Error rendering layout '{layout_id}': {e}")


async def _render_tab_layout_async(
    tab_id: str,
    layout_id: str,
    layout_params: Dict[str, Any],
) -> Any:
    """Render a tab's layout (ASYNC version).

    :param tab_id: The unique tab identifier.
    :type tab_id: str
    :param layout_id: The registered layout ID.
    :type layout_id: str
    :param layout_params: Parameters to pass to layout callback.
    :type layout_params: dict[str, Any]
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
        if registration.is_callable and registration.callback is not None:
            layout = await _run_callback_async(
                registration.callback,
                registration.is_async,
                layout_params,
            )
        else:
            layout = copy.deepcopy(registration.layout)

        return inject_tab_id(layout, tab_id)

    except TypeError as e:
        return _create_error_component(
            f"Error rendering layout '{layout_id}': {e}\n"
            "Check that all required parameters are provided."
        )
    except Exception as e:
        return _create_error_component(f"Error rendering layout '{layout_id}': {e}")


# =============================================================================
# VALIDATION
# =============================================================================


def _validate_init(app: 'Dash', prism_id: str) -> list[str]:
    """Validate the initialization setup.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The Prism component ID.
    :type prism_id: str
    :returns: List of error messages (empty if valid).
    :rtype: list[str]
    """
    errors: list[str] = []

    if not hasattr(app, 'callback'):
        errors.append(
            "Invalid 'app' argument: expected a Dash application instance"
        )

    if not prism_id or not isinstance(prism_id, str):
        errors.append("Invalid 'prism_id': must be a non-empty string")

    if not hasattr(app, 'layout') or app.layout is None:
        errors.append(
            "app.layout must be set before calling init(). "
            "Make sure you define app.layout = ... before calling dash_prism.init()"
        )

    return errors


def _validate_prism_component(app: 'Dash', prism_id: str) -> Optional[Any]:
    """Find and validate the Prism component in the app layout.

    :param app: The Dash application.
    :type app: Dash
    :param prism_id: The Prism component ID.
    :type prism_id: str
    :returns: The Prism component, or ``None`` with warnings if not found.
    :rtype: Any | None
    """
    prism_component = _find_component_by_id(app.layout, prism_id)

    if prism_component is None:
        warnings.warn(
            f"Could not find Prism component with id='{prism_id}' in app.layout. "
            "The Prism component must exist in app.layout when init() is called. "
            "If using a function as layout, ensure it returns the Prism component.",
            UserWarning,
            stacklevel=3,
        )
        return None

    component_type = getattr(prism_component, '_type', None)
    if component_type != 'Prism':
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


def init(prism_id: str, app: 'Dash') -> None:
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
            "Prism initialization failed:\n"
            + "\n".join(f"  - {e}" for e in errors)
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

    # Inject registered layouts metadata
    if prism_component is not None:
        prism_component.registeredLayouts = get_registered_layouts_metadata()

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
            Output({'type': 'prism-content', 'index': MATCH}, 'children'),
            Input({'type': 'prism-content', 'index': MATCH}, 'id'),
            Input({'type': 'prism-content', 'index': MATCH}, 'data'),
            prevent_initial_call=False,
        )
        async def render_prism_content_async(content_id, data):
            """Async callback to render a tab's content."""
            print('render_prism_content_async %s, %s' % (content_id, data))
            logger.info('render_prism_content_async %s, %s', content_id, data)

            if not content_id or not data:
                raise PreventUpdate
            
            tab_id = content_id.get('index')

            layout_id = data.get('layoutId')
            layout_params = data.get('layoutParams', {})
            layout_options = data.get('layoutOptions', '')

            if not layout_id:
                raise PreventUpdate

            result = await _render_tab_layout_async(tab_id, layout_id, layout_params)
            if result is None:
                raise PreventUpdate

            return result
    else:
        @app.callback(
            Output({'type': 'prism-content', 'index': MATCH}, 'children'),
            Input({'type': 'prism-content', 'index': MATCH}, 'id'),
            Input({'type': 'prism-content', 'index': MATCH}, 'data'),
            prevent_initial_call=False,
        )
        def render_prism_content(content_id, data):
            """Sync callback to render a tab's content."""
            print('render_prism_content_async %s, %s' % (content_id, data))
            logger.info('render_prism_content %s, %s', content_id, data)
            if not content_id or not data:
                raise PreventUpdate

            tab_id = content_id.get('index')
            layout_id = data.get('layoutId')
            layout_params = data.get('layoutParams', {})
            layout_options = data.get('layoutOption', '')

            if not layout_id:
                raise PreventUpdate

            result = _render_tab_layout(tab_id, layout_id, layout_params)
            if result is None:
                raise PreventUpdate

            return result

    # Log success
    layout_count = len(registry)
    mode = "async" if use_async else "sync"
    print(f"✓ Prism initialized with {layout_count} layout(s) [{mode} mode]")
