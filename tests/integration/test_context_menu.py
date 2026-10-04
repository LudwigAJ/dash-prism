"""Integration tests for context menu interactions.

Tests right-click menu on tabs: rename, duplicate, lock/unlock, close,
style variants, and icon selection. Also tests the refresh of a tab, which the
menu offers only for a tab that has a layout, and its keyboard shortcut.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_context_menu_appears_on_right_click(prism_app_with_layouts):
    """Test that context menu appears on right-click."""
    duo = prism_app_with_layouts
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))

    assert duo.find_element(testutils.CONTEXT_MENU).is_displayed()

    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=2)


def test_context_menu_close(prism_app_with_layouts):
    """Test closing tab via context menu."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    testutils.open_context_menu(duo, testutils.get_tabs(duo)[0])
    duo.find_element("[data-testid='prism-context-menu-close']").click()

    testutils.wait_for_tab_count(duo, 1)


def test_context_menu_has_expected_items(prism_app_with_layouts):
    """Test that context menu contains expected menu items."""
    duo = prism_app_with_layouts
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))

    expected_items = [
        "[data-testid='prism-context-menu-rename']",
        "[data-testid='prism-context-menu-duplicate']",
        "[data-testid='prism-context-menu-info']",
        "[data-testid='prism-context-menu-close']",
    ]

    for selector in expected_items:
        assert duo.find_elements(selector), f"Menu item {selector} should exist"

    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()


def test_context_menu_duplicate_creates_new_tab(prism_app_with_layouts):
    """Test that duplicate menu item creates a new tab."""
    duo = prism_app_with_layouts
    assert len(testutils.get_tabs(duo)) == 1, "Should start with 1 tab"

    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))
    duo.find_element("[data-testid='prism-context-menu-duplicate']").click()

    testutils.wait_for_tab_count(duo, 2)


def test_context_menu_closes_on_escape(prism_app_with_layouts):
    """Test that pressing Escape closes the context menu."""
    duo = prism_app_with_layouts
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))
    assert duo.find_element(testutils.CONTEXT_MENU).is_displayed()

    ActionChains(duo.driver).send_keys(Keys.ESCAPE).perform()
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=2)

    menus = duo.find_elements(testutils.CONTEXT_MENU)
    if menus:
        assert not menus[0].is_displayed(), "Context menu should be hidden"


ICON_DIALOG = "[role='dialog']"
ICON_BUTTONS = f"{ICON_DIALOG} button[aria-pressed]"


def _open_icon_picker(duo):
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))
    duo.find_element("[data-testid='prism-context-menu-icon']").click()
    duo.wait_for_element(ICON_DIALOG, timeout=5)
    return duo.find_elements(ICON_BUTTONS)


def test_icon_picker_buttons_have_names_and_announce_the_current_icon(prism_app_with_layouts):
    duo = prism_app_with_layouts

    buttons = _open_icon_picker(duo)
    assert buttons[0].accessible_name == "No icon"
    assert buttons[0].get_attribute("aria-pressed") == "true"
    assert all(button.accessible_name for button in buttons)
    assert [button.get_attribute("aria-pressed") for button in buttons[1:]] == ["false"] * len(
        buttons[1:]
    )

    chosen = buttons[1].accessible_name
    buttons[1].click()
    testutils.wait_for_element_invisible(duo, ICON_DIALOG, timeout=3)

    buttons = _open_icon_picker(duo)
    pressed = [b.accessible_name for b in buttons if b.get_attribute("aria-pressed") == "true"]
    assert pressed == [chosen]


# =============================================================================
# Refresh of a tab
# =============================================================================
def test_context_menu_refresh_hidden_without_layout(prism_app_with_layouts):
    """Test that Refresh menu item is hidden when tab has no layout assigned."""
    duo = prism_app_with_layouts

    # The initial tab has no layout.
    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))

    assert duo.find_elements("[data-testid='prism-context-menu-refresh']") == []

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
