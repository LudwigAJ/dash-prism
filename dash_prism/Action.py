"""Action Component Wrapper.

This module holds the user-facing ``Action`` class. ``Action`` wraps the
auto-generated :class:`dash_prism.PrismActionComponent`, documents each prop,
and sets the component type that the JavaScript bundle registers. The wrapper
sends only the props that you give. The React component keeps its own defaults
for every prop that you omit.
"""

from __future__ import annotations

from typing import Any

from dash_prism import _component_base
from dash_prism.PrismActionComponent import PrismActionComponent


class Action(PrismActionComponent):
    """A clickable action button for the Prism status bar.

    Prism shows each action as a button in the status bar, at the right end and
    in the order that you give. An action is a full Dash component with its own
    ``n_clicks`` property, thus one callback can listen to one button. Prism
    increases ``n_clicks`` by one for each click. A click on a disabled button,
    or on a button in the loading state, does not change ``n_clicks``.

    :param label: Button label text that the status bar shows. This text is
        what the user reads on the button. **Required**.
    :type label: str
    :param id: Unique identifier for this action in Dash callbacks. Use this ID
        to make the callbacks that respond to clicks on this button.
    :type id: str or None
    :param tooltip: Tooltip text that the button shows when the pointer is on
        it. If you do not give a tooltip, the button shows
        ``Click to trigger "{label}"``.
    :type tooltip: str or None
    :param variant: Button style name, or a hex color for the button
        background. The style names are ``'default'``, ``'primary'``,
        ``'secondary'``, ``'success'``, ``'warning'`` and ``'danger'``. A hex
        color must have the form ``#RGB`` or ``#RRGGBB``, for example
        ``'#FF5500'``. For a hex color, Prism sets the label to black or to
        white, the color that is easier to read on that background. A value
        that is neither a style name nor a hex color gives the ``'default'``
        style. Defaults to ``'default'``.
    :type variant: str or None
    :param disabled: Whether the button is disabled. The user cannot click a
        disabled button, and Prism shows the button at half opacity. Set this
        prop from a Dash callback to disable or enable the button while the app
        runs. Defaults to ``False``.
    :type disabled: bool
    :param loading: Whether the button shows a loading spinner. When this prop
        is ``True``, Prism puts a spinner before the label and disables the
        button. Use the loading state to show that a slow callback is not
        complete. Defaults to ``False``.
    :type loading: bool
    :param n_clicks: Number of clicks on this button. Use it as an ``Input`` in
        Dash callbacks to respond to a click. Defaults to ``0``.
    :type n_clicks: int
    :raises TypeError: If you do not give ``label``.

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
            # Save the data here
            import time
            time.sleep(1)  # Simulate async operation
            return False  # Stop loading spinner

    Some actions with different styles:

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

    Disable and enable an action from a callback:

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

    An action with a hex color:

    .. code-block:: python

        custom_action = dash_prism.Action(
            id='custom',
            label='Custom',
            variant='#FF5500',  # Custom orange color
            tooltip='Custom colored action'
        )

    Control of the loading state:

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

        :class:`dash_prism.Prism`
            The main workspace component that holds the actions.

        :func:`dash_prism.init`
            Connects Prism to a Dash app and registers its callbacks.

    .. note::

        - Prism shows an action only if you pass it to the ``actions``
          parameter of :class:`dash_prism.Prism`.
        - Each action keeps its own ``n_clicks`` counter.
        - The ``loading`` state also disables the button.
        - Prism accepts a hex color in the form ``#RGB`` or ``#RRGGBB`` only.
          For any other color format, Prism uses the ``'default'`` style.
        - ``Prism(showStatusBar=False)`` hides the status bar, thus the actions
          do not appear. Prism gives a :class:`UserWarning` for that
          combination.
    """

    # The JavaScript bundle exports this component as "PrismAction". Dash finds
    # a React component by the type name, so the generated name
    # "PrismActionComponent" does not work here.
    _type = "PrismAction"

    def __init__(
        self,
        label: str = _component_base.UNSET,
        id: str | None = _component_base.UNSET,
        tooltip: str | None = _component_base.UNSET,
        variant: str | None = _component_base.UNSET,
        disabled: bool = _component_base.UNSET,
        loading: bool = _component_base.UNSET,
        n_clicks: int = _component_base.UNSET,
        **kwargs: Any,
    ):
        """Make an action button and send only the arguments that you give.

        The wrapper drops each argument that keeps the ``UNSET`` sentinel.
        Thus the React component applies its own default to that prop, and a
        prop that you set to ``None`` stays ``None``.

        :param kwargs: More props for the generated component. The wrapper adds
            them to the explicit arguments.
        :type kwargs: Any
        :raises TypeError: If you do not give ``label``.
        """
        super().__init__(**_component_base.explicit_props(locals()))


# Alias kept for code that imports the older name.
PrismAction = Action
