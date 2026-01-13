# AUTO GENERATED FILE - DO NOT EDIT

import typing  # noqa: F401
from typing_extensions import TypedDict, NotRequired, Literal # noqa: F401
from dash.development.base_component import Component, _explicitize_args

ComponentType = typing.Union[
    str,
    int,
    float,
    Component,
    None,
    typing.Sequence[typing.Union[str, int, float, Component, None]],
]

NumberType = typing.Union[
    typing.SupportsFloat, typing.SupportsInt, typing.SupportsComplex
]


class PrismActionComponent(Component):
    """A PrismActionComponent component.
A clickable action button for the Prism StatusBar.
Each PrismAction is a Dash component with its own n_clicks prop,
allowing individual callbacks per action button.

Keyword arguments:

- id (string; optional):
    Unique ID to identify this component in Dash callbacks.

- disabled (boolean; default False):
    Whether the button is disabled. Can be controlled via Dash
    callbacks.

- icon (string; optional):
    Lucide icon name to display before the label. See:
    https://lucide.dev/icons.

- label (string; required):
    Button label text displayed in the StatusBar.

- loading (boolean; default False):
    Whether to show a loading spinner. Can be controlled via Dash
    callbacks.

- n_clicks (number; default 0):
    Number of times the button has been clicked. Use as Input in Dash
    callbacks to respond to clicks.

- tooltip (string; optional):
    Tooltip text shown on hover. If not provided, defaults to \"Click
    to trigger {label}\"."""
    _children_props: typing.List[str] = []
    _base_nodes = ['children']
    _namespace = 'dash_prism'
    _type = 'PrismActionComponent'


    def __init__(
        self,
        label: typing.Optional[str] = None,
        icon: typing.Optional[str] = None,
        tooltip: typing.Optional[str] = None,
        style: typing.Optional[typing.Any] = None,
        disabled: typing.Optional[bool] = None,
        loading: typing.Optional[bool] = None,
        n_clicks: typing.Optional[NumberType] = None,
        id: typing.Optional[typing.Union[str, dict]] = None,
        **kwargs
    ):
        self._prop_names = ['id', 'disabled', 'icon', 'label', 'loading', 'n_clicks', 'style', 'tooltip']
        self._valid_wildcard_attributes =            []
        self.available_properties = ['id', 'disabled', 'icon', 'label', 'loading', 'n_clicks', 'style', 'tooltip']
        self.available_wildcard_properties =            []
        _explicit_args = kwargs.pop('_explicit_args')
        _locals = locals()
        _locals.update(kwargs)  # For wildcard attrs and excess named props
        args = {k: _locals[k] for k in _explicit_args}

        for k in ['label']:
            if k not in args:
                raise TypeError(
                    'Required argument `' + k + '` was not specified.')

        super(PrismActionComponent, self).__init__(**args)

setattr(PrismActionComponent, "__init__", _explicitize_args(PrismActionComponent.__init__))
