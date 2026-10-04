"""The live layout, a chart that a pattern-matching callback updates every 5 seconds.

Prism changes the string IDs of the layout, for example ``"live-chart"``, into
``{"type": "live-chart", "index": <tab id>}``. The callbacks below use ``MATCH`` on the
index, so each open tab updates only its own chart.
"""

from __future__ import annotations

import datetime
import random
from typing import Any

import plotly.graph_objects as go
from dash import MATCH, Input, Output, State, callback, dcc, html

import dash_prism
from examples import theme

_MAX_POINTS = 100


@dash_prism.register_layout(
    id="live",
    name="Live Plot",
    description="Real-time random walk chart that updates every 5 seconds",
    keywords=["live", "real-time", "chart", "random", "walk", "streaming"],
    allow_multiple=True,
)
def live_layout(title: str = "Random Walk") -> html.Div:
    """Return an empty chart, and the interval and the stores that its callbacks use.

    :param title: The title of the chart.
    """
    return html.Div(
        [
            dcc.Store(id="live-title", data=title),
            dcc.Store(id="live-data", data={"timestamps": [], "values": []}),
            html.Div(
                dcc.Graph(
                    id="live-chart", config={"displayModeBar": False}, className="demo-graph"
                ),
                className="demo-graph-panel",
            ),
            dcc.Interval(id="live-interval", interval=5000),
        ],
        className="demo-page",
    )


@callback(
    Output({"type": "live-data", "index": MATCH}, "data"),
    Input({"type": "live-interval", "index": MATCH}, "n_intervals"),
    State({"type": "live-data", "index": MATCH}, "data"),
)
def add_live_point(n_intervals: int, data: dict[str, list[Any]]) -> dict[str, list[Any]]:
    """Add one random walk step to the data of one chart.

    :param n_intervals: The tick count of the interval.
    :param data: The timestamps and the values of the chart.
    :returns: The data with one more point, and at most the last 100 points.
    """
    del n_intervals  # Unused.
    values = data["values"]
    last_value = values[-1] if values else 0.0
    timestamps = [*data["timestamps"], datetime.datetime.now().strftime("%H:%M:%S")]
    values = [*values, last_value + random.gauss(0, 1)]
    return {"timestamps": timestamps[-_MAX_POINTS:], "values": values[-_MAX_POINTS:]}


@callback(
    Output({"type": "live-chart", "index": MATCH}, "figure"),
    Input({"type": "live-data", "index": MATCH}, "data"),
    Input(theme.PRISM_ID, "theme"),
    State({"type": "live-title", "index": MATCH}, "data"),
)
def draw_live_chart(data: dict[str, list[Any]], prism_theme: str, title: str) -> go.Figure:
    """Draw the chart of one tab from its data and the Prism theme.

    The theme is an input, so the chart follows a change of theme at once and does not wait
    for the next step.

    :param data: The timestamps and the values of the chart.
    :param prism_theme: The ``theme`` prop of Prism.
    :param title: The title of the chart.
    :returns: The figure.
    """
    fig = go.Figure(
        go.Scatter(
            x=data["timestamps"],
            y=data["values"],
            mode="lines",
            line={"color": theme.ACCENT, "width": 2},
        )
    )
    theme.style_figure(fig)
    fig.update_layout(
        template=theme.plotly_template(prism_theme),
        title={"text": title, "font": {"size": 14}},
        xaxis_title="Time",
        yaxis_title="Value",
    )
    return fig
