"""The scatter layout, a static random chart that opens in many tabs."""

from __future__ import annotations

import random

import numpy as np
import plotly.graph_objects as go
from dash import html

import dash_prism
from examples import theme

_TITLES = [
    "Variable Analysis",
    "Correlation Study",
    "Feature Relationship",
    "Data Distribution",
    "Trend Analysis",
    "Sample Comparison",
    "Measurement Scatter",
    "Statistical Plot",
]


@dash_prism.register_layout(
    id="scatter",
    name="Scatter Plot",
    description="Scatter plot with regression line using correlated random data",
    keywords=["scatter", "regression", "trend", "plot", "statistics", "correlation"],
    allow_multiple=True,
)
def scatter_layout() -> html.Div:
    """Return correlated random samples with their regression line."""
    rng = np.random.default_rng()
    n_points = random.randint(60, 140)
    correlation = random.uniform(0.5, 0.95) * random.choice([-1, 1])

    # The Cholesky factor of a correlation matrix maps independent standard normal samples
    # to samples with that correlation.
    cholesky_factor = np.linalg.cholesky([[1.0, correlation], [correlation, 1.0]])
    correlated = cholesky_factor @ rng.standard_normal((2, n_points))
    x = correlated[0] * 15 + 50
    y = correlated[1] * 20 + 100

    slope, intercept = np.polyfit(x, y, 1)
    x_line = np.array([x.min(), x.max()])

    fig = go.Figure(
        [
            go.Scatter(
                x=x,
                y=y,
                mode="markers",
                name="Samples",
                marker={"color": theme.ACCENT, "size": 6, "opacity": 0.7},
            ),
            go.Scatter(
                x=x_line,
                y=slope * x_line + intercept,
                mode="lines",
                name="Regression",
                line={"color": theme.ACCENT_SECONDARY, "width": 2},
            ),
        ]
    )
    fig.update_layout(
        title={"text": random.choice(_TITLES), "font": {"size": 14}}, showlegend=False
    )
    return html.Div(theme.graph_panel(fig), className="demo-page")
