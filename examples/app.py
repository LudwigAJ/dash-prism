"""A Dash app that shows the features of Prism with ten registered layouts.

Run the app from the root of the repository with ``python -m examples.app``, then open
http://127.0.0.1:5050. Each layout is in its own module in ``examples/layouts``:

- ``settings``: a form that sets the ``theme`` and ``size`` props of Prism from a callback.
  It also shows the dict IDs that Prism does not change.
- ``iris``: a callback layout without parameters that opens in one tab only.
- ``typed_chart``: parameters in a pydantic model (a body model).
- ``delayed``: an ``Annotated[int, Param(...)]`` parameter with bounds, and a slow layout that
  shows the loading spinner of a tab.
- ``country``: an ``Annotated[str, Param(...)]`` parameter, in many tabs at the same time.
- ``continent``: parameter presets with ``param_options``.
- ``embed``: a plain parameter with a default, the URL of an iframe.
- ``live``: ``MATCH`` callbacks on the IDs that Prism gives to each tab.
- ``scatter`` and ``ohlc``: random figures that open in many tabs.

The app also shows three status bar actions and their callback, share links, persistence in
local storage, and figures that follow the ``theme`` prop (see ``examples/theme.py``).
"""

from __future__ import annotations

# Plotly imports pandas at its first use. In the threaded development server, a second
# request can then get a pandas module that is not complete. This import loads pandas
# before the first request.
import pandas  # noqa: F401
from dash import Dash, Input, clientside_callback, html

import dash_prism
from examples import (
    layouts,  # noqa: F401 - The import registers the layouts.
    theme,
)

_HOST = "127.0.0.1"
_PORT = 5050

# A WSGI server imports the app from this module, for example with
# "gunicorn examples.app:server", so the app is at module level.
app = Dash(__name__, suppress_callback_exceptions=True)
server = app.server

app.layout = html.Div(
    dash_prism.Prism(
        id=theme.PRISM_ID,
        style={"height": "100vh", "width": "100%"},
        theme=theme.DEFAULT_THEME,
        size=theme.DEFAULT_SIZE,
        actions=[
            dash_prism.Action(id="save", label="Save", tooltip="Save workspace"),
            dash_prism.Action(id="load", label="Load", tooltip="Load workspace"),
            dash_prism.Action(id="clear", label="Clear", tooltip="Clear all tabs"),
        ],
        searchBarPlaceholder="Search layouts...",
        showStatusBar=True,
        statusBarPosition="bottom",
        statusBarItems=["reset", "help", "undo", "mode", "panels", "tab", "count", "updated"],
        persistence=True,
        persistence_type="local",
        newTabOpensDropdown=False,
        emptyTabView="layouts",
        enableKeyboardShortcuts=True,
        enableShareLinks=True,
        maxTabs=16,
        maxPanels=20,
    )
)

# One callback serves all the actions. It only shows which action the user clicked. The
# callback has no output, so Dash does not change a prop of an action.
clientside_callback(
    """
    function() {
        const actionId = window.dash_clientside.callback_context.triggered_id;
        window.alert('Action "' + actionId + '" clicked!');
    }
    """,
    Input("save", "n_clicks"),
    Input("load", "n_clicks"),
    Input("clear", "n_clicks"),
    prevent_initial_call=True,
)

dash_prism.init(theme.PRISM_ID, app)


def main() -> None:
    """Run the development server."""
    print(f"Open http://{_HOST}:{_PORT} in a browser.")
    app.run(
        debug=False,
        host=_HOST,
        port=_PORT,
        dev_tools_ui=False,
        dev_tools_props_check=False,
        dev_tools_serve_dev_bundles=False,
    )


if __name__ == "__main__":
    main()
