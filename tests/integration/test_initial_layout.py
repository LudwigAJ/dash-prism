"""
Integration tests for the initialLayout prop.

Regression tests for the bug where initialLayout was validated on the Python
side but never applied by the frontend. The first tab always opened as an
empty "New Tab" regardless of the initialLayout setting.
"""

from __future__ import annotations

import pytest
from dash import html

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_initial_layout_applied_on_fresh_workspace(dash_duo):
    """Regression test: initialLayout should load in the first tab on fresh workspace.

    Previously, initialLayout was validated on the Python side and passed through
    ConfigContext but no frontend code read it and applied it. The first tab always
    opened as 'New Tab' with no layout.
    """
    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )
    dash_prism.register_layout(
        id="analytics",
        name="Analytics",
        layout=html.Div("Analytics content", id="analytics-content"),
    )

    duo = testutils.start_prism(dash_duo, layouts={}, initialLayout="home")

    assert len(testutils.get_tabs(duo)) == 1, "Should have 1 tab"
    testutils.wait_for_tab_named(duo, "Home Dashboard", index=0)
    # inject_tab_id turns the ID into a pattern ID, so the selector matches a part of it.
    duo.wait_for_element("[id*='home-content']", timeout=10)


def test_initial_layout_ignored_with_persistence(dash_duo):
    """Test that initialLayout does NOT override a persisted workspace.

    When persistence is enabled and a saved workspace exists, the persisted
    state should take precedence over initialLayout.
    """
    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    duo = testutils.start_prism(dash_duo, layouts={}, initialLayout="home")

    testutils.wait_for_tab_named(duo, "Home Dashboard", index=0)


def test_initial_layout_without_prop_shows_new_tab(dash_duo):
    """Test that without initialLayout, the first tab is a plain 'New Tab'."""
    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    duo = testutils.start_prism(dash_duo, layouts={})

    tabs = testutils.get_tabs(duo)
    assert len(tabs) == 1, "Should have 1 tab"
    assert (
        "New Tab" in tabs[0].text
    ), f"Without initialLayout, tab should be 'New Tab', got '{tabs[0].text}'"


def test_initial_layout_new_tabs_still_empty(dash_duo):
    """Test that only the FIRST tab gets initialLayout, not subsequent new tabs."""
    dash_prism.register_layout(
        id="home",
        name="Home Dashboard",
        layout=html.Div("Home content", id="home-content"),
    )

    duo = testutils.start_prism(dash_duo, layouts={}, initialLayout="home")
    testutils.wait_for_tab_named(duo, "Home Dashboard", index=0)

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    second_tab_text = testutils.get_tabs(duo)[1].text
    assert "New Tab" in second_tab_text, (
        f"Second tab should be 'New Tab', got '{second_tab_text}'. "
        "initialLayout should only apply to the first tab on a fresh workspace."
    )
