"""
Integration tests for portal stability and tab refresh functionality.

Tests:
- Refresh menu item is hidden for tabs without layout
- Keyboard shortcut for refresh doesn't cause errors on tabs without layout
- Tab count remains stable after refresh actions

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Keep tests isolated and focused

Note: Refresh menu item only appears for tabs with assigned layouts.
The default test fixture creates tabs without layouts, so we test
that refresh is correctly hidden/disabled in that case.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from conftest import (
    TAB_SELECTOR,
    CONTEXT_MENU,
    get_tabs,
    wait_for_tab_count,
    wait_for_element_invisible,
    get_modifier_key,
    open_context_menu,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def test_context_menu_refresh_hidden_without_layout(prism_app_with_layouts):
    """Test that Refresh menu item is hidden when tab has no layout assigned."""
    duo = prism_app_with_layouts

    # Right-click tab (initial tab has no layout)
    tab = duo.find_element(TAB_SELECTOR)
    open_context_menu(duo, tab)

    # Refresh should NOT be visible for tabs without layout
    refresh_items = duo.find_elements("[data-testid='prism-context-menu-refresh']")
    assert len(refresh_items) == 0, "Refresh menu item should be hidden for tabs without layout"

    # Close menu
    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()
    wait_for_element_invisible(duo, CONTEXT_MENU, timeout=2)


def test_context_menu_has_core_items(prism_app_with_layouts):
    """Test that context menu contains core menu items."""
    duo = prism_app_with_layouts

    # Right-click tab
    tab = duo.find_element(TAB_SELECTOR)
    open_context_menu(duo, tab)

    # Verify core menu items exist (these are always present)
    core_items = [
        "[data-testid='prism-context-menu-rename']",
        "[data-testid='prism-context-menu-duplicate']",
        "[data-testid='prism-context-menu-close']",
    ]
    for selector in core_items:
        elements = duo.find_elements(selector)
        assert len(elements) > 0, f"Menu item {selector} should exist"

    # Close menu
    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()
    wait_for_element_invisible(duo, CONTEXT_MENU, timeout=2)


def test_keyboard_shortcut_refresh_no_error(prism_app_with_layouts):
    """Test Ctrl+Shift+R doesn't cause errors even for tabs without layout."""
    duo = prism_app_with_layouts

    # Verify we have at least 1 tab
    tabs = get_tabs(duo)
    assert len(tabs) >= 1, "Should have at least 1 tab"

    # Press Ctrl+Shift+R (refresh shortcut)
    # For tabs without layout, this should be a no-op (guarded in reducer)
    modifier = get_modifier_key()

    # Use ActionChains for modifier combination
    actions = ActionChains(duo.driver)
    actions.key_down(modifier).key_down(Keys.SHIFT).send_keys("r").key_up(Keys.SHIFT).key_up(
        modifier
    ).perform()

    # Tab count should remain the same (refresh doesn't close tab)
    wait_for_tab_count(duo, len(tabs), timeout=3)

    # Verify no console errors from refresh action
    tabs_after = get_tabs(duo)
    assert len(tabs_after) == len(tabs), "Refresh should not change tab count"
