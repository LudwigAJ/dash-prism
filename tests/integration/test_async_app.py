"""Integration tests for Dash apps with use_async=True.

An app with ``use_async=True`` gets the async render callback of app_init.py,
which is a separate code path from the sync callback.
"""

from __future__ import annotations

import pytest
from dash import Dash, html

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration


def _start_async_prism_app(dash_duo):
    """Start a Prism app with use_async=True, a static layout and two async layouts."""
    app = Dash(__name__, use_async=True, suppress_callback_exceptions=True)

    dash_prism.register_layout(
        id="static-async",
        name="Static Async Layout",
        description="A static layout in an async app",
        layout=html.Div(
            [html.H1("Static in Async"), html.P("Works!", id="static-async-content")],
        ),
    )

    @dash_prism.register_layout(
        id="async-greeting",
        name="Async Greeting",
        description="An async callback layout",
    )
    async def async_greeting_layout():
        return html.Div(
            [
                html.H1("Hello from async!"),
                html.P("Async layout rendered", id="async-greeting-content"),
            ],
        )

    @dash_prism.register_layout(
        id="async-chart",
        name="Async Chart",
        description="Async parameterized layout",
        param_options={
            "bar": ("Bar Chart", {"chart_type": "bar"}),
            "line": ("Line Chart", {"chart_type": "line"}),
        },
    )
    async def async_chart_layout(chart_type: str = "bar"):
        return html.Div(
            [
                html.H2(f"Async Chart: {chart_type}"),
                html.P(f"{chart_type} data", id="async-chart-content"),
            ],
        )

    return testutils.start_prism(dash_duo, app=app, layouts={})


def test_async_app_renders_initial_tab(dash_duo):
    """Test that a use_async=True Prism app renders its initial tab."""
    duo = _start_async_prism_app(dash_duo)

    testutils.wait_for_tab_count(duo, 1)


def test_async_app_static_layout_works(dash_duo):
    """Test that static layouts work in an async Dash app."""
    duo = _start_async_prism_app(dash_duo)
    testutils.wait_for_tab_count(duo, 1)

    duo.wait_for_element(".prism-search-bar", timeout=5)
    duo.find_element(".prism-search-bar").click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys("Static")
    duo.wait_for_element("[data-testid='prism-layout-item-static-async']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-static-async']").click()

    duo.wait_for_element("[id*='static-async-content']", timeout=10)
    testutils.wait_for_tab_named(duo, "Static Async Layout", timeout=5)


def test_async_callback_layout_renders(dash_duo):
    """Test that an async callback layout renders correctly in async mode."""
    duo = _start_async_prism_app(dash_duo)
    testutils.wait_for_tab_count(duo, 1)

    duo.wait_for_element(".prism-search-bar", timeout=5)
    duo.find_element(".prism-search-bar").click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys("Async Greeting")
    duo.wait_for_element("[data-testid='prism-layout-item-async-greeting']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-async-greeting']").click()

    duo.wait_for_element("[id*='async-greeting-content']", timeout=10)
    testutils.wait_for_tab_named(duo, "Async Greeting", timeout=5)


def test_async_app_tab_creation(dash_duo):
    """Test that tab creation works normally in async mode."""
    duo = _start_async_prism_app(dash_duo)
    testutils.wait_for_tab_count(duo, 1)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()

    testutils.wait_for_tab_count(duo, 2)
