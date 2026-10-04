"""
Integration tests for the refresh of a tab.

The Refresh menu item only appears for a tab that has a layout.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_context_menu_refresh_hidden_without_layout(prism_app_with_layouts):
    """Test that Refresh menu item is hidden when tab has no layout assigned."""
    duo = prism_app_with_layouts

    # The initial tab has no layout.
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))

    assert duo.find_elements("[data-testid='prism-context-menu-refresh']") == []

    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=2)


def test_context_menu_has_core_items(prism_app_with_layouts):
    """Test that context menu contains core menu items."""
    duo = prism_app_with_layouts
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))

    core_items = [
        "[data-testid='prism-context-menu-rename']",
        "[data-testid='prism-context-menu-duplicate']",
        "[data-testid='prism-context-menu-close']",
    ]
    for selector in core_items:
        assert duo.find_elements(selector), f"Menu item {selector} should exist"

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
