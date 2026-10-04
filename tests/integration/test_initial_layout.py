"""Integration tests for the initialLayout prop.

Regression tests for the bug where initialLayout was validated on the Python
side but never applied by the frontend. The first tab always opened as an
empty "New Tab" regardless of the initialLayout setting.
"""

from __future__ import annotations

import json

import pytest
from dash import html
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

DISPLAY_BAR = "[data-testid='prism-searchbar-display']"


def _stored_layout_ids(driver) -> list[str] | None:
    """Return the layout ID of each tab in the persisted workspace, or None before the write."""
    raw = driver.execute_script(
        "return localStorage.getItem(arguments[0]);", testutils.storage_key("prism")
    )
    if raw is None:
        return None
    return [tab.get("layoutId") for tab in json.loads(json.loads(raw)["present"])["tabs"]]


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


def test_persisted_workspace_wins_over_initial_layout(dash_duo):
    """A restored workspace keeps its tabs, even when its one tab holds another layout.

    initialLayout fills only a fresh workspace: one tab without a layout.
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
    duo = testutils.start_prism(
        dash_duo,
        layouts={},
        initialLayout="home",
        persistence=True,
        persistence_type="local",
    )
    testutils.wait_for_tab_named(duo, "Home Dashboard", index=0)

    # Put the other layout into the only tab, so the persisted workspace differs
    # from the one that initialLayout makes.
    duo.find_element(DISPLAY_BAR).click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3).send_keys("Analytics")
    duo.wait_for_element("[data-testid='prism-layout-item-analytics']", timeout=5).click()
    testutils.wait_for_tab_named(duo, "Analytics", index=0)
    WebDriverWait(duo.driver, 5).until(
        lambda driver: _stored_layout_ids(driver) == ["analytics"],
        message="The workspace with the analytics tab should reach localStorage",
    )

    duo.driver.refresh()
    duo.wait_for_element("[id*='analytics-content']", timeout=10)

    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_named(duo, "Home Dashboard", timeout=1.5)
    assert [tab.text for tab in testutils.get_tabs(duo)] == ["Analytics"]


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
