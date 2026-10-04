"""The Iris layout, a callback layout without parameters that opens in one tab only."""

from __future__ import annotations

import plotly.express as px
from dash import html

import dash_prism
from examples import theme


@dash_prism.register_layout(
    id="iris",
    name="Iris Dataset",
    description="Classic machine learning dataset visualization",
    keywords=["iris", "dataset", "machine learning", "flowers", "classification"],
    allow_multiple=False,
)
def iris_layout() -> html.Div:
    """Return three views of the Iris dataset."""
    df = px.data.iris()

    scatter_fig = px.scatter(
        df,
        x="sepal_width",
        y="sepal_length",
        color="species",
        size="petal_length",
        hover_data=["petal_width"],
    )
    scatter_fig.update_layout(
        legend={"orientation": "h", "yanchor": "bottom", "y": 1.02, "xanchor": "right", "x": 1}
    )

    box_fig = px.box(df, x="species", y="petal_length", color="species")
    box_fig.update_layout(showlegend=False)

    hist_fig = px.histogram(
        df, x="petal_width", color="species", nbins=20, barmode="overlay", opacity=0.7
    )
    hist_fig.update_layout(showlegend=False)

    return html.Div(
        [theme.graph_panel(scatter_fig), theme.graph_panel(box_fig), theme.graph_panel(hist_fig)],
        className="demo-page",
    )
