"""
Dash Prism Usage Example
========================

This example demonstrates various functionalities of Prism including:
- Delayed callbacks with spinners
- allow_multiple = True/False
- Non-param, param, and param_options layouts
"""

from __future__ import annotations

import random
import time
from datetime import datetime
from typing import Any

import dash
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from dash import MATCH, Input, Output, State, callback, dcc, html, clientside_callback
from dash.exceptions import PreventUpdate

import dash_prism

# =============================================================================
# CONFIGURATION
# =============================================================================

THEME = "light"  # Change to "dark" for dark mode
DEFAULT_SIZE = "md"

# =============================================================================
# THEME UTILITIES
# =============================================================================


def get_theme_colors() -> dict[str, str]:
    """Get color palette for the current theme."""

    if THEME == "dark":
        return {
            "bg": "#0a0e14",
            "surface": "#131921",
            "text": "#e6e6e6",
            "text_secondary": "#8b949e",
            "border": "#2d333b",
            "accent": "#ff9500",
            "accent_secondary": "#00d4aa",
            "success": "#3fb950",
            "error": "#f85149",
            "warning": "#d29922",
            "header_bg": "#161b22",
            "input_bg": "#0d1117",
            "chart_grid": "rgba(139, 148, 158, 0.15)",
        }
    else:
        return {
            "bg": "#ffffff",
            "surface": "#f6f8fa",
            "text": "#24292f",
            "text_secondary": "#57606a",
            "border": "#d0d7de",
            "accent": "#0969da",
            "accent_secondary": "#1a7f64",
            "success": "#1a7f37",
            "error": "#cf222e",
            "warning": "#9a6700",
            "header_bg": "#f6f8fa",
            "input_bg": "#ffffff",
            "chart_grid": "rgba(0, 0, 0, 0.1)",
        }


def get_plotly_template() -> str:
    """Get Plotly template name for the current theme."""

    return "plotly_dark" if THEME == "dark" else "plotly_white"


def get_plotly_layout() -> dict[str, Any]:
    """Get common Plotly layout settings for the current theme."""

    colors = get_theme_colors()
    return {
        "template": get_plotly_template(),
        "paper_bgcolor": colors["bg"],
        "plot_bgcolor": colors["bg"],
        "font": {"family": 'Monaco, "Courier New", monospace', "color": colors["text"]},
        "margin": {"t": 50, "r": 20, "b": 50, "l": 60},
        "xaxis": {"gridcolor": colors["chart_grid"], "zerolinecolor": colors["border"]},
        "yaxis": {"gridcolor": colors["chart_grid"], "zerolinecolor": colors["border"]},
    }


def full_panel_style(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return a base style dict that fills the Prism panel."""

    style: dict[str, Any] = {
        "height": "100%",
        "width": "100%",
        "minHeight": "100%",
        "minWidth": "100%",
    }
    if extra:
        style.update(extra)
    return style


# ================================================================================
# SETTINGS LAYOUT
# ================================================================================

SETTINGS_SCOPE = "settings"
SETTINGS_THEME_ID = {"type": "settings-theme", "index": SETTINGS_SCOPE}
SETTINGS_SIZE_ID = {"type": "settings-size", "index": SETTINGS_SCOPE}
SETTINGS_APPLY_ID = {"type": "settings-apply-btn", "index": SETTINGS_SCOPE}
SETTINGS_STATUS_ID = {"type": "settings-status", "index": SETTINGS_SCOPE}


@dash_prism.register_layout(
    id="settings",
    name="Settings",
    description="Configure Prism theme and interface settings",
    keywords=["settings", "config", "configuration", "theme", "preferences"],
    allow_multiple=False,
)
def settings_layout():
    """Settings page to configure theme and size."""

    colors = get_theme_colors()

    return html.Div(
        [
            html.Div(
                [
                    html.H1(
                        "[SETTINGS]",
                        style={"margin": "0", "fontFamily": 'Monaco, "Courier New", monospace'},
                    ),
                    html.P(
                        "Configure your workspace",
                        style={"color": colors["text_secondary"], "margin": "5px 0 0 0"},
                    ),
                ],
                style={
                    "padding": "20px",
                    "borderBottom": f'1px solid {colors["border"]}',
                    "backgroundColor": colors["header_bg"],
                },
            ),
            html.Div(
                [
                    # Theme
                    html.Div(
                        [
                            html.Label(
                                "Theme",
                                style={
                                    "fontWeight": "bold",
                                    "display": "block",
                                    "marginBottom": "8px",
                                    "fontFamily": 'Monaco, "Courier New", monospace',
                                },
                            ),
                            dcc.Dropdown(
                                id=SETTINGS_THEME_ID,
                                options=[
                                    {"label": "Light", "value": "light"},
                                    {"label": "Dark", "value": "dark"},
                                ],
                                value=THEME,
                                clearable=False,
                                style={"width": "200px"},
                            ),
                        ],
                        style={"marginBottom": "20px"},
                    ),
                    # Size
                    html.Div(
                        [
                            html.Label(
                                "Interface Size",
                                style={
                                    "fontWeight": "bold",
                                    "display": "block",
                                    "marginBottom": "8px",
                                    "fontFamily": 'Monaco, "Courier New", monospace',
                                },
                            ),
                            dcc.Dropdown(
                                id=SETTINGS_SIZE_ID,
                                options=[
                                    {"label": "Small", "value": "sm"},
                                    {"label": "Medium", "value": "md"},
                                    {"label": "Large", "value": "lg"},
                                ],
                                value=DEFAULT_SIZE,
                                clearable=False,
                                style={"width": "200px"},
                            ),
                        ],
                        style={"marginBottom": "20px"},
                    ),
                    # Apply button
                    html.Button(
                        "Apply Settings",
                        id=SETTINGS_APPLY_ID,
                        n_clicks=0,
                        style={
                            "padding": "12px 24px",
                            "backgroundColor": colors["accent"],
                            "color": "#ffffff",
                            "border": "none",
                            "borderRadius": "4px",
                            "cursor": "pointer",
                            "fontWeight": "bold",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                        },
                    ),
                    html.Span(
                        id=SETTINGS_STATUS_ID,
                        style={"marginLeft": "15px", "color": colors["success"]},
                    ),
                ],
                style={"padding": "20px", "maxWidth": "400px"},
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
                "overflow": "auto",
            }
        ),
    )


# ================================================================================
# IRIS DATASET LAYOUT
# ================================================================================


@dash_prism.register_layout(
    id="iris",
    name="Iris Dataset",
    description="Classic machine learning dataset visualization",
    keywords=["iris", "dataset", "machine learning", "flowers", "classification"],
    allow_multiple=False,
)
def iris_layout():
    """Iris dataset dashboard."""
    colors = get_theme_colors()
    layout_settings = get_plotly_layout()
    compact_layout = {
        **layout_settings,
        "margin": {"t": 32, "r": 20, "b": 40, "l": 50},
    }
    df = px.data.iris()

    scatter_fig = px.scatter(
        df,
        x="sepal_width",
        y="sepal_length",
        color="species",
        size="petal_length",
        hover_data=["petal_width"],
    )
    scatter_fig.update_layout(**compact_layout)
    scatter_fig.update_layout(
        title=None,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )

    box_fig = px.box(df, x="species", y="petal_length", color="species")
    box_fig.update_layout(**compact_layout)
    box_fig.update_layout(title=None, showlegend=False)

    hist_fig = px.histogram(
        df,
        x="petal_width",
        color="species",
        nbins=20,
        barmode="overlay",
        opacity=0.7,
    )
    hist_fig.update_layout(**compact_layout)
    hist_fig.update_layout(title=None, showlegend=False)

    return html.Div(
        [
            html.Div(
                [
                    dcc.Graph(
                        figure=scatter_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    )
                ],
                style={"flex": "1", "minHeight": "0"},
            ),
            html.Div(
                [
                    dcc.Graph(
                        figure=box_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    )
                ],
                style={"flex": "1", "minHeight": "0"},
            ),
            html.Div(
                [
                    dcc.Graph(
                        figure=hist_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    )
                ],
                style={"flex": "1", "minHeight": "0"},
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
                "gap": "8px",
                "padding": "8px",
            }
        ),
    )


# ================================================================================
# DELAYED LAYOUT
# ================================================================================


@dash_prism.register_layout(
    id="delayed",
    name="Delayed Layout",
    description="A layout that takes time to load (simulates heavy computation)",
    keywords=["delay", "loading", "slow", "test", "spinner"],
    allow_multiple=False,
)
def delayed_layout(delay: str = "3"):
    """Layout that simulates heavy computation.

    Args:
        delay: Delay in seconds as string
    """
    colors = get_theme_colors()

    try:
        delay_seconds = min(int(delay), 30)
    except (ValueError, TypeError):
        delay_seconds = 3

    time.sleep(delay_seconds)

    return html.Div(
        [
            html.Div(
                [
                    html.H1(
                        "[DELAYED LAYOUT]",
                        style={
                            "margin": "0 0 10px 0",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontSize": "18px",
                        },
                    ),
                    html.P(
                        f"This layout took {delay_seconds} seconds to load.",
                        style={"color": colors["text_secondary"]},
                    ),
                ],
                style={"textAlign": "center", "padding": "40px"},
            ),
            html.Div(
                [
                    html.Div(
                        [
                            html.H3(
                                "[OK] Successfully Loaded",
                                style={
                                    "color": colors["success"],
                                    "fontFamily": 'Monaco, "Courier New", monospace',
                                    "fontSize": "14px",
                                },
                            ),
                            html.P(
                                f"The layout finished loading after {delay_seconds}s delay.",
                                style={
                                    "fontFamily": 'Monaco, "Courier New", monospace',
                                    "fontSize": "12px",
                                },
                            ),
                        ],
                        style={
                            "backgroundColor": colors["surface"],
                            "padding": "20px",
                            "borderRadius": "4px",
                            "border": f'1px solid {colors["success"]}',
                        },
                    ),
                ],
                style={"maxWidth": "500px", "margin": "0 auto", "padding": "20px"},
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
                "justifyContent": "center",
            }
        ),
    )


# ================================================================================
# COUNTRY EXPLORER LAYOUT
# ================================================================================

COUNTRIES = [
    "United States",
    "China",
    "Germany",
    "Japan",
    "Brazil",
    "India",
    "United Kingdom",
    "France",
    "Canada",
    "Australia",
    "Italy",
    "Spain",
    "Mexico",
    "South Korea",
    "Russia",
]


@dash_prism.register_layout(
    id="country",
    name="Country Explorer",
    description="Explore economic data for a specific country",
    keywords=["country", "gapminder", "gdp", "population", "world", "economy"],
    allow_multiple=True,
)
def country_layout(country: str = "United States"):
    """Country explorer dashboard.

    Args:
        country: Name of the country to explore
    """
    colors = get_theme_colors()
    layout_settings = get_plotly_layout()
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}
    df = px.data.gapminder()

    # Find country data
    country_df = df[df["country"] == country]

    if country_df.empty:
        return html.Div(
            [
                html.H2(f"Country not found: {country}", style={"color": colors["error"]}),
                html.P(f"Available countries include: {', '.join(COUNTRIES[:5])}..."),
            ],
            style=full_panel_style(
                {
                    "backgroundColor": colors["bg"],
                    "color": colors["text"],
                    "padding": "20px",
                }
            ),
        )

    year = 2007

    life_fig = px.line(country_df, x="year", y="lifeExp", markers=True, title="Life Expectancy")
    life_fig.add_vline(x=year, line_dash="dash", line_color=colors["accent"], line_width=1)
    life_fig.update_layout(**layout_settings)
    life_fig.update_layout(showlegend=False)

    gdp_fig = px.line(country_df, x="year", y="gdpPercap", markers=True, title="GDP per Capita")
    gdp_fig.add_vline(x=year, line_dash="dash", line_color=colors["accent"], line_width=1)
    gdp_fig.update_layout(**layout_settings)
    gdp_fig.update_layout(showlegend=False)

    pop_fig = px.area(country_df, x="year", y="pop", title="Population")
    pop_fig.add_vline(x=year, line_dash="dash", line_color=colors["accent"], line_width=1)
    pop_fig.update_layout(**layout_settings)
    pop_fig.update_layout(showlegend=False)

    return html.Div(
        [
            html.Div(
                [
                    html.H2(
                        country.upper(),
                        style={
                            "margin": "0",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontSize": "16px",
                            "letterSpacing": "1px",
                        },
                    ),
                    html.Span(
                        f"Reference: {year}",
                        style={
                            "color": colors["text_secondary"],
                            "fontSize": "12px",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                        },
                    ),
                ],
                style={
                    "display": "flex",
                    "justifyContent": "space-between",
                    "alignItems": "center",
                    "padding": "12px 20px",
                    "borderBottom": f'1px solid {colors["border"]}',
                    "backgroundColor": colors["header_bg"],
                    "flexShrink": "0",
                },
            ),
            html.Div(
                [
                    dcc.Graph(
                        figure=life_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    ),
                ],
                style={"flex": "1", "minHeight": "0"},
            ),
            html.Div(
                [
                    dcc.Graph(
                        figure=gdp_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    ),
                ],
                style={"flex": "1", "minHeight": "0"},
            ),
            html.Div(
                [
                    dcc.Graph(
                        figure=pop_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    ),
                ],
                style={"flex": "1", "minHeight": "0"},
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
                "gap": "8px",
                "padding": "0 8px 8px 8px",
            }
        ),
    )


# ================================================================================
# CONTINENT COMPARISON LAYOUT
# ================================================================================


@dash_prism.register_layout(
    id="continent",
    name="Continent Comparison",
    description="Compare economic data across a continent",
    keywords=["continent", "comparison", "gapminder", "world", "global"],
    allow_multiple=False,
    param_options={
        "africa": ("Africa", {"continent": "Africa"}),
        "americas": ("Americas", {"continent": "Americas"}),
        "asia": ("Asia", {"continent": "Asia"}),
        "europe": ("Europe", {"continent": "Europe"}),
        "oceania": ("Oceania", {"continent": "Oceania"}),
    },
)
def continent_layout(continent: str = "Europe"):
    """Continent comparison dashboard.

    Args:
        continent: Name of the continent to display
    """
    colors = get_theme_colors()
    layout_settings = get_plotly_layout()
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}
    df = px.data.gapminder()
    latest_year = df["year"].max()
    latest_df = df[df["year"] == latest_year]

    filtered_df = df[df["continent"] == continent]
    filtered_latest = latest_df[latest_df["continent"] == continent]

    if filtered_df.empty:
        return html.Div(
            [html.H2(f"Continent not found: {continent}", style={"color": colors["error"]})],
            style=full_panel_style(
                {"backgroundColor": colors["bg"], "color": colors["text"], "padding": "20px"}
            ),
        )

    bubble_fig = px.scatter(
        filtered_latest,
        x="gdpPercap",
        y="lifeExp",
        size="pop",
        color="country",
        hover_name="country",
        log_x=True,
        size_max=50,
    )
    bubble_fig.update_layout(**layout_settings)
    bubble_fig.update_layout(title=None, showlegend=False)

    agg = (
        filtered_df.groupby(["country", "year"])
        .agg({"lifeExp": "mean", "gdpPercap": "mean"})
        .reset_index()
    )
    line_fig = px.line(agg, x="year", y="lifeExp", color="country", markers=False)
    line_fig.update_layout(**layout_settings)
    line_fig.update_layout(title=None, showlegend=False)

    gdp_fig = px.line(agg, x="year", y="gdpPercap", color="country", markers=False)
    gdp_fig.update_layout(**layout_settings)
    gdp_fig.update_layout(title=None, showlegend=False)

    return html.Div(
        [
            html.Div(
                [
                    html.H2(
                        continent.upper(),
                        style={
                            "margin": "0",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontSize": "16px",
                            "letterSpacing": "1px",
                        },
                    ),
                    html.Span(
                        "Continent Comparison",
                        style={
                            "color": colors["text_secondary"],
                            "fontSize": "12px",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                        },
                    ),
                ],
                style={
                    "display": "flex",
                    "justifyContent": "space-between",
                    "alignItems": "center",
                    "padding": "12px 20px",
                    "borderBottom": f'1px solid {colors["border"]}',
                    "backgroundColor": colors["header_bg"],
                },
            ),
            html.Div(
                [
                    html.Span(
                        f"GDP vs Life Expectancy ({latest_year})", style={"fontSize": "11px"}
                    ),
                    dcc.Graph(
                        figure=bubble_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    ),
                ],
                style={"padding": "16px", "flex": "1", "minHeight": "0"},
            ),
            html.Div(
                [
                    html.Div(
                        [
                            html.Span("Life Expectancy Over Time", style={"fontSize": "11px"}),
                            dcc.Graph(
                                figure=line_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            ),
                        ],
                        style={"flex": "1", "minHeight": "0"},
                    ),
                    html.Div(
                        [
                            html.Span("GDP per Capita Over Time", style={"fontSize": "11px"}),
                            dcc.Graph(
                                figure=gdp_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            ),
                        ],
                        style={"flex": "1", "minHeight": "0"},
                    ),
                ],
                style={
                    "display": "flex",
                    "gap": "16px",
                    "padding": "0 16px 16px 16px",
                    "flex": "1",
                    "minHeight": "0",
                },
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
                "gap": "8px",
            }
        ),
    )


# ================================================================================
# EMBED URL LAYOUT
# ================================================================================


@dash_prism.register_layout(
    id="embed",
    name="Embed URL",
    description="Embed a website in an iframe",
    keywords=["iframe", "embed", "url", "web", "website"],
    allow_multiple=True,
)
def embed_layout(url: str = "https://example.com"):
    """Embed a URL in an iframe.

    Args:
        url: URL to embed in the iframe
    """
    colors = get_theme_colors()

    if not url:
        return html.Div(
            [
                html.P("No URL provided.", style={"margin": 0, "color": colors["error"]}),
            ],
            style=full_panel_style(
                {
                    "display": "flex",
                    "alignItems": "center",
                    "justifyContent": "center",
                    "backgroundColor": colors["bg"],
                    "color": colors["text"],
                }
            ),
        )

    return html.Div(
        [
            html.Iframe(
                src=url,
                style={"height": "100%", "width": "100%", "border": "none"},
                title="Embedded URL",
            )
        ],
        style=full_panel_style({"backgroundColor": colors["bg"]}),
    )


# ================================================================================
# LIVE PLOT LAYOUT
# ================================================================================


@dash_prism.register_layout(
    id="live",
    name="Live Plot",
    description="Real-time random walk chart that updates every 5 seconds",
    keywords=["live", "real-time", "chart", "random", "walk", "streaming"],
    allow_multiple=True,
)
def live_layout(title: str = "Random Walk"):
    """Live updating random walk chart.

    Args:
        title: Title for the plot
    """
    colors = get_theme_colors()

    return html.Div(
        [
            dcc.Store(id="live-title", data=title),
            dcc.Store(
                id="live-data",
                data={
                    "timestamps": [],
                    "values": [],
                    "current_value": 0.0,
                },
            ),
            dcc.Graph(
                id="live-chart",
                config={"displayModeBar": False},
                style={"height": "100%", "width": "100%"},
            ),
            dcc.Interval(id="live-interval", interval=5000, n_intervals=0),
        ],
        style=full_panel_style({"backgroundColor": colors["bg"]}),
    )


# ================================================================================
# SCATTER PLOT LAYOUT
# ================================================================================

SCATTER_TITLES = [
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
def scatter_layout():
    """Random scatter plot with regression line using Cholesky decomposition."""
    colors = get_theme_colors()
    layout_settings = get_plotly_layout()
    layout_settings["margin"] = {"t": 40, "r": 20, "b": 40, "l": 50}

    # Generate correlated data using Cholesky decomposition
    n_points = random.randint(60, 140)
    correlation = random.uniform(0.5, 0.95) * random.choice([-1, 1])

    # Correlation matrix
    corr_matrix = np.array([[1.0, correlation], [correlation, 1.0]])

    # Cholesky decomposition
    L = np.linalg.cholesky(corr_matrix)

    # Generate uncorrelated standard normal samples
    uncorrelated = np.random.randn(2, n_points)

    # Transform to correlated samples
    correlated = L @ uncorrelated

    # Scale and shift to reasonable ranges
    x = correlated[0] * 15 + 50
    y = correlated[1] * 20 + 100

    # Regression line
    reg = np.polyfit(x, y, 1)
    x_line = np.array([x.min(), x.max()])
    y_line = reg[0] * x_line + reg[1]

    title = random.choice(SCATTER_TITLES)

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=x,
            y=y,
            mode="markers",
            name="Samples",
            marker={"color": colors["accent"], "size": 6, "opacity": 0.7},
        )
    )
    fig.add_trace(
        go.Scatter(
            x=x_line,
            y=y_line,
            mode="lines",
            name="Regression",
            line={"color": colors["accent_secondary"], "width": 2},
        )
    )

    fig.update_layout(**layout_settings)
    fig.update_layout(
        title={"text": title, "font": {"size": 14}},
        showlegend=False,
    )

    return html.Div(
        [
            html.Div(
                [
                    dcc.Graph(
                        figure=fig,
                        config={"displayModeBar": False},
                        style={"height": "100%", "width": "100%"},
                    )
                ],
                style={"flex": "1", "minHeight": "0"},
            )
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "padding": "8px",
                "display": "flex",
                "flexDirection": "column",
            }
        ),
    )


# ================================================================================
# OHLC CHART LAYOUT
# ================================================================================

OHLC_TITLES = [
    "ALPHA-X",
    "BETA-Q",
    "GAMMA-Z",
    "DELTA-V",
    "OMEGA-K",
    "SIGMA-J",
    "THETA-W",
    "ZETA-Y",
    "KAPPA-M",
    "LAMBDA-N",
]


def generate_ohlc_data(n_periods: int = 100) -> dict[str, list]:
    """Generate random OHLC candlestick data."""
    dates = []
    opens = []
    highs = []
    lows = []
    closes = []

    base_price = random.uniform(100, 200)
    current_price = base_price

    base_date = datetime(2024, 1, 1)

    for i in range(n_periods):
        dates.append(base_date + __import__("datetime").timedelta(days=i))

        open_price = current_price
        change = random.gauss(0, 0.02) * current_price
        close_price = open_price + change

        high_price = max(open_price, close_price) * (1 + abs(random.gauss(0, 0.01)))
        low_price = min(open_price, close_price) * (1 - abs(random.gauss(0, 0.01)))

        opens.append(round(open_price, 2))
        highs.append(round(high_price, 2))
        lows.append(round(low_price, 2))
        closes.append(round(close_price, 2))

        current_price = close_price

    return {"dates": dates, "opens": opens, "highs": highs, "lows": lows, "closes": closes}


@dash_prism.register_layout(
    id="ohlc",
    name="OHLC Chart",
    description="Candlestick Open-High-Low-Close chart with random data",
    keywords=["ohlc", "candlestick", "trading", "finance", "stocks", "market"],
    allow_multiple=True,
)
def ohlc_layout():
    """Candlestick OHLC chart with random data and title."""
    colors = get_theme_colors()
    layout_settings = get_plotly_layout()
    layout_settings["margin"] = {"t": 40, "r": 20, "b": 40, "l": 50}

    ticker = random.choice(OHLC_TITLES)
    data = generate_ohlc_data(60)

    fig = go.Figure(
        data=[
            go.Candlestick(
                x=data["dates"],
                open=data["opens"],
                high=data["highs"],
                low=data["lows"],
                close=data["closes"],
                increasing_line_color=colors["success"],
                decreasing_line_color=colors["error"],
                increasing_fillcolor=colors["success"],
                decreasing_fillcolor=colors["error"],
            )
        ]
    )

    fig.update_layout(**layout_settings)
    fig.update_layout(
        title={"text": ticker, "font": {"size": 14}},
        xaxis_title="Date",
        yaxis_title="Price ($)",
        xaxis_rangeslider_visible=False,
        showlegend=False,
    )

    return html.Div(
        [
            html.Div(
                [
                    dcc.Graph(
                        figure=fig,
                        config={"displayModeBar": False},
                        style={"height": "100%", "width": "100%"},
                    ),
                ],
                style={"flex": "1", "minHeight": "0"},
            )
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "padding": "8px",
                "display": "flex",
                "flexDirection": "column",
            }
        ),
    )


# =============================================================================
# CREATE APP
# =============================================================================

app = dash.Dash(__name__, suppress_callback_exceptions=True)

app.layout = html.Div(
    [
        dash_prism.Prism(
            id="prism",
            style={"height": "100vh", "width": "100%"},
            theme=THEME,
            size=DEFAULT_SIZE,
            actions=[
                dash_prism.Action(id="save", label="Save", tooltip="Save workspace"),
                dash_prism.Action(id="load", label="Load", tooltip="Load workspace"),
                dash_prism.Action(id="clear", label="Clear", tooltip="Clear all tabs"),
            ],
            searchBarPlaceholder="Search layouts...",
            statusBarPosition="bottom",
            persistence=True,
            persistence_type="memory",
            newTabOpensDropdown=False,
            maxTabs=16,
        ),
        dcc.Store(id="saved-workspace", storage_type="memory"),
    ]
)


# =============================================================================
# CALLBACKS - Settings
# =============================================================================


@callback(
    Output("prism", "theme"),
    Output("prism", "size"),
    Output(SETTINGS_STATUS_ID, "children"),
    Input(SETTINGS_APPLY_ID, "n_clicks"),
    State(SETTINGS_THEME_ID, "value"),
    State(SETTINGS_SIZE_ID, "value"),
    prevent_initial_call=True,
)
def apply_settings(n_clicks, theme, size):
    """Apply theme and size settings."""
    if not n_clicks:
        raise PreventUpdate
    return theme, size, "Applied!"


# =============================================================================
# CALLBACKS - Live Plot
# =============================================================================


@callback(
    Output({"type": "live-data", "index": MATCH}, "data"),
    Output({"type": "live-chart", "index": MATCH}, "figure"),
    Input({"type": "live-interval", "index": MATCH}, "n_intervals"),
    State({"type": "live-data", "index": MATCH}, "data"),
    State({"type": "live-title", "index": MATCH}, "data"),
    prevent_initial_call=False,
)
def update_live_chart(n, data, title):
    """Update live chart with random walk data."""
    if n is None or not data:
        raise PreventUpdate

    timestamps = data.get("timestamps", [])
    values = data.get("values", [])
    current_value = data.get("current_value", 0.0)

    # Random walk step
    step = np.random.normal(0, 1)
    new_value = current_value + step

    timestamps.append(datetime.now().strftime("%H:%M:%S"))
    values.append(new_value)

    # Keep last 100 points
    if len(values) > 100:
        timestamps = timestamps[-100:]
        values = values[-100:]

    colors = get_theme_colors()
    layout_settings = get_plotly_layout()
    layout_settings["margin"] = {"t": 40, "r": 20, "b": 40, "l": 50}
    layout_settings["showlegend"] = False

    fig = {
        "data": [
            {
                "x": timestamps,
                "y": values,
                "type": "scatter",
                "mode": "lines",
                "line": {"color": colors["accent"], "width": 2},
            }
        ],
        "layout": {
            **layout_settings,
            "title": {"text": title, "font": {"size": 14}},
            "xaxis": {
                **layout_settings.get("xaxis", {}),
                "title": "Time",
            },
            "yaxis": {
                **layout_settings.get("yaxis", {}),
                "title": "Value",
            },
        },
    }

    return {
        "timestamps": timestamps,
        "values": values,
        "current_value": new_value,
    }, fig


# =============================================================================
# CALLBACKS - Workspace Actions
# =============================================================================


clientside_callback(
    """
    function(n_clicks) {
        if (n_clicks > 0) {
            window.alert('Save action clicked! (n_clicks: ' + n_clicks + ')');
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output("save", "loading"),
    Input("save", "n_clicks"),
    prevent_initial_call=True,
)

clientside_callback(
    """
    function(n_clicks) {
        if (n_clicks > 0) {
            window.alert('Load action clicked! (n_clicks: ' + n_clicks + ')');
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output("load", "loading"),
    Input("load", "n_clicks"),
    prevent_initial_call=True,
)

clientside_callback(
    """
    function(n_clicks) {
        if (n_clicks > 0) {
            window.alert('Clear action clicked! (n_clicks: ' + n_clicks + ')');
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output("clear", "loading"),
    Input("clear", "n_clicks"),
    prevent_initial_call=True,
)


# =============================================================================
# INITIALIZE
# =============================================================================

dash_prism.init("prism", app)


if __name__ == "__main__":
    HOST = "127.0.0.1"
    PORT = 5050

    print("Running Dash Prism `usage.py` Demo")
    print(f"Open http://{HOST}:{PORT} in your browser")
    app.run(
        debug=False,
        host=HOST,
        port=PORT,
        dev_tools_ui=False,
        dev_tools_props_check=False,
        dev_tools_serve_dev_bundles=False,
    )
