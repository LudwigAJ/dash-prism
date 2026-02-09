"""Action Component Wrapper.

User-facing wrapper for the Action component with comprehensive documentation.
This file provides a clean Python API that wraps the auto-generated PrismActionComponent.
"""

from __future__ import annotations

from typing import Any

from .PrismActionComponent import PrismActionComponent

# Sentinel to distinguish "not provided" from an explicit None
_UNSET: Any = type("_Unset", (), {"__repr__": lambda self: "_UNSET"})()


class Action(PrismActionComponent):
    """A clickable action button for the Prism status bar.

    Action components are displayed in the status bar and provide
    interactive buttons that users can click to trigger callbacks. Each action
    is an independent Dash component with its own ``n_clicks`` property,
    allowing for individual callback handling per button.

    :param id: Unique identifier for this action in Dash callbacks.
        Use this ID to create callbacks responding to button clicks.
    :type id: str or None
    :param label: Button label text displayed in the status bar.
        This is the visible text users will see on the button. **Required**.
    :type label: str
    :param tooltip: Tooltip text shown on hover.
        If not provided, defaults to ``"Click to trigger {label}"``.
    :type tooltip: str or None
    :param variant: Button style variant or custom hex color.
        Preset variants: ``'default'``, ``'primary'``, ``'secondary'``,
        ``'success'``, ``'warning'``, ``'danger'``.
        Custom color: Any valid hex color (e.g., ``'#FF5500'``).
    :type variant: str or None
    :param disabled: Whether the button is disabled. Disabled buttons cannot
        be clicked and appear grayed out. Can be controlled via Dash callbacks
        for dynamic enabling/disabling. Defaults to ``False``.
    :type disabled: bool
    :param loading: Whether to show a loading spinner. When ``True``, replaces
        the icon with a spinner and disables the button. Useful for indicating
        async operations are in progress. Defaults to ``False``.
    :type loading: bool
    :param n_clicks: Number of times the button has been clicked. Use as an
        ``Input`` in Dash callbacks to respond to clicks. Automatically
        incremented each time the button is clicked. Defaults to ``0``.
    :type n_clicks: int

    .. rubric:: Examples

    Basic action button:

    .. code-block:: python

        import dash_prism
        from dash import Dash, html, Input, Output

        app = Dash(__name__)

        app.layout = html.Div([
            dash_prism.Prism(
                id='workspace',
                actions=[
                    dash_prism.Action(
                        id='save-action',
                        label='Save',
                        tooltip='Save current workspace'
                    )
                ]
            )
        ])

        @app.callback(
            Output('save-action', 'loading'),
            Input('save-action', 'n_clicks'),
            prevent_initial_call=True
        )
        def handle_save(n_clicks):
            # Perform save operation
            import time
            time.sleep(1)  # Simulate async operation
            return False  # Stop loading spinner

    Multiple actions with different styles:

    .. code-block:: python

        actions = [
            dash_prism.Action(
                id='save',
                label='Save',
                variant='primary'
            ),
            dash_prism.Action(
                id='export',
                label='Export',
                variant='secondary'
            ),
            dash_prism.Action(
                id='delete',
                label='Delete All',
                variant='danger',
                tooltip='WARNING: This will delete all data'
            ),
        ]

        app.layout = html.Div([
            dash_prism.Prism(id='workspace', actions=actions)
        ])

    Dynamic enabling/disabling:

    .. code-block:: python

        from dash import State

        @app.callback(
            Output('save-action', 'disabled'),
            Input('workspace', 'readWorkspace')
        )
        def update_save_button(workspace):
            # Disable save button if no tabs are open
            if not workspace or not workspace.get('tabs'):
                return True  # Disabled
            return False  # Enabled

    Custom color action:

    .. code-block:: python

        custom_action = dash_prism.Action(
            id='custom',
            label='Custom',
            variant='#FF5500',  # Custom orange color
            tooltip='Custom colored action'
        )

    Loading state management:

    .. code-block:: python

        @app.callback(
            Output('export-action', 'loading'),
            Input('export-action', 'n_clicks'),
            prevent_initial_call=True
        )
        def handle_export(n_clicks):
            # Set loading=True while operation runs
            import time
            time.sleep(2)  # Simulate export operation
            return False  # Loading complete

    .. seealso::

        :class:`Prism`
            Main workspace component

        :func:`dash_prism.init`
            Initialize Prism with Dash app

    .. note::

        - Actions must be passed to the Prism component's ``actions`` parameter
        - Each action has an independent ``n_clicks`` counter
        - The ``loading`` state automatically disables the button
        - Custom hex colors must be valid CSS hex colors (e.g., ``#RGB`` or ``#RRGGBB``)
    """

    # Override _type to match what init.py expects (internal wire protocol)
    _type = "PrismAction"

    def __init__(
        self,
        label: str = _UNSET,
        id: str | None = _UNSET,
        tooltip: str | None = _UNSET,
        variant: str | None = _UNSET,
        disabled: bool = _UNSET,
        loading: bool = _UNSET,
        n_clicks: int = _UNSET,
        **kwargs: Any,
    ):
        _locals = locals()
        explicit = {
            k: v
            for k, v in _locals.items()
            if k not in ("self", "kwargs", "_locals", "__class__") and v is not _UNSET
        }
        explicit.update(kwargs)
        super().__init__(**explicit)


# Backwards compatibility alias
PrismAction = Action
