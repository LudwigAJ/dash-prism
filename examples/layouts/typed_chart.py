"""The typed chart layout, which declares all its parameters in one pydantic model."""

from __future__ import annotations

from typing import Literal

import numpy as np
import plotly.graph_objects as go
from dash import html
from pydantic import BaseModel, Field

import dash_prism
from examples import theme


class TypedChartParams(BaseModel):
    """All parameters of the typed chart. Pydantic validates them before the layout runs."""

    chart_type: Literal["bar", "line"] = "bar"
    n: int = Field(20, ge=1, le=100, description="Number of points to plot")
    seed: int = Field(0, ge=0, description="Random seed")


@dash_prism.register_layout(
    id="typed-chart",
    name="Typed Chart",
    description="Parameters declared as a pydantic model (body-model style)",
    keywords=["typed", "pydantic", "chart", "params"],
    allow_multiple=True,
)
def typed_chart_layout(params: TypedChartParams) -> html.Div:
    """Return a random walk as a bar chart or a line chart.

    :param params: The parameters after pydantic validated them.
    """
    rng = np.random.default_rng(params.seed)
    xs = list(range(params.n))
    ys = rng.standard_normal(params.n).cumsum().tolist()
    if params.chart_type == "bar":
        trace = go.Bar(x=xs, y=ys, marker_color=theme.ACCENT)
    else:
        trace = go.Scatter(x=xs, y=ys, mode="lines", line_color=theme.ACCENT)
    return html.Div(
        [
            theme.page_header(
                f"{params.chart_type.upper()} CHART", f"{params.n} points, seed {params.seed}"
            ),
            theme.graph_panel(go.Figure(trace)),
        ],
        className="demo-page",
    )
