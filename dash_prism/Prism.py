"""Hand-written wrapper for the Prism component.

This module holds the public Python API of the Prism component. The class
:class:`Prism` is a subclass of the auto-generated :class:`PrismComponent`, and
adds three things: the documentation of every prop, Python type hints, and a
warning for each prop combination that does nothing.

The build step ``dash-generate-components`` writes ``PrismComponent.py`` again
from the TypeScript source. Thus do not edit that file. Edit this wrapper
instead.
"""

from __future__ import annotations

import warnings
from collections.abc import Sequence
from typing import Any, Literal

from dash.development.base_component import Component

from .PrismComponent import PrismComponent

# Sentinel default for every keyword argument. Dash must know which props the
# caller gave. An explicit ``None`` reaches the browser as ``null`` and clears
# the prop, but an omitted argument keeps the default of the React component.
_UNSET: Any = type("_Unset", (), {"__repr__": lambda self: "_UNSET"})()


class Prism(PrismComponent):
    """Multi-panel workspace manager for Plotly Dash.

    Prism gives a Dash application a tabbed workspace. A user opens a tab for
    each registered layout, drags a tab into a different panel, and splits the
    workspace into more panels. Prism renders the content of each tab through a
    Dash callback that :func:`dash_prism.init` registers. Prism can also store
    the workspace in the browser, thus the user finds the same tabs after a
    page reload.

    **Features:**

    - **Tab management**: The user can open, close, rename, reorder, lock and
      duplicate a tab.
    - **Multi-panel layouts**: A drag to the edge of a panel, or a click on the
      split button, divides the workspace into more panels.
    - **Persistent state**: Prism can store the workspace in ``localStorage``
      or in ``sessionStorage``.
    - **Layout registry**: :func:`dash_prism.register_layout` registers a
      layout with its parameters and its keywords.
    - **Async support**: A layout callback can be synchronous or ``async``.
    - **Type-safe**: This wrapper has complete type hints for Python 3.10 and
      later versions.

    :param id: The unique identifier of this component in Dash callbacks. A
        callback reads the workspace state, or updates a prop, through this ID.
        The ID also scopes the persisted workspace, which Prism stores under the
        key ``persist:prism-workspace-<id>``. Prism reads the ID one time, when
        the component mounts. A later change of the ID remounts the workspace
        and starts a new undo history.
    :type id: str or None
    :param serverSessionId: The fingerprint of the server-side layout registry,
        stored with the persisted workspace. When the workspace loads, Prism
        closes each tab whose layout is not in ``registeredLayouts`` any more.
        Prism keeps the rest of the workspace and records the new fingerprint. A
        closed tab shows no "Layout not found" error, but a toast tells the user
        how many tabs Prism closed. :func:`dash_prism.init` computes the
        fingerprint from the registered layout IDs, thus the value is the same
        on every worker and after each restart. The tabs that Prism closes
        depend only on ``registeredLayouts``, and Prism closes no tab while that
        registry is empty. If you set this prop yourself,
        :func:`dash_prism.init` keeps your value, and only the recorded
        fingerprint changes.
    :type serverSessionId: str or None
    :param theme: The visual theme of the workspace, ``'light'`` (the default)
        or ``'dark'``. Prism writes the theme to the ``data-prism-theme``
        attribute of the page root. Thus the theme also applies to the menus and
        the dialogs that Prism renders outside the workspace element.
    :type theme: str
    :param size: The size variant of the workspace. Prism sets a root font size
        of 12 px for ``'sm'``, 14 px for ``'md'`` (the default) and 16 px for
        ``'lg'``. The tab bar, the status bar and the search bar use ``em``
        units, thus each of them scales with this font size.
    :type size: str
    :param maxTabs: The maximum number of tabs in the whole workspace, ``16`` by
        default. The limit counts every panel together and not one panel at a
        time. At the limit, Prism refuses a new tab, a duplicate of a tab
        and a tab from a share link. A value less than ``1``, for example ``0``
        or ``-1``, means that Prism applies no limit. A callback can change the
        limit at any time. Prism keeps the existing tabs and the undo history,
        and applies the new limit to the next tab action.
    :type maxTabs: int
    :param maxPanels: The maximum number of leaf panels in the workspace, ``20``
        by default. At the limit, Prism hides the split button and disables the
        edge drop zones, thus the user cannot split a panel again. A value of
        ``1`` disables the split function completely. A value less than ``1``,
        and an explicit ``None``, mean that Prism applies no limit.
    :type maxPanels: int or None
    :param searchBarPlaceholder: The placeholder text of the layout search bar
        of each panel. The default is ``'Search layouts...'``.
    :type searchBarPlaceholder: str
    :param layoutTimeout: The time limit in seconds for the load of a layout,
        ``30`` by default. In the browser, a tab shows a timeout card when its
        content does not arrive within this time. On the server, the render
        callback stops a layout callback that runs longer, and renders an error
        tab. The server limit applies to each ``async`` layout callback in every
        application. The server limit applies to a synchronous layout callback
        only when you make the Dash application with ``use_async=True``. Prism
        cannot stop a synchronous callback in a synchronous application.
        ``None``, ``0``, a negative number and any other value that is not a
        finite positive number fall back to ``30``. This fallback applies in the
        browser and on the server, and you cannot disable the limit.
    :type layoutTimeout: float
    :param showStatusBar: Prism renders the status bar when this prop is
        ``True``, which is the default. When the prop is ``False``, Prism hides
        the reset, help and undo buttons, the mode, panel and tab read-outs, and
        every component in ``actions``. The keyboard shortcuts continue to
        operate. The wrapper gives a :class:`UserWarning` when you pass
        ``actions`` together with ``showStatusBar=False``, because the user
        cannot reach those actions.
    :type showStatusBar: bool
    :param statusBarPosition: The position of the status bar. ``'bottom'`` (the
        default) puts the bar below the panels, and ``'top'`` puts the bar above
        the panels.
    :type statusBarPosition: str
    :param statusBarItems: The built-in status bar segments to show, in the
        order that you give them. The default shows all eight segments in this
        order: ``'reset'``, ``'help'``, ``'undo'``, ``'mode'``, ``'panels'``,
        ``'tab'``, ``'count'``, ``'updated'``. Prism always puts ``'updated'``
        at the far right of the bar, after every component in ``actions``. Prism
        ignores an unknown name, and keeps only the first of a name that you
        give two times. An empty list leaves only the actions in the bar, and
        ``showStatusBar=False`` hides the whole bar.
    :type statusBarItems: list[str]
    :param actions: The :class:`dash_prism.Action` components that Prism shows
        in the status bar, between the built-in segments and the ``'updated'``
        segment. Each action is a button with its own ``n_clicks`` prop, thus
        one callback can listen to one button.
    :type actions: list or None
    :param persistence: Prism stores the workspace in the browser when this prop
        is ``True``. The default is ``False``. Prism then writes nothing to
        storage and ignores ``persistence_type``. Prism reads this prop one
        time, when the component mounts. A later change of the storage that
        Prism uses remounts the workspace and starts a new undo history.
    :type persistence: bool
    :param persistence_type: The storage that Prism uses while ``persistence``
        is ``True``. ``'local'`` uses ``localStorage``, which keeps the
        workspace after the user closes the browser. ``'session'`` uses
        ``sessionStorage``, which keeps the workspace only for the current
        browser tab. ``'memory'`` (the default) uses no storage, thus a page
        refresh loses the workspace. Because the default is ``'memory'``,
        ``persistence=True`` alone stores nothing, and the wrapper gives a
        :class:`UserWarning` for that combination. Prism reads this prop one
        time, when the component mounts. A later change of the storage that
        Prism uses remounts the workspace and starts a new undo history.
    :type persistence_type: str
    :param initialLayout: The ID of the layout that Prism opens in the first
        tab. The ID must belong to a layout that you register with
        :func:`dash_prism.register_layout` before you call
        :func:`dash_prism.init`. Prism applies the prop one time for each mount
        of the workspace, and only while the workspace holds one tab that has no
        layout. Thus a workspace that comes back from storage, and a workspace
        with more than one tab, keep their own content.
    :type initialLayout: str or None
    :param newTabOpensDropdown: Prism focuses the search bar of the panel and
        opens the layout dropdown for each new tab when this prop is ``True``,
        which is the default. When the prop is ``False``, the user must click
        the search bar, or press Ctrl+Space, to see the layouts.
    :type newTabOpensDropdown: bool
    :param emptyTabView: The content of a tab that has no layout. ``'layouts'``
        (the default) shows a grid of every registered layout, with the favorite
        layouts first. ``'hint'`` shows one line that points the user to the
        search bar. ``'none'`` shows an empty pane, thus the user opens a layout
        from the search bar only. Prism falls back to ``'layouts'`` for an
        unknown value. The combination of ``'none'`` with
        ``newTabOpensDropdown=False`` leaves the user no visible way to open a
        layout, and the wrapper gives a :class:`UserWarning` for that
        combination.
    :type emptyTabView: str
    :param enableKeyboardShortcuts: Prism installs its keyboard shortcuts when
        this prop is ``True``, which is the default. Ctrl/Cmd+Alt+N opens a new
        tab and Ctrl+Space opens the search bar. Ctrl/Cmd with D, J, K, O, I, R,
        Shift+R, Y, B or U gives the tab and panel commands. A value of
        ``False`` prevents a conflict with the shortcuts of your own
        application. Prism then also hides the shortcut hints in the tab context
        menu and in an empty tab, and the help dialog shows no keyboard
        section.
    :type enableKeyboardShortcuts: bool
    :param enableShareLinks: Prism adds a "Share" command to the context menu of
        each tab that has a layout when this prop is ``True``, which is the
        default. The command copies a link that carries the tab in a ``#p:``
        hash. Prism also opens a tab from such a hash in the page URL. An
        application that must not give deep links to its users, or that uses the
        URL hash itself, sets this prop to ``False``. Prism then removes the
        command and does not read the hash.
    :type enableShareLinks: bool
    :param readWorkspace: The current workspace state, which Prism writes for
        Dash (Prism -> Dash). A callback reads it as an ``Input`` or a ``State``, and Prism
        never reads the prop back. The keys are ``tabs`` (a list of dict),
        ``panel`` (the dict with the panel tree), ``panelTabs`` (the dict with
        the tab order of each panel), ``activeTabIds`` (a dict),
        ``activePanelId`` (a str), ``favoriteLayouts`` (a list of str) and
        ``searchBarsHidden`` (a bool). Prism writes the first state
        immediately. After that, Prism waits until 500 ms after the last
        change, and then writes the state one time.
    :type readWorkspace: dict or None
    :param updateWorkspace: The workspace state that Dash pushes into Prism
        (Dash -> Prism). A callback sets it as an ``Output``. Prism merges a partial update into
        the current workspace and then heals the result. The ``panelId`` of a
        tab decides the panel of that tab, and Prism removes a tab that points
        to a panel that does not exist. Prism keeps the tab order in
        ``panelTabs``, and repairs ``activeTabIds`` and ``activePanelId`` that
        point to a tab or a panel that is gone. A callback that returns
        ``readWorkspace`` without a change costs one round trip and nothing
        more, because Prism skips a sync of an unchanged workspace. But a
        callback that returns a different workspace each time makes Prism and
        the callback send updates to each other without end.
    :type updateWorkspace: dict or None
    :param children: More Dash components for Prism to render at the end of the
        workspace, after the panels and the status bar. **Advanced** — the tab
        content does not come through this prop. Prism's frontend makes one
        :class:`dash_prism.PrismContent` host for each tab with a layout, and
        the callback that :func:`dash_prism.init` registers fills each host.
    :type children: list or None
    :param registeredLayouts: The registry of the layouts that a tab can render.
        **Advanced** — :func:`dash_prism.init` fills this prop from the layouts
        that :func:`dash_prism.register_layout` registered. A callback can also
        write a new registry while the application runs.
    :type registeredLayouts: dict or None
    :param className: One or more CSS class names for the root container. Prism
        adds them after its own classes, thus a rule of yours can control the
        size or the position of the workspace.
    :type className: str or None
    :param style: Inline CSS styles for the root container. Prism gives the
        container no height of its own, thus a height in this prop, or in a rule
        for ``className``, is normally necessary.
    :type style: dict or None

    .. rubric:: Examples

    A basic application with two registered layouts:

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

    Two action buttons in the status bar:

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
            # Save the data here
            return False  # Stop loading spinner

    A callback that reads the workspace state:

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
            The action button component for the status bar.

        :func:`dash_prism.register_layout`
            The decorator, or plain function, that registers a layout.

        :func:`dash_prism.init`
            The function that connects Prism to the Dash application.

    .. note::

        - Prism does no work until you call :func:`dash_prism.init`, which
          injects the layout registry and registers the render callback.
        - You must register every layout before you call ``init()``.
        - Prism holds the workspace state in the browser and copies it to Dash
          through the ``readWorkspace`` prop.
        - Prism keeps each tab that has a layout mounted, even while the tab is
          not visible. Thus a large number of open tabs uses more memory in the
          browser.
    """

    # The generated base class sets ``_type`` to "PrismComponent". The React
    # bundle exports the component as ``Prism``, and :func:`dash_prism.init`
    # refuses a component whose ``_type`` is not "Prism", thus the override is
    # necessary for both the renderer and init().
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
        statusBarItems: Sequence[
            Literal["reset", "help", "undo", "mode", "panels", "tab", "count", "updated"]
        ] = _UNSET,
        # Persistence
        persistence: bool = _UNSET,
        persistence_type: Literal["memory", "session", "local"] = _UNSET,
        # Behavior
        maxTabs: int = _UNSET,
        maxPanels: int = _UNSET,
        initialLayout: str | None = _UNSET,
        newTabOpensDropdown: bool = _UNSET,
        emptyTabView: Literal["layouts", "hint", "none"] = _UNSET,
        enableKeyboardShortcuts: bool = _UNSET,
        enableShareLinks: bool = _UNSET,
        searchBarPlaceholder: str = _UNSET,
        layoutTimeout: float = _UNSET,
        # Advanced props that init(), the frontend or a callback normally sets
        children: list[Component] | None = _UNSET,
        serverSessionId: str | None = _UNSET,
        registeredLayouts: dict[str, Any] | None = _UNSET,
        readWorkspace: dict[str, Any] | None = _UNSET,
        updateWorkspace: dict[str, Any] | None = _UNSET,
        **kwargs: Any,
    ):
        # Forward only the arguments that the caller gave. The sentinel keeps
        # an omitted argument out of the dict, thus ``_explicitize_args`` on
        # the base class sees the same set of props as a direct call to
        # ``PrismComponent``, and the React defaults stay in control.
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
