"""The shared look of the demo layouts, and the link from the Prism theme to the figures.

The colours of the page come from ``assets/demo.css``. That sheet reads the ``dark`` class
that Prism adds to its root element, so the chrome of each layout follows the ``theme``
prop without a callback. A Plotly figure has its own colours and cannot read CSS. Thus
:func:`graph_panel` gives each graph a pattern-matching ID, and
:func:`apply_figure_theme` sets the Plotly template of each such graph from the ``theme``
prop.
"""

from __future__ import annotations

import uuid
from typing import Any, Final

import plotly.graph_objects as go
import plotly.io as pio
from dash import MATCH, Input, Output, Patch, callback, dcc, html

# The app, the settings layout and the figure callbacks name the Prism component with this ID.
PRISM_ID: Final = "prism"
DEFAULT_THEME: Final = "light"
DEFAULT_SIZE: Final = "md"

# These colours are easy to see on the light and on the dark background.
# ACCENT must match --demo-accent in assets/demo.css.
ACCENT: Final = "#3b82f6"
ACCENT_SECONDARY: Final = "#14b8a6"
POSITIVE: Final = "#22c55e"
NEGATIVE: Final = "#ef4444"

_MONO_FONT: Final = 'Monaco, "Courier New", monospace'
_PLOTLY_TEMPLATES: Final = {"light": "plotly_white", "dark": "plotly_dark"}
_THEMED_GRAPH_TYPE: Final = "themed-graph"


def plotly_template(theme: str) -> go.layout.Template:
    """Return the Plotly template for a Prism theme.

    :param theme: The ``theme`` prop of Prism, ``"light"`` or ``"dark"``.
    :returns: The built-in Plotly template for that theme.
    """
    return pio.templates[_PLOTLY_TEMPLATES[theme]]


def style_figure(figure: go.Figure) -> None:
    """Give a figure the font, margins and transparent background of the demo.

    The background is transparent, so the page colour from the stylesheet shows through.
    The template sets the colours of the text and of the grid.

    :param figure: The figure to change in place.
    """
    figure.update_layout(
        paper_bgcolor="rgba(0, 0, 0, 0)",
        plot_bgcolor="rgba(0, 0, 0, 0)",
        font_family=_MONO_FONT,
        margin={"t": 40, "r": 20, "b": 40, "l": 50},
    )


def graph_panel(figure: go.Figure, caption: str | None = None) -> html.Div:
    """Return a panel with one figure that fills its part of the page and follows the theme.

    :param figure: The figure to show. The function changes its style in place.
    :param caption: A line of text above the figure, or ``None`` for no text.
    :returns: The panel. Put it in a ``demo-page`` or ``demo-row`` element.
    """
    style_figure(figure)
    # Prism does not change a dict ID, so the random index keeps the graphs of two tabs apart.
    graph = dcc.Graph(
        id={"type": _THEMED_GRAPH_TYPE, "index": uuid.uuid4().hex},
        figure=figure,
        config={"displayModeBar": False},
        className="demo-graph",
    )
    children: list[Any] = [graph] if caption is None else [html.Span(caption), graph]
    return html.Div(children, className="demo-graph-panel")


def page_header(title: str, subtitle: str) -> html.Header:
    """Return the header bar at the top of a layout.

    :param title: The large text at the left.
    :param subtitle: The small text at the right.
    :returns: The header.
    """
    return html.Header([html.H2(title), html.Span(subtitle)], className="demo-header")


@callback(
    Output({"type": _THEMED_GRAPH_TYPE, "index": MATCH}, "figure"),
    Input(PRISM_ID, "theme"),
)
def apply_figure_theme(theme: str) -> Patch:
    """Set the Plotly template of one graph from :func:`graph_panel` to the Prism theme.

    Dash calls the callback once for each new graph, and again for each graph when the
    ``theme`` prop changes.

    :param theme: The ``theme`` prop of Prism.
    :returns: A patch that replaces only the template of the figure.
    """
    patch = Patch()
    patch["layout"]["template"] = plotly_template(theme)
    return patch
