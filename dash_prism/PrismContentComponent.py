# AUTO GENERATED FILE - DO NOT EDIT

import typing  # noqa: F401
from typing_extensions import TypedDict, NotRequired, Literal # noqa: F401
from dash.development.base_component import Component, _explicitize_args

ComponentSingleType = typing.Union[str, int, float, Component, None]
ComponentType = typing.Union[
    ComponentSingleType,
    typing.Sequence[ComponentSingleType],
]

NumberType = typing.Union[
    typing.SupportsFloat, typing.SupportsInt, typing.SupportsComplex
]


class PrismContentComponent(Component):
    """A PrismContentComponent component.
Renders Dash component content within Prism tabs.
Used internally by Prism to render tab content.
Exposes props `id` and `data` for Dash to pass tab/layout info.

Keyword arguments:

- children (a list of or a singular dash component, string or number; optional):
    Child Dash Components.

- id (string; optional):
    Unique ID to identify this component in Dash callbacks.

- data (dict; optional):
    Data props passed from Dash (tabId, layoutId, layoutParams,
    layoutOption).

    `data` is a dict with keys:

    - tabId (string; optional)

    - layoutId (string; optional)

    - layoutParams (dict with strings as keys and values of type string; optional)

    - layoutOption (string; optional)

- layoutTimeout (number; default 30):
    Timeout in seconds for layout loading. Only triggers when layoutId
    is set but children don't arrive. Default is 30 seconds."""
    _children_props: typing.List[str] = []
    _base_nodes = ['children']
    _namespace = 'dash_prism'
    _type = 'PrismContentComponent'
    Data = TypedDict(
        "Data",
            {
            "tabId": NotRequired[str],
            "layoutId": NotRequired[str],
            "layoutParams": NotRequired[typing.Dict[typing.Union[str, float, int], str]],
            "layoutOption": NotRequired[str]
        }
    )


    def __init__(
        self,
        children: typing.Optional[ComponentType] = None,
        data: typing.Optional["Data"] = None,
        layoutTimeout: typing.Optional[NumberType] = None,
        id: typing.Optional[typing.Union[str, dict]] = None,
        **kwargs
    ):
        self._prop_names = ['children', 'id', 'data', 'layoutTimeout']
        self._valid_wildcard_attributes =            []
        self.available_properties = ['children', 'id', 'data', 'layoutTimeout']
        self.available_wildcard_properties =            []
        _explicit_args = kwargs.pop('_explicit_args')
        _locals = locals()
        _locals.update(kwargs)  # For wildcard attrs and excess named props
        args = {k: _locals[k] for k in _explicit_args if k != 'children'}

        super(PrismContentComponent, self).__init__(children=children, **args)

setattr(PrismContentComponent, "__init__", _explicitize_args(PrismContentComponent.__init__))
