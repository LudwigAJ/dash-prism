# AUTO GENERATED FILE - DO NOT EDIT

import typing  # noqa: F401
from typing_extensions import TypedDict, NotRequired, Literal  # noqa: F401
from dash.development.base_component import Component, _explicitize_args

ComponentType = typing.Union[
    str,
    int,
    float,
    Component,
    None,
    typing.Sequence[typing.Union[str, int, float, Component, None]],
]

NumberType = typing.Union[typing.SupportsFloat, typing.SupportsInt, typing.SupportsComplex]


class PrismComponent(Component):
    """A PrismComponent component.
    Advanced multi-panel workspace manager for Plotly Dash.
    Provides dynamic layout management with drag-and-drop tab organization,
    multi-panel splits, and persistent workspace state across sessions.

    Keyword arguments:

    - children (a list of or a singular dash component, string or number; optional):
        Child components (typically PrismContent instances).

    - id (string; optional):
        Unique ID to identify this component in Dash callbacks.

    - actions (list of a list of or a singular dash component, string or numbers; optional):
        Array of PrismAction components to display in the status bar. Each
        PrismAction has its own id and n_clicks for individual callbacks.

    - layoutTimeout (number; default 30):
        Timeout in seconds for layout loading. If children don't arrive
        within this time after a layout is selected, an error state is
        shown. Default is 30 seconds.

    - maxTabs (number; default 8):
        Maximum number of tabs allowed per panel.

    - persistence (boolean; default False):
        If to persist workspace state.

    - persistence_type (a value equal to: 'memory', 'session', 'local'; default 'memory'):
        Where to persist workspace state: 'local' for localStorage,
        'session' for sessionStorage, or 'memory' for no persistence.

    - readWorkspace (dict; optional):
        Read-only workspace state from Dash. Updates trigger re-hydration
        of the internal state.

        `readWorkspace` is a dict with keys:

        - tabs (list of dicts; required)

            `tabs` is a list of dicts with keys:

            - id (string; required)

            - name (string; required)

            - panelId (string; required)

            - createdAt (number; required)

            - layoutId (string; optional):

                Layout ID or empty string if no layout assigned.

            - layoutOption (string; optional)

            - layoutParams (dict with strings as keys and values of type string; optional)

            - locked (boolean; optional)

            - loading (boolean; optional)

            - icon (string; optional)

            - style (string; optional)

        - panel (dict; required)

            `panel` is a dict with keys:

            - id (string; required)

            - order (a value equal to: 0, 1; required)

            - direction (a value equal to: 'vertical', 'horizontal'; required)

            - pinned (boolean; optional)

            - children (list of boolean | number | string | dict | lists; required)

            - size (string | number; optional):
                Size as percentage (0-100).

        - panelTabs (dict with strings as keys and values of type list of strings; required)

        - activeTabIds (dict with strings as keys and values of type string; required)

        - activePanelId (string; required)

        - favoriteLayouts (list of strings; optional)

        - theme (a value equal to: 'light', 'dark'; optional)

        - searchBarsHidden (boolean; optional)

    - registeredLayouts (dict; optional):
        Registry of available layouts that can be rendered in tabs. Maps
        layout IDs to their configuration (name, params, options, etc).
        This is automatically populated by dash_prism.init().

        `registeredLayouts` is a dict with strings as keys and values of
        type dict with keys:

        - name (string; required)

        - description (string; optional)

        - keywords (list of strings; optional)

        - allowMultiple (boolean; optional)

        - params (list of dicts; optional)

            `params` is a list of dicts with keys:

            - name (string; required)

            - hasDefault (boolean; required)

            - default (string; optional)

        - paramOptions (dict; optional)

            `paramOptions` is a dict with keys:


    - searchBarPlaceholder (string; default 'Search layouts...'):
        Placeholder text shown in the search bar.

    - size (a value equal to: 'sm', 'md', 'lg'; default 'md'):
        Size variant affecting spacing and typography.

    - statusBarPosition (a value equal to: 'top', 'bottom'; default 'bottom'):
        Position of the status bar relative to the workspace.

    - theme (a value equal to: 'light', 'dark'; default 'light'):
        Visual theme for the workspace.

    - writeWorkspace (dict; optional):
        Write-only output property. Workspace state changes are written
        here for Dash callbacks.

        `writeWorkspace` is a dict with keys:

        - tabs (list of dicts; optional)

            `tabs` is a list of dicts with keys:

            - id (string; required)

            - name (string; required)

            - panelId (string; required)

            - createdAt (number; required)

            - layoutId (string; optional):

                Layout ID or empty string if no layout assigned.

            - layoutOption (string; optional)

            - layoutParams (dict with strings as keys and values of type string; optional)

            - locked (boolean; optional)

            - loading (boolean; optional)

            - icon (string; optional)

            - style (string; optional)

        - panel (dict; optional)

            `panel` is a dict with keys:

            - id (string; required)

            - order (a value equal to: 0, 1; required)

            - direction (a value equal to: 'vertical', 'horizontal'; required)

            - pinned (boolean; optional)

            - children (list of boolean | number | string | dict | lists; required)

            - size (string | number; optional):
                Size as percentage (0-100).

        - panelTabs (dict with strings as keys and values of type list of strings; optional)

        - activeTabIds (dict with strings as keys and values of type string; optional)

        - activePanelId (string; optional)

        - favoriteLayouts (list of strings; optional)

        - theme (a value equal to: 'light', 'dark'; optional)

        - searchBarsHidden (boolean; optional)"""

    _children_props: typing.List[str] = ["actions"]
    _base_nodes = ["actions", "children"]
    _namespace = "dash_prism"
    _type = "PrismComponent"
    RegisteredLayoutsParams = TypedDict(
        "RegisteredLayoutsParams", {"name": str, "hasDefault": bool, "default": NotRequired[str]}
    )

    RegisteredLayoutsParamOptions = TypedDict("RegisteredLayoutsParamOptions", {})

    RegisteredLayouts = TypedDict(
        "RegisteredLayouts",
        {
            "name": str,
            "description": NotRequired[str],
            "keywords": NotRequired[typing.Sequence[str]],
            "allowMultiple": NotRequired[bool],
            "params": NotRequired[typing.Sequence["RegisteredLayoutsParams"]],
            "paramOptions": NotRequired["RegisteredLayoutsParamOptions"],
        },
    )

    ReadWorkspaceTabs = TypedDict(
        "ReadWorkspaceTabs",
        {
            "id": str,
            "name": str,
            "panelId": str,
            "createdAt": NumberType,
            "layoutId": NotRequired[str],
            "layoutOption": NotRequired[str],
            "layoutParams": NotRequired[typing.Dict[typing.Union[str, float, int], str]],
            "locked": NotRequired[bool],
            "loading": NotRequired[bool],
            "icon": NotRequired[str],
            "style": NotRequired[str],
        },
    )

    ReadWorkspacePanel = TypedDict(
        "ReadWorkspacePanel",
        {
            "id": str,
            "order": Literal[0, 1],
            "direction": Literal["vertical", "horizontal"],
            "pinned": NotRequired[bool],
            "children": typing.Sequence[typing.Any],
            "size": NotRequired[typing.Union[str, NumberType]],
        },
    )

    ReadWorkspace = TypedDict(
        "ReadWorkspace",
        {
            "tabs": typing.Sequence["ReadWorkspaceTabs"],
            "panel": "ReadWorkspacePanel",
            "panelTabs": typing.Dict[typing.Union[str, float, int], typing.Sequence[str]],
            "activeTabIds": typing.Dict[typing.Union[str, float, int], str],
            "activePanelId": str,
            "favoriteLayouts": NotRequired[typing.Sequence[str]],
            "theme": NotRequired[Literal["light", "dark"]],
            "searchBarsHidden": NotRequired[bool],
        },
    )

    WriteWorkspaceTabs = TypedDict(
        "WriteWorkspaceTabs",
        {
            "id": str,
            "name": str,
            "panelId": str,
            "createdAt": NumberType,
            "layoutId": NotRequired[str],
            "layoutOption": NotRequired[str],
            "layoutParams": NotRequired[typing.Dict[typing.Union[str, float, int], str]],
            "locked": NotRequired[bool],
            "loading": NotRequired[bool],
            "icon": NotRequired[str],
            "style": NotRequired[str],
        },
    )

    WriteWorkspacePanel = TypedDict(
        "WriteWorkspacePanel",
        {
            "id": str,
            "order": Literal[0, 1],
            "direction": Literal["vertical", "horizontal"],
            "pinned": NotRequired[bool],
            "children": typing.Sequence[typing.Any],
            "size": NotRequired[typing.Union[str, NumberType]],
        },
    )

    WriteWorkspace = TypedDict(
        "WriteWorkspace",
        {
            "tabs": NotRequired[typing.Sequence["WriteWorkspaceTabs"]],
            "panel": NotRequired["WriteWorkspacePanel"],
            "panelTabs": NotRequired[
                typing.Dict[typing.Union[str, float, int], typing.Sequence[str]]
            ],
            "activeTabIds": NotRequired[typing.Dict[typing.Union[str, float, int], str]],
            "activePanelId": NotRequired[str],
            "favoriteLayouts": NotRequired[typing.Sequence[str]],
            "theme": NotRequired[Literal["light", "dark"]],
            "searchBarsHidden": NotRequired[bool],
        },
    )

    def __init__(
        self,
        children: typing.Optional[ComponentType] = None,
        id: typing.Optional[typing.Union[str, dict]] = None,
        registeredLayouts: typing.Optional[
            typing.Dict[typing.Union[str, float, int], "RegisteredLayouts"]
        ] = None,
        theme: typing.Optional[Literal["light", "dark"]] = None,
        size: typing.Optional[Literal["sm", "md", "lg"]] = None,
        maxTabs: typing.Optional[NumberType] = None,
        searchBarPlaceholder: typing.Optional[str] = None,
        layoutTimeout: typing.Optional[NumberType] = None,
        statusBarPosition: typing.Optional[Literal["top", "bottom"]] = None,
        readWorkspace: typing.Optional["ReadWorkspace"] = None,
        writeWorkspace: typing.Optional["WriteWorkspace"] = None,
        actions: typing.Optional[typing.Sequence[ComponentType]] = None,
        persistence: typing.Optional[bool] = None,
        persistence_type: typing.Optional[Literal["memory", "session", "local"]] = None,
        style: typing.Optional[typing.Any] = None,
        **kwargs,
    ):
        self._prop_names = [
            "children",
            "id",
            "actions",
            "layoutTimeout",
            "maxTabs",
            "persistence",
            "persistence_type",
            "readWorkspace",
            "registeredLayouts",
            "searchBarPlaceholder",
            "size",
            "statusBarPosition",
            "style",
            "theme",
            "writeWorkspace",
        ]
        self._valid_wildcard_attributes = []
        self.available_properties = [
            "children",
            "id",
            "actions",
            "layoutTimeout",
            "maxTabs",
            "persistence",
            "persistence_type",
            "readWorkspace",
            "registeredLayouts",
            "searchBarPlaceholder",
            "size",
            "statusBarPosition",
            "style",
            "theme",
            "writeWorkspace",
        ]
        self.available_wildcard_properties = []
        _explicit_args = kwargs.pop("_explicit_args")
        _locals = locals()
        _locals.update(kwargs)  # For wildcard attrs and excess named props
        args = {k: _locals[k] for k in _explicit_args if k != "children"}

        for k in ["style"]:
            if k not in args:
                raise TypeError("Required argument `" + k + "` was not specified.")

        super(PrismComponent, self).__init__(children=children, **args)


setattr(PrismComponent, "__init__", _explicitize_args(PrismComponent.__init__))
