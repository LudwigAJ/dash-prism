"""
Integration tests for selecting layouts from the SearchBar.

Tests the full flow: open search bar -> type query -> select a layout -> verify
the correct tab opens with the correct content rendered.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait

from conftest import (
    TAB_SELECTOR,
    SEARCHBAR_INPUT,
    wait_for_tab_count,
    get_tabs,
    check_browser_errors,
)

pytestmark = pytest.mark.integration


def test_select_layout_from_search(prism_app_with_layouts):
    """Test selecting a layout from search results opens the correct tab."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    # Open SearchBar
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)

    # Search for "Test Static Layout"
    search_input = duo.find_element(SEARCHBAR_INPUT)
    search_input.send_keys("Static")

    # Wait for layout item to appear in dropdown
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5)

    # Click the layout item
    duo.find_element("[data-testid='prism-layout-item-test-static']").click()

    # Verify tab name updated to the layout name
    def tab_shows_layout(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("Test Static Layout" in t.text for t in tabs)

    WebDriverWait(duo.driver, 10).until(
        tab_shows_layout, message="Tab should show 'Test Static Layout' after selection"
    )

    # Verify the layout content was rendered
    duo.wait_for_element("[id*='static-content']", timeout=10)

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_select_layout_with_callback_content(prism_app_with_layouts):
    """Test selecting the callback layout renders the callback content."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    # Open SearchBar
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)

    # Search for "Callback"
    search_input = duo.find_element(SEARCHBAR_INPUT)
    search_input.send_keys("Callback")

    # Wait for layout item to appear
    duo.wait_for_element("[data-testid='prism-layout-item-test-callback']", timeout=5)

    # Click it
    duo.find_element("[data-testid='prism-layout-item-test-callback']").click()

    # Verify tab name
    def tab_shows_callback(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("Test Callback Layout" in t.text for t in tabs)

    WebDriverWait(duo.driver, 10).until(
        tab_shows_callback, message="Tab should show 'Test Callback Layout'"
    )

    # Verify the callback layout content is rendered
    duo.wait_for_element("[id*='test-button']", timeout=10)

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_search_filters_layouts(prism_app_with_layouts):
    """Test that typing in search bar filters the layout list."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    # Open SearchBar
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)

    # Type a query that matches only the static layout
    search_input = duo.find_element(SEARCHBAR_INPUT)
    search_input.send_keys("Static")

    # The static layout item should appear
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5)

    # The callback layout item should NOT appear (filtered out)
    callback_items = duo.find_elements("[data-testid='prism-layout-item-test-callback']")
    assert len(callback_items) == 0, "Callback layout should be filtered out when searching 'Static'"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_select_layout_opens_in_current_tab(prism_app_with_layouts):
    """Test that selecting a layout on a new tab replaces the 'New Tab' content."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    # The initial tab should be "New Tab"
    tabs = get_tabs(duo)
    assert len(tabs) == 1, "Should start with 1 tab"

    # Select a layout
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)
    duo.find_element(SEARCHBAR_INPUT).send_keys("Static")
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-test-static']").click()

    # Should still have 1 tab (layout opens in the current tab, not a new one)
    wait_for_tab_count(duo, 1)
    tabs = get_tabs(duo)
    assert len(tabs) == 1, "Should still have 1 tab after selecting layout"

    # But the tab name should have changed
    def tab_renamed(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("Test Static Layout" in t.text for t in tabs)

    WebDriverWait(duo.driver, 10).until(tab_renamed, message="Tab should show layout name")

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"
