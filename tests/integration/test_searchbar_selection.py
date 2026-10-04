"""
Integration tests for selecting layouts from the SearchBar.

Tests the full flow: open search bar -> type query -> select a layout -> verify
the correct tab opens with the correct content rendered.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.keys import Keys

from tests.integration import testutils

pytestmark = pytest.mark.integration


def _search(duo, query: str) -> None:
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3).send_keys(query)


def test_select_layout_from_search(prism_app_with_layouts):
    """Test selecting a layout from search results opens the correct tab."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    _search(duo, "Static")
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5).click()

    testutils.wait_for_tab_named(duo, "Test Static Layout")
    duo.wait_for_element("[id*='static-content']", timeout=10)


def test_select_layout_with_callback_content(prism_app_with_layouts):
    """Test selecting the callback layout renders the callback content."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    _search(duo, "Callback")
    duo.wait_for_element("[data-testid='prism-layout-item-test-callback']", timeout=5).click()

    testutils.wait_for_tab_named(duo, "Test Callback Layout")
    duo.wait_for_element("[id*='test-button']", timeout=10)


def test_search_filters_layouts(prism_app_with_layouts):
    """Test that typing in search bar filters the layout list."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    _search(duo, "Static")

    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5)
    assert (
        duo.find_elements("[data-testid='prism-layout-item-test-callback']") == []
    ), "Callback layout should be filtered out when searching 'Static'"


def test_select_layout_opens_in_current_tab(prism_app_with_layouts):
    """Test that selecting a layout on a new tab replaces the 'New Tab' content."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    _search(duo, "Static")
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5).click()

    testutils.wait_for_tab_named(duo, "Test Static Layout")
    assert len(testutils.get_tabs(duo)) == 1, "Should still have 1 tab after selecting layout"


DISPLAY_BAR = "[data-testid='prism-searchbar-display']"


def _open_static_layout(duo) -> None:
    """Open the static layout in the first tab, so the search bar shows its display mode."""
    _search(duo, "Static")
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5).click()
    duo.wait_for_element(DISPLAY_BAR, timeout=10)


@pytest.mark.parametrize("key", [Keys.ENTER, Keys.SPACE], ids=["enter", "space"])
def test_display_bar_opens_search_from_the_keyboard(prism_app_with_layouts, key):
    """The display bar is a button, so Enter and Space open the search with an empty query."""
    duo = prism_app_with_layouts
    _open_static_layout(duo)
    assert duo.find_element(DISPLAY_BAR).tag_name == "button"

    testutils.tab_to(duo, DISPLAY_BAR)
    testutils.press_key(duo, key)

    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    assert duo.find_element(testutils.SEARCHBAR_INPUT).get_attribute("value") == ""


def test_typing_on_the_display_bar_starts_a_search(prism_app_with_layouts):
    duo = prism_app_with_layouts
    _open_static_layout(duo)

    testutils.tab_to(duo, DISPLAY_BAR)
    testutils.press_key(duo, "c")

    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    assert duo.find_element(testutils.SEARCHBAR_INPUT).get_attribute("value") == "c"
