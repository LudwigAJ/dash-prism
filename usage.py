"""
Dash Prism Usage Example
========================

This example demonstrates the full Prism API with polished demo layouts.
All layouts and callbacks are defined in this single file.

Run with: python usage.py
Dependencies: pip install -r requirements-test.txt
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
from dash import MATCH, Input, Output, State, callback, ctx, dcc, html
from dash.exceptions import PreventUpdate

import dash_prism


# =============================================================================
# THEME UTILITIES
# =============================================================================


def get_theme_colors(theme: str = "light") -> dict[str, str]:
    """Get color palette for given theme.

    Args:
        theme: 'light' or 'dark'

    Returns:
        Dictionary with color values for bg, text, surface, border, accent, etc.
    """
    if theme == "dark":
        # Bloomberg Terminal / Claude CLI inspired dark theme
        return {
            "bg": "#0a0e14",  # Deep navy black
            "surface": "#131921",  # Slightly lighter surface
            "text": "#e6e6e6",  # Off-white text
            "text_secondary": "#8b949e",  # Muted text
            "border": "#2d333b",  # Subtle border
            "accent": "#ff9500",  # Bloomberg orange
            "accent_secondary": "#00d4aa",  # Teal green
            "success": "#3fb950",  # Green
            "error": "#f85149",  # Red
            "warning": "#d29922",  # Yellow/amber
            "header_bg": "#161b22",  # Header background
            "input_bg": "#0d1117",  # Input field background
            "chart_grid": "rgba(139, 148, 158, 0.15)",  # Subtle grid
        }
    else:
        # Clean, professional light theme
        return {
            "bg": "#ffffff",
            "surface": "#f6f8fa",
            "text": "#24292f",
            "text_secondary": "#57606a",
            "border": "#d0d7de",
            "accent": "#0969da",  # Blue accent
            "accent_secondary": "#1a7f64",  # Teal
            "success": "#1a7f37",
            "error": "#cf222e",
            "warning": "#9a6700",
            "header_bg": "#f6f8fa",
            "input_bg": "#ffffff",
            "chart_grid": "rgba(0, 0, 0, 0.1)",
        }


def get_plotly_template(theme: str = "light") -> str:
    """Get Plotly template name for given theme.

    Args:
        theme: 'light' or 'dark'

    Returns:
        Plotly template string
    """
    return "plotly_dark" if theme == "dark" else "plotly_white"


def get_plotly_layout(theme: str = "light") -> dict[str, Any]:
    """Get common Plotly layout settings for given theme.

    Args:
        theme: 'light' or 'dark'

    Returns:
        Dictionary with layout settings
    """
    colors = get_theme_colors(theme)
    return {
        "template": get_plotly_template(theme),
        "paper_bgcolor": colors["bg"],
        "plot_bgcolor": colors["bg"],
        "font": {"family": 'Monaco, "Courier New", monospace', "color": colors["text"]},
        "margin": {"t": 50, "r": 20, "b": 50, "l": 60},
        "xaxis": {"gridcolor": colors["chart_grid"], "zerolinecolor": colors["border"]},
        "yaxis": {"gridcolor": colors["chart_grid"], "zerolinecolor": colors["border"]},
    }


def full_panel_style(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return a base style dict that fills the Prism panel.

    Args:
        extra: Additional CSS properties to merge into the style.

    Returns:
        Style dictionary sized to fill the parent panel.
    """
    style: dict[str, Any] = {
        "height": "100%",
        "width": "100%",
        "minHeight": "100%",
        "minWidth": "100%",
    }
    if extra:
        style.update(extra)
    return style


# =============================================================================
# SETTINGS LAYOUT
# =============================================================================

DEFAULT_THEME = "dark"
DEFAULT_SIZE = "md"

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
    return html.Div(
        [
            html.Div(
                [
                    html.H1("[SETTINGS]", style={"margin": "0", "fontFamily": 'Monaco, "Courier New", monospace'}),
                    html.P(
                        "Configure your workspace",
                        style={"color": "var(--muted-foreground)", "margin": "5px 0 0 0"},
                    ),
                ],
                style={"padding": "20px", "borderBottom": "1px solid var(--border)"},
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
                                value=DEFAULT_THEME,
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
                            "backgroundColor": "var(--primary)",
                            "color": "var(--primary-foreground)",
                            "border": "none",
                            "borderRadius": "4px",
                            "cursor": "pointer",
                            "fontWeight": "bold",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                        },
                    ),
                    html.Span(
                        id=SETTINGS_STATUS_ID,
                        style={"marginLeft": "15px", "color": "var(--green)"},
                    ),
                ],
                style={"padding": "20px", "maxWidth": "400px"},
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": "var(--background)",
                "color": "var(--foreground)",
                "display": "flex",
                "flexDirection": "column",
                "overflow": "auto",
            }
        ),
    )


# =============================================================================
# CHAT LAYOUT
# =============================================================================

# Simple in-memory chat store
_chat_messages: list[dict[str, str]] = [
    {"username": "System", "text": "Welcome to the terminal chat.", "timestamp": datetime.now().isoformat()},
]


@dash_prism.register_layout(
    id="chat",
    name="Terminal Chat",
    description="Terminal-style chat room with Bloomberg/CLI aesthetics",
    keywords=["chat", "messaging", "communication", "terminal", "cli"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def chat_layout(username: str = "user", theme: str = "dark"):
    """Terminal-style chat room layout.

    Inspired by Claude CLI and Bloomberg IB Chat aesthetics.

    Args:
        username: Display name for the user
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)

    # Terminal prompt style
    prompt_color = colors["accent"] if theme == "dark" else colors["accent"]

    return html.Div(
        [
            # Header - terminal title bar style
            html.Div(
                [
                    html.Span(
                        "TERMINAL",
                        style={
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontWeight": "bold",
                            "fontSize": "12px",
                            "letterSpacing": "1px",
                            "color": colors["text_secondary"],
                        },
                    ),
                    html.Span(
                        f"@{username}",
                        style={
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontSize": "12px",
                            "color": prompt_color,
                        },
                    ),
                ],
                style={
                    "display": "flex",
                    "justifyContent": "space-between",
                    "alignItems": "center",
                    "padding": "8px 16px",
                    "backgroundColor": colors["header_bg"],
                    "borderBottom": f'1px solid {colors["border"]}',
                },
            ),
            dcc.Store(id="chat-username", data=username),
            dcc.Store(id="chat-theme", data=theme),
            # Messages container - terminal output style
            html.Div(
                id="chat-messages",
                children="[SYS] No messages yet. Start chatting.\n",
                style={
                    "flex": "1",
                    "minHeight": "0",
                    "overflow": "auto",
                    "padding": "16px",
                    "fontFamily": 'Monaco, "Courier New", monospace',
                    "fontSize": "13px",
                    "lineHeight": "1.8",
                    "backgroundColor": colors["bg"],
                    "color": colors["text"],
                    "whiteSpace": "pre-wrap",
                    "wordWrap": "break-word",
                },
            ),
            # Input area - command line style
            html.Div(
                [
                    html.Div(
                        [
                            html.Span(
                                "> ",
                                style={
                                    "color": prompt_color,
                                    "fontFamily": 'Monaco, "Courier New", monospace',
                                    "fontSize": "14px",
                                    "fontWeight": "bold",
                                    "marginRight": "4px",
                                },
                            ),
                            dcc.Input(
                                id="chat-input",
                                type="text",
                                placeholder="Enter message...",
                                style={
                                    "flex": "1",
                                    "padding": "8px",
                                    "fontFamily": 'Monaco, "Courier New", monospace',
                                    "fontSize": "13px",
                                    "backgroundColor": colors["input_bg"],
                                    "color": colors["text"],
                                    "border": f'1px solid {colors["border"]}',
                                    "borderRadius": "2px",
                                    "outline": "none",
                                },
                                debounce=False,
                            ),
                        ],
                        style={"display": "flex", "alignItems": "center", "flex": "1"},
                    ),
                    html.Button(
                        "SEND",
                        id="chat-send-btn",
                        n_clicks=0,
                        style={
                            "marginLeft": "8px",
                            "padding": "8px 16px",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "backgroundColor": colors["accent"],
                            "color": "#ffffff" if theme == "dark" else "#ffffff",
                            "border": "none",
                            "borderRadius": "2px",
                            "cursor": "pointer",
                            "fontSize": "12px",
                            "fontWeight": "bold",
                            "letterSpacing": "1px",
                        },
                    ),
                ],
                style={
                    "display": "flex",
                    "padding": "12px 16px",
                    "backgroundColor": colors["surface"],
                    "borderTop": f'1px solid {colors["border"]}',
                },
            ),
            dcc.Interval(id="chat-interval", interval=2000, n_intervals=0),
        ],
        style=full_panel_style(
            {
                "display": "flex",
                "flexDirection": "column",
                "backgroundColor": colors["bg"],
            }
        ),
    )


# =============================================================================
# ASSET LAYOUT
# =============================================================================

# Random asset name generator
_ASSET_PREFIXES = ["ALPHA", "BETA", "GAMMA", "DELTA", "OMEGA", "SIGMA", "THETA", "ZETA"]
_ASSET_SUFFIXES = ["X", "Q", "Z", "V", "K", "J", "W", "Y"]


def _generate_asset_name() -> str:
    """Generate a random asset ticker symbol."""
    return f"{random.choice(_ASSET_PREFIXES)}-{random.choice(_ASSET_SUFFIXES)}"


@dash_prism.register_layout(
    id="asset",
    name="Asset Price",
    description="Real-time asset price chart with GBM simulation",
    keywords=["asset", "price", "stock", "crypto", "trading", "finance", "chart"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def asset_layout(theme: str = "light"):
    """Real-time asset price dashboard with random asset name.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    asset_name = _generate_asset_name()
    base_price = random.uniform(50, 500)
    volatility = random.uniform(0.01, 0.03)

    return html.Div(
        [
            # Minimal header
            html.Div(
                [
                    html.Span(
                        asset_name,
                        style={
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontWeight": "bold",
                            "fontSize": "14px",
                            "color": colors["text"],
                        },
                    ),
                    html.Span(
                        "LIVE",
                        style={
                            "padding": "2px 8px",
                            "backgroundColor": colors["error"],
                            "color": "#ffffff",
                            "borderRadius": "2px",
                            "fontSize": "10px",
                            "fontFamily": 'Monaco, "Courier New", monospace',
                            "fontWeight": "bold",
                            "letterSpacing": "1px",
                        },
                    ),
                ],
                style={
                    "display": "flex",
                    "justifyContent": "space-between",
                    "alignItems": "center",
                    "padding": "12px 16px",
                    "backgroundColor": colors["header_bg"],
                    "borderBottom": f'1px solid {colors["border"]}',
                },
            ),
            # Store data
            dcc.Store(id="asset-name", data=asset_name),
            dcc.Store(id="asset-theme", data=theme),
            dcc.Store(id="asset-model", data="GBM"),
            dcc.Store(
                id="asset-data",
                data={
                    "timestamps": [],
                    "prices": [],
                    "base_price": base_price,
                    "volatility": volatility,
                    "current_price": base_price,
                },
            ),
            # Chart - fills remaining space
            html.Div(
                [
                    dcc.Graph(
                        id="asset-chart",
                        config={"displayModeBar": False},
                        style={"height": "100%", "width": "100%"},
                    ),
                ],
                style={
                    "flex": "1",
                    "minHeight": "0",
                    "padding": "8px",
                    "overflow": "hidden",
                    "backgroundColor": colors["bg"],
                },
            ),
            dcc.Interval(id="asset-interval", interval=1000, n_intervals=0),
        ],
        style=full_panel_style(
            {
                "display": "flex",
                "flexDirection": "column",
                "backgroundColor": colors["bg"],
            }
        ),
    )


# =============================================================================
# IRIS LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="iris",
    name="Iris Dataset",
    description="Classic machine learning dataset visualization",
    keywords=["iris", "dataset", "machine learning", "flowers", "classification"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def iris_layout(theme: str = "light"):
    """Iris dataset dashboard with theme support.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
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

    section_style = {
        "backgroundColor": colors["surface"],
        "border": f'1px solid {colors["border"]}',
        "borderRadius": "8px",
        "padding": "12px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px",
    }
    chart_container_style = {
        "flex": "1",
        "minHeight": "220px",
    }

    return html.Div(
        [
            html.Div(
                [
                    html.P(
                        "150 samples across three species. Use these panels to compare relationships and"
                        " distributions between measurements.",
                        style={"margin": "0", "color": colors["text_secondary"], "fontSize": "12px"},
                    ),
                ],
                style=section_style,
            ),
            html.Div(
                [
                    html.Div(
                        [
                            html.Span(
                                "Feature relationships",
                                style={"fontSize": "12px", "fontWeight": "bold"},
                            ),
                            html.P(
                                "Sepal width vs. sepal length with petal length encoding size.",
                                style={
                                    "margin": "0",
                                    "color": colors["text_secondary"],
                                    "fontSize": "11px",
                                },
                            ),
                            html.Div(
                                [
                                    dcc.Graph(
                                        figure=scatter_fig,
                                        style={"height": "100%", "width": "100%"},
                                        config={"displayModeBar": False},
                                    )
                                ],
                                style=chart_container_style,
                            ),
                        ],
                        style=section_style,
                    ),
                    html.Div(
                        [
                            html.Span(
                                "Petal length distribution",
                                style={"fontSize": "12px", "fontWeight": "bold"},
                            ),
                            html.P(
                                "Box plots by species highlight median and spread.",
                                style={
                                    "margin": "0",
                                    "color": colors["text_secondary"],
                                    "fontSize": "11px",
                                },
                            ),
                            html.Div(
                                [
                                    dcc.Graph(
                                        figure=box_fig,
                                        style={"height": "100%", "width": "100%"},
                                        config={"displayModeBar": False},
                                    )
                                ],
                                style=chart_container_style,
                            ),
                        ],
                        style=section_style,
                    ),
                ],
                style={
                    "display": "grid",
                    "gridTemplateColumns": "repeat(auto-fit, minmax(260px, 1fr))",
                    "gap": "16px",
                },
            ),
            html.Div(
                [
                    html.Span(
                        "Petal width histogram",
                        style={"fontSize": "12px", "fontWeight": "bold"},
                    ),
                    html.P(
                        "Overlayed histograms show how petal widths separate species.",
                        style={
                            "margin": "0",
                            "color": colors["text_secondary"],
                            "fontSize": "11px",
                        },
                    ),
                    html.Div(
                        [
                            dcc.Graph(
                                figure=hist_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            )
                        ],
                        style={"flex": "1", "minHeight": "220px"},
                    ),
                ],
                style=section_style,
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
                "gap": "16px",
                "padding": "16px",
                "overflow": "auto",
            }
        ),
    )


# =============================================================================
# OPTIONS LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="options",
    name="Options Payoff",
    description="Option payoff diagram visualization",
    keywords=["options", "derivatives", "finance", "trading", "payoff"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def options_layout(theme: str = "light"):
    """Options payoff diagram with random parameters.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}

    # Random option parameters
    option_type = random.choice(["call", "put"])
    strike = round(random.uniform(80, 120), 2)

    # Price range around strike
    spot_prices = np.linspace(strike * 0.5, strike * 1.5, 100)

    # Calculate payoff
    if option_type == "call":
        payoffs = np.maximum(spot_prices - strike, 0)
        line_color = colors["success"]
    else:
        payoffs = np.maximum(strike - spot_prices, 0)
        line_color = colors["error"]

    # Create figure
    fig = go.Figure()

    # Payoff line
    fig.add_trace(
        go.Scatter(
            x=spot_prices,
            y=payoffs,
            mode="lines",
            name="Payoff",
            line={"color": line_color, "width": 2},
            fill="tozeroy",
            fillcolor=f"rgba{(*[int(line_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)], 0.15)}",
        )
    )

    # Strike price vertical line
    fig.add_vline(x=strike, line_dash="dash", line_color=colors["text_secondary"], line_width=1)

    fig.update_layout(**layout_settings)
    fig.update_layout(
        xaxis_title="Spot Price ($)",
        yaxis_title="Payoff ($)",
        showlegend=False,
        hovermode="x unified",
        title=None,
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
# SCATTER PLOT LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="scatter",
    name="Scatter Plot",
    description="Random scatter plot with regression line",
    keywords=["scatter", "regression", "trend", "plot", "statistics"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def scatter_layout(theme: str = "light"):
    """Random scatter plot with a regression line.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}

    n_points = random.randint(60, 140)
    slope = random.uniform(0.4, 2.5) * random.choice([-1, 1])
    intercept = random.uniform(-20, 20)
    noise_scale = random.uniform(6, 18)

    x = np.linspace(0, 100, n_points)
    y = slope * x + intercept + np.random.normal(0, noise_scale, size=n_points)

    # Regression line
    reg = np.polyfit(x, y, 1)
    y_hat = reg[0] * x + reg[1]

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=x,
            y=y,
            mode="markers",
            name="Samples",
            marker={"color": colors["accent"], "size": 6, "opacity": 0.8},
        )
    )
    fig.add_trace(
        go.Scatter(
            x=x,
            y=y_hat,
            mode="lines",
            name="Regression",
            line={"color": colors["accent_secondary"], "width": 2},
        )
    )

    fig.update_layout(**layout_settings)
    fig.update_layout(
        showlegend=False,
        title=None,
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


# =============================================================================
# IFRAME LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="iframe",
    name="Embed URL",
    description="Render a URL inside an iframe",
    keywords=["iframe", "embed", "url", "web"],
    allow_multiple=True,
)
def iframe_layout(url: str = "https://example.com"):
    """Embed a URL in an iframe.

    Args:
        url: URL to embed in the iframe
    """
    if not url:
        return html.Div(
            [
                html.P("No URL provided.", style={"margin": 0}),
            ],
            style=full_panel_style(
                {
                    "display": "flex",
                    "alignItems": "center",
                    "justifyContent": "center",
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
        style=full_panel_style({"backgroundColor": "#ffffff"}),
    )


# =============================================================================
# COUNTRY LAYOUT
# =============================================================================

_SAMPLE_COUNTRIES = [
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
]


@dash_prism.register_layout(
    id="country",
    name="Country Explorer",
    description="Explore economic data for a random country",
    keywords=["country", "gapminder", "gdp", "population", "world", "economy"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def country_layout(theme: str = "light"):
    """Country explorer dashboard with random country selection.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}
    df = px.data.gapminder()

    # Random country selection
    country = random.choice(_SAMPLE_COUNTRIES)
    year = 2007

    # Find country data
    country_df = df[df["country"] == country]

    life_fig = px.line(country_df, x="year", y="lifeExp", title="Life Expectancy (years)", markers=True)
    life_fig.add_vline(x=year, line_dash="dash", line_color=colors["accent"], line_width=1)
    life_fig.update_layout(**layout_settings)
    life_fig.update_layout(title=None, showlegend=False)

    gdp_fig = px.line(country_df, x="year", y="gdpPercap", title="GDP per Capita ($)", markers=True)
    gdp_fig.add_vline(x=year, line_dash="dash", line_color=colors["accent"], line_width=1)
    gdp_fig.update_layout(**layout_settings)
    gdp_fig.update_layout(title=None, showlegend=False)

    pop_fig = px.area(country_df, x="year", y="pop", title="Population")
    pop_fig.add_vline(x=year, line_dash="dash", line_color=colors["accent"], line_width=1)
    pop_fig.update_layout(**layout_settings)
    pop_fig.update_layout(title=None, showlegend=False)

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
                },
            ),
            html.Div(
                [
                    html.Div(
                        [
                            dcc.Graph(
                                figure=life_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            )
                        ],
                        style={"flex": "1", "minHeight": "0"},
                    ),
                    html.Div(
                        [
                            dcc.Graph(
                                figure=gdp_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            )
                        ],
                        style={"flex": "1", "minHeight": "0"},
                    ),
                ],
                style={
                    "display": "flex",
                    "gap": "16px",
                    "padding": "16px",
                    "flex": "1",
                    "minHeight": "0",
                },
            ),
            html.Div(
                [
                    dcc.Graph(
                        figure=pop_fig,
                        style={"height": "100%", "width": "100%"},
                        config={"displayModeBar": False},
                    ),
                ],
                style={"padding": "0 16px 16px 16px", "flex": "1", "minHeight": "0"},
            ),
        ],
        style=full_panel_style(
            {
                "backgroundColor": colors["bg"],
                "color": colors["text"],
                "display": "flex",
                "flexDirection": "column",
            }
        ),
    )


# =============================================================================
# CONTINENT LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="continent",
    name="Continent Comparison",
    description="Compare data across continents",
    keywords=["continent", "comparison", "gapminder", "world", "global"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def continent_layout(theme: str = "light"):
    """Continent comparison dashboard.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}
    df = px.data.gapminder()
    latest_year = df["year"].max()
    latest_df = df[df["year"] == latest_year]

    # Random continent pair selection
    all_continents = df["continent"].unique().tolist()
    selected = random.sample(all_continents, min(2, len(all_continents)))

    filtered_df = df[df["continent"].isin(selected)]
    filtered_latest = latest_df[latest_df["continent"].isin(selected)]

    bubble_fig = px.scatter(
        filtered_latest,
        x="gdpPercap",
        y="lifeExp",
        size="pop",
        color="continent",
        hover_name="country",
        log_x=True,
        size_max=50,
    )
    bubble_fig.update_layout(**layout_settings)
    bubble_fig.update_layout(title=None)

    agg = filtered_df.groupby(["continent", "year"]).agg({"lifeExp": "mean", "gdpPercap": "mean"}).reset_index()
    line_fig = px.line(agg, x="year", y="lifeExp", color="continent", markers=True)
    line_fig.update_layout(**layout_settings)
    line_fig.update_layout(title=None)

    gdp_fig = px.line(agg, x="year", y="gdpPercap", color="continent", markers=True)
    gdp_fig.update_layout(**layout_settings)
    gdp_fig.update_layout(title=None)

    return html.Div(
        [
            html.Div(
                [
                    html.H2(
                        " vs ".join(selected).upper(),
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
                            dcc.Graph(
                                figure=line_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            )
                        ],
                        style={"flex": "1", "minHeight": "0"},
                    ),
                    html.Div(
                        [
                            dcc.Graph(
                                figure=gdp_fig,
                                style={"height": "100%", "width": "100%"},
                                config={"displayModeBar": False},
                            )
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
            }
        ),
    )


# =============================================================================
# WORLD MAP LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="world",
    name="World Map",
    description="Global choropleth map visualization",
    keywords=["world", "map", "globe", "choropleth", "global", "countries"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def world_layout(theme: str = "light"):
    """World map choropleth visualization.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    df = px.data.gapminder()
    latest_year = df["year"].max()
    latest_df = df[df["year"] == latest_year]

    # Random metric selection
    metric = random.choice(["gdpPercap", "lifeExp", "pop"])
    metric_labels = {
        "gdpPercap": "GDP per Capita",
        "lifeExp": "Life Expectancy",
        "pop": "Population",
    }

    fig = px.choropleth(
        latest_df,
        locations="iso_alpha",
        color=metric,
        hover_name="country",
        color_continuous_scale="Viridis" if theme == "light" else "Plasma",
    )

    fig.update_layout(
        template=get_plotly_template(theme),
        paper_bgcolor=colors["bg"],
        geo=dict(
            bgcolor=colors["bg"],
            showframe=False,
            showcoastlines=True,
            coastlinecolor=colors["border"],
            landcolor=colors["surface"],
            countrycolor=colors["border"],
        ),
        font={"family": 'Monaco, "Courier New", monospace', "color": colors["text"]},
        margin={"t": 24, "r": 10, "b": 10, "l": 10},
        coloraxis_colorbar=dict(
            title=metric_labels[metric],
            tickfont=dict(size=10),
        ),
        title=None,
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
                "display": "flex",
                "flexDirection": "column",
            }
        ),
    )


# =============================================================================
# CANDLESTICK CHART LAYOUT
# =============================================================================


def _generate_ohlc_data(n_periods: int = 100) -> dict[str, list]:
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
    id="market",
    name="Market Chart",
    description="Candlestick OHLC chart visualization",
    keywords=["market", "candlestick", "ohlc", "trading", "finance", "stocks"],
    allow_multiple=True,
    param_options={
        "light": ("Light Theme", {"theme": "light"}),
        "dark": ("Dark Theme", {"theme": "dark"}),
    },
)
def market_layout(theme: str = "light"):
    """Candlestick market chart visualization.

    Args:
        theme: 'light' or 'dark' theme
    """
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
    layout_settings["margin"] = {"t": 24, "r": 20, "b": 40, "l": 50}

    # Generate random ticker and data
    ticker = _generate_asset_name()
    data = _generate_ohlc_data(60)

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
        xaxis_title="Date",
        yaxis_title="Price ($)",
        xaxis_rangeslider_visible=False,
        showlegend=False,
        title=None,
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
# DELAYED LAYOUT
# =============================================================================


@dash_prism.register_layout(
    id="delayed",
    name="Delayed Layout",
    description="A layout that takes time to load (simulates heavy computation)",
    keywords=["delay", "loading", "slow", "test"],
    allow_multiple=True,
    param_options={
        "quick": ("Quick (1 second)", {"delay": "1"}),
        "medium": ("Medium (3 seconds)", {"delay": "3"}),
        "slow": ("Slow (5 seconds)", {"delay": "5"}),
    },
)
def delayed_layout(delay: str = "3"):
    """Layout that simulates heavy computation.

    Args:
        delay: Delay in seconds as string
    """
    colors = get_theme_colors("light")

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
                                "The layout has finished loading after the specified delay.",
                                style={"fontFamily": 'Monaco, "Courier New", monospace', "fontSize": "12px"},
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


# =============================================================================
# CREATE APP
# =============================================================================

app = dash.Dash(__name__, suppress_callback_exceptions=True)

app.layout = html.Div([
    dash_prism.Prism(
        id='prism',
        style={'height': '100vh', 'width': '100%'},
        theme=DEFAULT_THEME,
        size=DEFAULT_SIZE,
        actions=[
            dash_prism.Action(id='save', label='Save', icon='Save', tooltip='Save workspace'),
            dash_prism.Action(id='load', label='Load', icon='FolderOpen', tooltip='Load workspace'),
            dash_prism.Action(id='clear', label='Clear', icon='Trash2', tooltip='Clear all tabs'),
        ],
        searchBarPlaceholder='Search layouts...',
        statusBarPosition='bottom',
        persistence=True,
        persistence_type='memory',
        maxTabs=8,
    ),
    dcc.Store(id='saved-workspace', storage_type='memory'),
])


# =============================================================================
# CALLBACKS - Settings
# =============================================================================

@callback(
    Output('prism', 'theme'),
    Output('prism', 'size'),
    Output(SETTINGS_STATUS_ID, 'children'),
    Input(SETTINGS_APPLY_ID, 'n_clicks'),
    State(SETTINGS_THEME_ID, 'value'),
    State(SETTINGS_SIZE_ID, 'value'),
    prevent_initial_call=True,
)
def apply_settings(n_clicks, theme, size):
    """Apply theme and size settings."""
    if not n_clicks:
        raise PreventUpdate
    return theme, size, '✓ Applied!'


# =============================================================================
# CALLBACKS - Chat
# =============================================================================

@callback(
    Output({'type': 'chat-messages', 'index': MATCH}, 'children'),
    Output({'type': 'chat-input', 'index': MATCH}, 'value'),
    Input({'type': 'chat-send-btn', 'index': MATCH}, 'n_clicks'),
    Input({'type': 'chat-interval', 'index': MATCH}, 'n_intervals'),
    State({'type': 'chat-input', 'index': MATCH}, 'value'),
    State({'type': 'chat-username', 'index': MATCH}, 'data'),
    prevent_initial_call=True,
)
def update_chat(n_clicks, n_intervals, message_text, username):
    """Handle chat messages."""
    global _chat_messages
    triggered_id = ctx.triggered_id

    if triggered_id and isinstance(triggered_id, dict) and triggered_id.get('type') == 'chat-send-btn':
        if message_text and message_text.strip():
            _chat_messages.append({
                'username': username,
                'text': message_text.strip(),
                'timestamp': datetime.now().isoformat(),
            })
            # Keep last 100 messages
            if len(_chat_messages) > 100:
                _chat_messages = _chat_messages[-100:]

    # Format messages
    if not _chat_messages:
        formatted = '*** No messages yet. Start chatting! ***\n'
    else:
        lines = []
        for msg in _chat_messages:
            ts = msg['timestamp'][:19].replace('T', ' ')
            user = msg['username']
            text = msg['text']
            if user.lower() == 'system':
                lines.append(f'*** {text} ***\n')
            elif user.lower() == username.lower():
                lines.append(f'[{ts}] {user} (you): {text}\n')
            else:
                lines.append(f'[{ts}] <{user}> {text}\n')
        formatted = ''.join(lines)

    clear_input = '' if triggered_id and isinstance(triggered_id, dict) and triggered_id.get('type') == 'chat-send-btn' else (message_text or '')
    return formatted, clear_input


# =============================================================================
# CALLBACKS - Asset
# =============================================================================

@callback(
    Output({'type': 'asset-data', 'index': MATCH}, 'data'),
    Output({'type': 'asset-chart', 'index': MATCH}, 'figure'),
    Input({'type': 'asset-interval', 'index': MATCH}, 'n_intervals'),
    State({'type': 'asset-data', 'index': MATCH}, 'data'),
    State({'type': 'asset-model', 'index': MATCH}, 'data'),
    State({'type': 'asset-theme', 'index': MATCH}, 'data'),
    prevent_initial_call=True,
)
def update_asset_price(n, data, model_type, theme):
    """Update asset price using GBM or RM model."""
    if n is None or not data:
        raise PreventUpdate

    import numpy as np
    from datetime import datetime

    # Extract data
    timestamps = data.get('timestamps', [])
    prices = data.get('prices', [])
    current_price = data.get('current_price', data['base_price'])
    base_price = data['base_price']
    volatility = data['volatility']

    # Generate new price based on model
    dt = 1/252  # Daily time step
    if model_type == 'GBM':
        # Geometric Brownian Motion: dS = mu*S*dt + sigma*S*sqrt(dt)*Z
        mu = 0.0  # Drift
        Z = np.random.normal(0, 1)
        new_price = current_price * (1 + mu * dt + volatility * np.sqrt(dt) * Z)
    else:  # RM (Mean Reversion)
        # Mean reversion: dS = theta*(mean - S)*dt + sigma*S*sqrt(dt)*Z
        theta = 0.1  # Speed of reversion
        Z = np.random.normal(0, 1)
        new_price = current_price + theta * (base_price - current_price) * dt + volatility * current_price * np.sqrt(dt) * Z

    # Ensure price doesn't go negative or too low
    new_price = max(new_price, base_price * 0.3)

    # Update data
    timestamps.append(datetime.now().strftime('%H:%M:%S'))
    prices.append(new_price)

    # Keep last 200 points
    if len(prices) > 200:
        timestamps = timestamps[-200:]
        prices = prices[-200:]

    theme = theme or 'light'
    colors = get_theme_colors(theme)
    layout_settings = get_plotly_layout(theme)
    layout_settings['margin'] = {'t': 24, 'r': 20, 'b': 40, 'l': 50}
    layout_settings['showlegend'] = False

    # Create figure (line only)
    fig = {
        'data': [{
            'x': timestamps,
            'y': prices,
            'type': 'scatter',
            'mode': 'lines',
            'line': {'color': colors['accent'], 'width': 2},
        }],
        'layout': {
            **layout_settings,
            'xaxis': {
                **layout_settings.get('xaxis', {}),
                'title': 'Time',
            },
            'yaxis': {
                **layout_settings.get('yaxis', {}),
                'title': 'Price (USD)',
            },
        },
    }

    return {
        'timestamps': timestamps,
        'prices': prices,
        'base_price': base_price,
        'volatility': volatility,
        'current_price': new_price,
    }, fig


# =============================================================================
# CALLBACKS - Workspace Actions
# =============================================================================

@callback(
    Output('prism-action-save', 'n_clicks'),
    Input('prism-action-save', 'n_clicks'),
    prevent_initial_call=True,
)
def handle_save(n_clicks: int) -> int:
    """Handle save action."""
    if n_clicks:
        print("Workspace saved.")
    return n_clicks

@callback(
    Output('prism-action-load', 'n_clicks'),
    Input('prism-action-load', 'n_clicks'),
    prevent_initial_call=True,
)
def handle_load(n_clicks: int) -> int:
    """Handle load action."""
    if n_clicks:
        print("Workspace loaded.")
    return n_clicks


@callback(
    Output('prism-action-clear', 'n_clicks'),
    Input('prism-action-clear', 'n_clicks'),
    prevent_initial_call=True,
)
def handle_clear(n_clicks: int) -> int:
    """Handle clear action."""
    if n_clicks:
        print("Workspace cleared.")
    return n_clicks


# =============================================================================
# INITIALIZE
# =============================================================================

dash_prism.init('prism', app)


if __name__ == '__main__':
    print("Dash Prism Demo")
    print("Open http://127.0.0.1:5005 in your browser")
    app.run(debug=False, port=5005, dev_tools_ui=False, dev_tools_props_check=False, dev_tools_serve_dev_bundles=False)

