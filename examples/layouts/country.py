"""The country layout, which takes a validated string parameter and opens in many tabs."""

from __future__ import annotations

from typing import Annotated

import plotly.express as px
from dash import html

import dash_prism
from examples import theme

_REFERENCE_YEAR = 2007


@dash_prism.register_layout(
    id="country",
    name="Country Explorer",
    description="Explore economic data for a specific country",
    keywords=["country", "gapminder", "gdp", "population", "world", "economy"],
    allow_multiple=True,
)
def country_layout(
    country: Annotated[
        str,
        dash_prism.Param(
            min_length=2, description="Country name as spelled in the Gapminder dataset"
        ),
    ] = "United States",
) -> html.Div:
    """Return the life expectancy, GDP and population of one country over time.

    :param country: The name of the country, as the Gapminder dataset spells it.
    """
    df = px.data.gapminder()
    country_df = df[df["country"] == country]
    if country_df.empty:
        return html.Div(
            [
                html.H2(f"Country not found: {country}", className="demo-error"),
                html.P("Spell the name as the Gapminder dataset does, for example Germany."),
            ],
            className="demo-page",
        )

    life_fig = px.line(country_df, x="year", y="lifeExp", markers=True, title="Life Expectancy")
    gdp_fig = px.line(country_df, x="year", y="gdpPercap", markers=True, title="GDP per Capita")
    pop_fig = px.area(country_df, x="year", y="pop", title="Population")
    for fig in (life_fig, gdp_fig, pop_fig):
        fig.add_vline(x=_REFERENCE_YEAR, line_dash="dash", line_color=theme.ACCENT, line_width=1)

    return html.Div(
        [
            theme.page_header(country.upper(), f"Reference: {_REFERENCE_YEAR}"),
            theme.graph_panel(life_fig),
            theme.graph_panel(gdp_fig),
            theme.graph_panel(pop_fig),
        ],
        className="demo-page",
    )
