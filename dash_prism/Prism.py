"""Prism Component Wrapper.

User-facing wrapper for the Prism component with comprehensive documentation.
This file provides a clean Python API that wraps the auto-generated PrismComponent.
"""

from __future__ import annotations

import warnings
from collections.abc import Sequence
from typing import Any, Literal

from dash.development.base_component import Component

from .PrismComponent import PrismComponent

# Sentinel to distinguish "not provided" from an explicit None
_UNSET: Any = type("_Unset", (), {"__repr__": lambda self: "_UNSET"})()


class Prism(PrismComponent):
    """Advanced multi-panel workspace manager for Plotly Dash.

    Prism provides a powerful tabbed workspace with drag-and-drop functionality,
    allowing users to create, organize, and manage multiple layouts in a single
    application. It supports multi-panel splits, persistent state, and dynamic
    layout loading with full async support.

    **Features:**

    - **Dynamic Tab Management**: Create, close, rename, and reorder tabs
    - **Multi-Panel Layouts**: Split workspace into multiple panels via drag-and-drop
    - **Persistent State**: Save workspace configuration across browser sessions
    - **Layout Registry**: Register static or dynamic layouts with parameters
    - **Async Support**: Full support for async layout callbacks
    - **Type-Safe**: Complete type hints for Python 3.10+

    :param id: Unique identifier for this component in Dash callbacks.
        Use this ID to read workspace state or update component properties.
    :type id: str or None
    :param serverSessionId: Fingerprint of the server-side layout registry, stored
        with the persisted workspace. On load, tabs whose layout is no longer in
        ``registeredLayouts`` are closed instead of showing an error; the rest of
        the workspace is kept and the stored fingerprint is updated so the registry
        change is recorded. :func:`dash_prism.init` derives it from the registered
        layout IDs (stable across workers and restarts). Which tabs are closed
        depends only on ``registeredLayouts`` (nothing is closed while no layout
        is registered at all); setting this by hand merely changes the recorded
        fingerprint.
    :type serverSessionId: str or None
    :param theme: Visual theme for the workspace. Controls colors, backgrounds,
        and overall appearance. Defaults to ``'light'``.
    :type theme: str
    :param size: Size variant affecting spacing, typography, and UI element sizing.
        Options: ``'sm'`` (small), ``'md'`` (medium, default), ``'lg'`` (large).
        Defaults to ``'md'``.
    :type size: str
    :param maxTabs: Maximum number of tabs allowed in the whole workspace,
        counting every panel together (not per panel). Prevents users
        from creating too many tabs which could impact performance. Values less than
        ``1`` (e.g., ``0`` or ``-1``) mean unlimited tabs. Defaults to ``16``.
    :type maxTabs: int
    :param searchBarPlaceholder: Placeholder text shown in the layout search bar.
        Defaults to ``'Search layouts...'``.
    :type searchBarPlaceholder: str
    :param layoutTimeout: Timeout in seconds for layout loading. Defaults to ``30``.
        Enforced in two places: the browser shows a timeout card if a tab's content
        has not arrived within this time, and the render callback gives up on layout
        callbacks that run longer than this and renders an error tab instead. The
        server-side limit applies to ``async`` layout callbacks in every app, and to
        synchronous layout callbacks only when the app runs with ``use_async=True``;
        a synchronous callback in a synchronous app cannot be interrupted. Values that
        are not finite positive numbers (including ``None``, ``0`` and negatives) fall
        back to the default on both sides; there is no "unlimited" setting.
    :type layoutTimeout: float
    :param showStatusBar: Whether to render the status bar at all. When ``False``
        the reset, help and undo buttons, the mode/panel/tab read-outs and any
        ``actions`` are not shown; keyboard shortcuts keep working. Passing
        ``actions`` together with ``showStatusBar=False`` emits a
        :class:`UserWarning` because they would be unreachable. Defaults to ``True``.
    :type showStatusBar: bool
    :param statusBarPosition: Position of the status bar relative to the workspace.
        Options: ``'top'`` or ``'bottom'``. Defaults to ``'bottom'``.
    :type statusBarPosition: str
    :param actions: Array of :class:`dash_prism.Action` components to display in the status bar.
        Each action is a clickable button with its own ``n_clicks`` for callbacks.
    :type actions: list or None
    :param persistence: If ``True``, workspace state is persisted in the browser
        using the storage selected by ``persistence_type``. If ``False`` (default),
        nothing is written to storage and ``persistence_type`` is ignored.
    :type persistence: bool
    :param persistence_type: Where to persist workspace state when ``persistence``
        is ``True``. Options: ``'local'`` (localStorage, persists across browser
        sessions), ``'session'`` (sessionStorage, persists only for the current
        browser tab), ``'memory'`` (no storage, state is lost on page refresh).
        Defaults to ``'memory'``, so ``persistence=True`` on its own persists
        nothing: set ``persistence_type='local'`` or ``'session'`` as well. A
        :class:`UserWarning` is emitted for that no-op combination.
    :type persistence_type: str
    :param initialLayout: Layout ID to automatically load in the first tab on
        initial page load. Must match a layout registered via
        :func:`dash_prism.register_layout` before calling :func:`dash_prism.init`.
        Only applies on the very first load; if ``persistence`` is enabled and a
        saved workspace exists, the persisted state takes precedence.
    :type initialLayout: str or None
    :param newTabOpensDropdown: Whether opening a new tab should automatically
        focus the SearchBar and open the layout dropdown. If ``True`` (default),
        new tabs instantly show the layout dropdown for quick selection. If
        ``False``, users must click the SearchBar to see available layouts.
    :type newTabOpensDropdown: bool
    :param emptyTabView: What a tab with no layout selected shows in its body.
        ``'layouts'`` (default) shows a grid of all registered layouts with
        favorites first. ``'hint'`` shows a single line pointing users to the
        search bar. ``'none'`` shows an empty pane so users pick layouts through
        the search bar only. Combine ``'none'`` with ``newTabOpensDropdown=True``
        so new tabs still surface the layout list; the quiet combination with
        ``newTabOpensDropdown=False`` emits a :class:`UserWarning`.
    :type emptyTabView: str
    :param readWorkspace: Current workspace state, written by Prism for Dash.
        Use it as an ``Input`` or ``State`` in callbacks; Prism never reads it
        back. Keys: ``tabs`` (list of dict), ``panel`` (dict), ``panelTabs``
        (dict, tab order per panel), ``activeTabIds`` (dict), ``activePanelId``
        (str), ``favoriteLayouts`` (list of str), ``searchBarsHidden`` (bool).
        Updated at most every 500 ms after the first sync.
    :type readWorkspace: dict or None
    :param updateWorkspace: Workspace state pushed from Dash into Prism. Use it as
        an ``Output`` in callbacks. Partial updates are merged into the current
        workspace and healed: each tab's ``panelId`` decides which panel it belongs
        to and the order in ``panelTabs`` is kept. Feeding ``readWorkspace`` straight
        back in is a wasted round trip (Prism skips a sync whose workspace is
        unchanged), but a callback that returns a different workspace every time
        ping-pongs with Prism every 500 ms.
    :type updateWorkspace: dict or None
    :param children: Child components (typically :class:`dash_prism.PrismContent` instances).
        **Advanced** - Usually managed automatically by :func:`dash_prism.init`.
    :type children: list or None
    :param registeredLayouts: Registry of available layouts that can be rendered in tabs.
        **Advanced** - Automatically populated by :func:`dash_prism.init`.
    :type registeredLayouts: dict or None
    :param className: CSS class name(s) to add to the root container.
        Appended to Prism's internal classes. Useful for custom sizing or layout.
    :type className: str or None
    :param style: Inline CSS styles for the root container.
    :type style: dict or None

    .. rubric:: Examples

    Basic usage with registered layouts:

    .. code-block:: python

        import dash_prism
        from dash import Dash, html

        app = Dash(__name__)

        # Register layouts
        @dash_prism.register_layout(id='home', name='Home')
        def home_layout():
            return html.Div('Welcome to Prism!')

        @dash_prism.register_layout(id='about', name='About')
        def about_layout():
            return html.Div('About page')

        # Create app layout
        app.layout = html.Div([
            dash_prism.Prism(
                id='workspace',
                theme='light',
                maxTabs=10,
                persistence=True,
                persistence_type='local',
            )
        ])

        # Initialize Prism (injects layouts and creates callbacks)
        dash_prism.init('workspace', app)

        if __name__ == '__main__':
            app.run(debug=True)

    With status bar actions:

    .. code-block:: python

        from dash import Input, Output

        app.layout = html.Div([
            dash_prism.Prism(
                id='workspace',
                actions=[
                    dash_prism.Action(
                        id='save-btn',
                        label='Save',
                        tooltip='Save current workspace'
                    ),
                    dash_prism.Action(
                        id='export-btn',
                        label='Export',
                        tooltip='Export workspace data'
                    ),
                ],
            )
        ])

        @app.callback(
            Output('save-btn', 'loading'),
            Input('save-btn', 'n_clicks'),
            prevent_initial_call=True
        )
        def handle_save(n_clicks):
            # Perform save operation
            return False  # Stop loading spinner

    Reading workspace state:

    .. code-block:: python

        @app.callback(
            Output('workspace-info', 'children'),
            Input('workspace', 'readWorkspace')
        )
        def display_workspace_info(workspace):
            if not workspace:
                return "No workspace data"

            num_tabs = len(workspace.get('tabs', []))
            active_panel = workspace.get('activePanelId', 'none')

            return f"Tabs: {num_tabs}, Active Panel: {active_panel}"

    .. seealso::

        :class:`dash_prism.Action`
            Action button component for the status bar

        :func:`dash_prism.register_layout`
            Decorator/function to register layouts

        :func:`dash_prism.init`
            Initialize Prism with Dash app

    .. note::

        - This component requires initialization via :func:`dash_prism.init`
        - Layouts must be registered before calling ``init()``
        - The workspace state is managed internally and synced with Dash via callbacks
        - For best performance, limit ``maxTabs`` to a reasonable number (8-12)
    """

    # Override _type to match what init.py expects
    _type = "Prism"

    def __init__(
        self,
        # Identity
        id: str | None = _UNSET,
        className: str | None = _UNSET,
        style: dict[str, Any] | None = _UNSET,
        # Appearance
        theme: Literal["light", "dark"] = _UNSET,
        size: Literal["sm", "md", "lg"] = _UNSET,
        actions: Sequence[Component] | None = _UNSET,
        showStatusBar: bool = _UNSET,
        statusBarPosition: Literal["top", "bottom"] = _UNSET,
        # Persistence
        persistence: bool = _UNSET,
        persistence_type: Literal["memory", "session", "local"] = _UNSET,
        # Behavior
        maxTabs: int = _UNSET,
        initialLayout: str | None = _UNSET,
        newTabOpensDropdown: bool = _UNSET,
        emptyTabView: Literal["layouts", "hint", "none"] = _UNSET,
        searchBarPlaceholder: str = _UNSET,
        layoutTimeout: float = _UNSET,
        # Advanced — typically managed by dash_prism.init()
        children: list[Component] | None = _UNSET,
        serverSessionId: str | None = _UNSET,
        registeredLayouts: dict[str, Any] | None = _UNSET,
        readWorkspace: dict[str, Any] | None = _UNSET,
        updateWorkspace: dict[str, Any] | None = _UNSET,
        **kwargs: Any,
    ):
        # Only forward args the caller actually provided so that
        # _explicitize_args on the base class sees the correct set.
        _locals = locals()
        explicit = {
            k: v
            for k, v in _locals.items()
            if k not in ("self", "kwargs", "_locals", "__class__") and v is not _UNSET
        }
        explicit.update(kwargs)

        if (
            explicit.get("persistence") is True
            and explicit.get("persistence_type", "memory") == "memory"
        ):
            warnings.warn(
                "Prism(persistence=True) has no effect while persistence_type is 'memory' "
                "(the default). Pass persistence_type='local' or 'session' to persist the "
                "workspace, or drop persistence=True.",
                UserWarning,
                stacklevel=2,
            )

        if explicit.get("emptyTabView") == "none" and explicit.get("newTabOpensDropdown") is False:
            warnings.warn(
                "Prism(emptyTabView='none', newTabOpensDropdown=False): empty tabs will show "
                "nothing and the layout dropdown will not open automatically. Users must click "
                "the search bar or press Ctrl+Space to open a layout.",
                UserWarning,
                stacklevel=2,
            )

        if explicit.get("showStatusBar") is False and explicit.get("actions"):
            warnings.warn(
                "Prism(showStatusBar=False) hides the status bar, so the 'actions' passed to it "
                "will not be rendered. Drop the actions or keep the status bar visible.",
                UserWarning,
                stacklevel=2,
            )

        super().__init__(**explicit)
