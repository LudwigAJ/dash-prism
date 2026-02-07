"""Prism Component Wrapper.

User-facing wrapper for the Prism component with comprehensive documentation.
This file provides a clean Python API that wraps the auto-generated PrismComponent.
"""

from __future__ import annotations

from typing import Any, Literal, Sequence

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
    :param serverSessionId: Server session identifier used to invalidate
        stale persisted workspaces after server restarts. Automatically set
        by :func:`dash_prism.init` unless explicitly provided.
    :type serverSessionId: str or None
    :param theme: Visual theme for the workspace. Controls colors, backgrounds,
        and overall appearance. Defaults to ``'light'``.
    :type theme: str
    :param size: Size variant affecting spacing, typography, and UI element sizing.
        Options: ``'sm'`` (small), ``'md'`` (medium, default), ``'lg'`` (large).
        Defaults to ``'md'``.
    :type size: str
    :param maxTabs: Maximum number of tabs allowed in the workspace. Prevents users
        from creating too many tabs which could impact performance. Values less than
        ``1`` (e.g., ``0`` or ``-1``) mean unlimited tabs. Defaults to ``16``.
    :type maxTabs: int
    :param searchBarPlaceholder: Placeholder text shown in the layout search bar.
        Defaults to ``'Search layouts...'``.
    :type searchBarPlaceholder: str
    :param layoutTimeout: Timeout in seconds for layout loading. If a layout callback
        doesn't respond within this time, an error state is shown. Defaults to ``30``.
    :type layoutTimeout: int
    :param statusBarPosition: Position of the status bar relative to the workspace.
        Options: ``'top'`` or ``'bottom'``. Defaults to ``'bottom'``.
    :type statusBarPosition: str
    :param actions: Array of :class:`Action` components to display in the status bar.
        Each action is a clickable button with its own ``n_clicks`` for callbacks.
    :type actions: list[Action] or None
    :param persistence: If ``True``, workspace state is persisted across browser sessions.
        The persistence method is controlled by ``persistence_type``. Defaults to ``False``.
    :type persistence: bool
    :param persistence_type: Where to persist workspace state. Options:
        ``'local'`` (localStorage, persists across browser sessions),
        ``'session'`` (sessionStorage, persists only for current tab session),
        ``'memory'`` (no persistence, state lost on page refresh).
        Defaults to ``'memory'``.
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
    :param readWorkspace: **Output property** - Read-only workspace state from Dash.
        Use as an ``Output`` in callbacks to react to workspace changes.
        The workspace dict contains: ``tabs`` (list of dict), ``panel`` (dict),
        ``activePanelId`` (str), ``activeTabIds`` (dict).
    :type readWorkspace: dict or None
    :param updateWorkspace: **Input property** - Write workspace state to Prism.
        Use as an ``Input`` in callbacks to programmatically update the workspace.
        Partial updates are supported.
    :type updateWorkspace: dict or None
    :param children: Child components (typically :class:`PrismContent` instances).
        **Advanced** - Usually managed automatically by :func:`dash_prism.init`.
    :type children: list or None
    :param registeredLayouts: Registry of available layouts that can be rendered in tabs.
        **Advanced** - Automatically populated by :func:`dash_prism.init`.
    :type registeredLayouts: dict or None
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
            app.run_server(debug=True)

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
                        icon='Save',
                        tooltip='Save current workspace'
                    ),
                    dash_prism.Action(
                        id='export-btn',
                        label='Export',
                        icon='Download',
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

        :class:`Action`
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
        style: dict[str, Any] | None = _UNSET,
        # Appearance
        theme: Literal["light", "dark"] = _UNSET,
        size: Literal["sm", "md", "lg"] = _UNSET,
        actions: Sequence[Component] | None = _UNSET,
        statusBarPosition: Literal["top", "bottom"] = _UNSET,
        # Persistence
        persistence: bool = _UNSET,
        persistence_type: Literal["memory", "session", "local"] = _UNSET,
        # Behavior
        maxTabs: int = _UNSET,
        initialLayout: str | None = _UNSET,
        newTabOpensDropdown: bool = _UNSET,
        searchBarPlaceholder: str = _UNSET,
        layoutTimeout: int = _UNSET,
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
        super().__init__(**explicit)
