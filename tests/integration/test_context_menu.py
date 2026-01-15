"""
Integration tests for context menu interactions.

Tests right-click menu on tabs: rename, duplicate, lock/unlock, close,
style variants, and icon selection.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    CONTEXT_MENU,
    get_tabs,
    wait_for_tab_count,
    wait_for_element_invisible,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def open_context_menu(dash_duo, tab_element):
    """
    Open context menu on a tab element.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_element : WebElement
        The tab element to right-click.
    """
    ActionChains(dash_duo.driver).context_click(tab_element).perform()
    dash_duo.wait_for_element(CONTEXT_MENU, timeout=3)


def test_context_menu_appears_on_right_click(prism_app_with_layouts):
    """Test that context menu appears on right-click."""
    duo = prism_app_with_layouts

    # Right-click tab
    tab = duo.find_element(TAB_SELECTOR)
    open_context_menu(duo, tab)

    # Verify menu appears
    context_menu = duo.find_element(CONTEXT_MENU)
    assert context_menu.is_displayed(), "Context menu should be visible"

    # Press Escape to close menu
    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()

    # Wait for menu to close (explicit wait)
    wait_for_element_invisible(duo, CONTEXT_MENU, timeout=2)


def test_context_menu_close(prism_app_with_layouts):
    """Test closing tab via context menu."""
    duo = prism_app_with_layouts

    # Create 2 tabs total (1 initial + 1 new)
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    tabs = get_tabs(duo)
    assert len(tabs) == 2

    # Right-click first tab
    tab = tabs[0]
    open_context_menu(duo, tab)

    # Click close menu item
    close_item = duo.find_element("[data-testid='prism-context-menu-close']")
    close_item.click()

    # Wait for tab to be closed (explicit wait)
    wait_for_tab_count(duo, 1)

    # Verify tab closed
    tabs_after = get_tabs(duo)
    assert len(tabs_after) == 1, "Tab should be closed"


def test_context_menu_has_expected_items(prism_app_with_layouts):
    """Test that context menu contains expected menu items."""
    duo = prism_app_with_layouts

    # Right-click tab
    tab = duo.find_element(TAB_SELECTOR)
    open_context_menu(duo, tab)

    # Verify expected menu items exist
    expected_items = [
        "[data-testid='prism-context-menu-rename']",
        "[data-testid='prism-context-menu-duplicate']",
        "[data-testid='prism-context-menu-info']",
        "[data-testid='prism-context-menu-close']",
    ]

    for selector in expected_items:
        elements = duo.find_elements(selector)
        assert len(elements) > 0, f"Menu item {selector} should exist"

    # Close menu
    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()


def test_context_menu_duplicate_creates_new_tab(prism_app_with_layouts):
    """Test that duplicate menu item creates a new tab."""
    duo = prism_app_with_layouts

    # Verify starting with 1 tab
    initial_count = len(get_tabs(duo))
    assert initial_count == 1, "Should start with 1 tab"

    # Right-click tab
    tab = duo.find_element(TAB_SELECTOR)
    open_context_menu(duo, tab)

    # Click duplicate menu item
    duplicate_item = duo.find_element("[data-testid='prism-context-menu-duplicate']")
    duplicate_item.click()

    # Wait for new tab to appear
    wait_for_tab_count(duo, 2)

    # Verify 2 tabs exist
    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Duplicate should create new tab"


def test_context_menu_closes_on_escape(prism_app_with_layouts):
    """Test that pressing Escape closes the context menu."""
    duo = prism_app_with_layouts

    # Right-click tab
    tab = duo.find_element(TAB_SELECTOR)
    open_context_menu(duo, tab)

    # Verify menu is visible
    context_menu = duo.find_element(CONTEXT_MENU)
    assert context_menu.is_displayed(), "Context menu should be visible"

    # Press Escape
    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()

    # Wait for menu to close
    wait_for_element_invisible(duo, CONTEXT_MENU, timeout=2)

    # Verify menu is gone or not visible
    menus = duo.find_elements(CONTEXT_MENU)
    if len(menus) > 0:
        assert not menus[0].is_displayed(), "Context menu should be hidden"
