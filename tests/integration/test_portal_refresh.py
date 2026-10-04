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
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def test_context_menu_refresh_hidden_without_layout(prism_app_with_layouts):
    """Test that Refresh menu item is hidden when tab has no layout assigned."""
    duo = prism_app_with_layouts

    # Right-click tab (initial tab has no layout)
    tab = duo.find_element(testutils.TAB_SELECTOR)
    testutils.open_context_menu(duo, tab)

    # Refresh should NOT be visible for tabs without layout
    refresh_items = duo.find_elements("[data-testid='prism-context-menu-refresh']")
    assert len(refresh_items) == 0, "Refresh menu item should be hidden for tabs without layout"

    # Close menu
    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=2)


def test_context_menu_has_core_items(prism_app_with_layouts):
    """Test that context menu contains core menu items."""
    duo = prism_app_with_layouts

    # Right-click tab
    tab = duo.find_element(testutils.TAB_SELECTOR)
    testutils.open_context_menu(duo, tab)

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
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=2)


def test_refresh_shortcut_remounts_the_tab_content(prism_app_with_layouts):
    """Ctrl/Cmd+Shift+R renders the layout of the active tab again, in the same tab."""
    duo = prism_app_with_layouts
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-test-static']").click()
    content = duo.wait_for_element("[id*='static-content']", timeout=10)

    modifier = testutils.get_modifier_key()
    ActionChains(duo.driver).key_down(modifier).key_down(Keys.SHIFT).send_keys("r").key_up(
        Keys.SHIFT
    ).key_up(modifier).perform()

    WebDriverWait(duo.driver, 10).until(
        EC.staleness_of(content), message="The refresh should mount the tab content again"
    )
    duo.wait_for_element("[id*='static-content']", timeout=10)
    assert [tab.text for tab in testutils.get_tabs(duo)] == ["Test Static Layout"]
