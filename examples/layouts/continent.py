"""The continent layout, which offers its parameter values as presets (``param_options``)."""

from __future__ import annotations

import plotly.express as px
from dash import html

import dash_prism
from examples import theme


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
def continent_layout(continent: str = "Europe") -> html.Div:
    """Return a comparison of the countries of one continent.

    :param continent: The name of the continent, as the Gapminder dataset spells it.
    """
    df = px.data.gapminder()
    continent_df = df[df["continent"] == continent]
    if continent_df.empty:
        return html.Div(
            html.H2(f"Continent not found: {continent}", className="demo-error"),
            className="demo-page",
        )

    latest_year = continent_df["year"].max()
    bubble_fig = px.scatter(
        continent_df[continent_df["year"] == latest_year],
        x="gdpPercap",
        y="lifeExp",
        size="pop",
        color="country",
        hover_name="country",
        log_x=True,
        size_max=50,
    )
    life_fig = px.line(continent_df, x="year", y="lifeExp", color="country")
    gdp_fig = px.line(continent_df, x="year", y="gdpPercap", color="country")
    for fig in (bubble_fig, life_fig, gdp_fig):
        fig.update_layout(showlegend=False)

    return html.Div(
        [
            theme.page_header(continent.upper(), "Continent Comparison"),
            theme.graph_panel(bubble_fig, f"GDP vs Life Expectancy ({latest_year})"),
            html.Div(
                [
                    theme.graph_panel(life_fig, "Life Expectancy Over Time"),
                    theme.graph_panel(gdp_fig, "GDP per Capita Over Time"),
                ],
                className="demo-row",
            ),
        ],
        className="demo-page",
    )
