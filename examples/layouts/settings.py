"""The settings layout, a form that sets the ``theme`` and ``size`` props of Prism."""

from __future__ import annotations

from dash import Input, Output, State, callback, dcc, html
from dash.exceptions import PreventUpdate

import dash_prism
from examples import theme

# Prism changes each string ID in a tab into {"type": <id>, "index": <tab id>}, and it does
# not change a dict ID. These dict IDs have a fixed index, so the callback below can name
# them without MATCH. A fixed index is safe here because allow_multiple=False permits one
# settings tab only.
_SETTINGS_INDEX = "settings"
_THEME_INPUT_ID = {"type": "settings-theme", "index": _SETTINGS_INDEX}
_SIZE_INPUT_ID = {"type": "settings-size", "index": _SETTINGS_INDEX}
_APPLY_BUTTON_ID = {"type": "settings-apply", "index": _SETTINGS_INDEX}
_STATUS_ID = {"type": "settings-status", "index": _SETTINGS_INDEX}


@dash_prism.register_layout(
    id="settings",
    name="Settings",
    description="Configure Prism theme and interface settings",
    keywords=["settings", "config", "configuration", "theme", "preferences"],
    allow_multiple=False,
)
def settings_layout() -> html.Div:
    """Return the settings form."""
    return html.Div(
        [
            theme.page_header("[SETTINGS]", "Configure your workspace"),
            html.Div(
                [
                    html.Fieldset(
                        [
                            html.Legend("Theme"),
                            dcc.RadioItems(
                                {"light": "Light", "dark": "Dark"},
                                theme.DEFAULT_THEME,
                                id=_THEME_INPUT_ID,
                                inline=True,
                            ),
                        ]
                    ),
                    html.Fieldset(
                        [
                            html.Legend("Interface Size"),
                            dcc.RadioItems(
                                {"sm": "Small", "md": "Medium", "lg": "Large"},
                                theme.DEFAULT_SIZE,
                                id=_SIZE_INPUT_ID,
                                inline=True,
                            ),
                        ]
                    ),
                    html.Div(
                        [
                            html.Button(
                                "Apply Settings", id=_APPLY_BUTTON_ID, className="demo-button"
                            ),
                            html.Span(id=_STATUS_ID, className="demo-success"),
                        ],
                        className="demo-form-actions",
                    ),
                ],
                className="demo-form",
            ),
        ],
        className="demo-page",
    )


@callback(
    Output(theme.PRISM_ID, "theme"),
    Output(theme.PRISM_ID, "size"),
    Output(_STATUS_ID, "children"),
    Input(_APPLY_BUTTON_ID, "n_clicks"),
    State(_THEME_INPUT_ID, "value"),
    State(_SIZE_INPUT_ID, "value"),
    prevent_initial_call=True,
)
def apply_settings(n_clicks: int | None, selected_theme: str, size: str) -> tuple[str, str, str]:
    """Write the selected theme and size to the Prism component.

    :param n_clicks: The click count of the apply button, or ``None`` before the first click.
    :param selected_theme: The selected theme, ``"light"`` or ``"dark"``.
    :param size: The selected size, ``"sm"``, ``"md"`` or ``"lg"``.
    :returns: The theme and the size for Prism, and the status text.
    :raises PreventUpdate: If the user did not click the button.
    """
    # Dash runs the callback when the tab inserts the button, because the outputs on Prism
    # exist before the button. prevent_initial_call does not stop this call.
    if n_clicks is None:
        raise PreventUpdate
    return selected_theme, size, "Applied!"
