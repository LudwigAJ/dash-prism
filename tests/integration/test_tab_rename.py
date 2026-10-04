"""
Integration tests for tab renaming.

Tests renaming tabs via the context menu and double-click, verifying the rename
input appears, accepts new text, and commits on Enter/blur.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.keys import Keys

from tests.integration import testutils

pytestmark = pytest.mark.integration


def _click_context_menu_rename(duo, tab_id: str) -> str:
    """
    Click Rename in the open context menu and wait for the rename input.

    Radix ContextMenu calls onSelect after the close animation of the menu, so
    the rename input appears only after the menu is gone.

    :returns: The CSS selector of the rename input.
    """
    duo.find_element("[data-testid='prism-context-menu-rename']").click()
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=3)

    rename_input_selector = f"[data-testid='prism-tab-rename-{tab_id}']"
    duo.wait_for_element(rename_input_selector, timeout=5)
    return rename_input_selector


def test_rename_via_context_menu(prism_app_with_layouts):
    """Test renaming a tab via the context menu Rename option."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    tab_id = testutils.get_tab_id(duo, 0)
    assert tab_id is not None, "Tab ID should not be None"

    testutils.open_context_menu(duo, testutils.get_tabs(duo)[0])
    rename_input_selector = _click_context_menu_rename(duo, tab_id)

    # The input re-renders on each key press, so the native setter avoids a stale element.
    testutils.set_input_value_react(duo, rename_input_selector, "My Custom Tab")
    testutils.press_enter_on_element(duo, rename_input_selector)

    testutils.wait_for_element_invisible(duo, rename_input_selector, timeout=3)
    testutils.wait_for_tab_named(duo, "My Custom Tab", timeout=5)


def test_rename_input_has_an_accessible_name(prism_app_with_layouts):
    """The rename input has no visible label, so its name must come from aria-label."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    tab_id = testutils.get_tab_id(duo, 0)
    assert tab_id is not None, "Tab ID should not be None"
    rename_input_selector = testutils.trigger_rename_mode(duo, tab_id)

    assert duo.find_element(rename_input_selector).accessible_name == "Tab name"


def test_rename_via_double_click(prism_app_with_layouts):
    """Test renaming a tab by double-clicking it."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    tab_id = testutils.get_tab_id(duo, 0)
    assert tab_id is not None, "Tab ID should not be None"

    rename_input_selector = testutils.trigger_rename_mode(duo, tab_id)
    testutils.set_input_value_react(duo, rename_input_selector, "Renamed Tab")
    testutils.press_enter_on_element(duo, rename_input_selector)

    testutils.wait_for_element_invisible(duo, rename_input_selector, timeout=3)
    testutils.wait_for_tab_named(duo, "Renamed Tab", timeout=5)


def test_rename_cancel_with_escape(prism_app_with_layouts):
    """Test that pressing Escape cancels a rename operation."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    tab_id = testutils.get_tab_id(duo, 0)
    assert tab_id is not None

    original_name = testutils.get_tabs(duo)[0].text
    testutils.open_context_menu(duo, testutils.get_tabs(duo)[0])
    rename_input_selector = _click_context_menu_rename(duo, tab_id)

    testutils.set_input_value_react(duo, rename_input_selector, "This should not stick")
    duo.find_element(rename_input_selector).send_keys(Keys.ESCAPE)

    testutils.wait_for_element_invisible(duo, rename_input_selector, timeout=3)
    tab_text = testutils.get_tabs(duo)[0].text
    assert tab_text == original_name, f"Escape should keep '{original_name}', got '{tab_text}'"


def test_rename_shortcut_starts_in_the_panel_that_owns_the_tab(prism_app_with_layouts):
    """Ctrl/Cmd+R renames the active tab of whichever panel is active.

    Every panel sees the rename request in the store. Only the panel that holds
    the tab may start the rename and clear the request.
    """
    duo = prism_app_with_layouts
    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()
    testutils.wait_for_panel_count(duo, 2)
    testutils.wait_for_tab_count(duo, 2)

    modifier = testutils.get_modifier_key()
    for index in (1, 0):
        tab_id = testutils.get_tab_id(duo, index)
        assert tab_id is not None
        testutils.get_tabs(duo)[index].click()

        duo.find_element("body").send_keys(modifier, "r")
        rename_input_selector = f"[data-testid='prism-tab-rename-{tab_id}']"
        duo.wait_for_element(rename_input_selector, timeout=5)
        assert len(duo.find_elements("[data-testid^='prism-tab-rename-']")) == 1

        duo.find_element(rename_input_selector).send_keys(Keys.ESCAPE)
        testutils.wait_for_element_invisible(duo, rename_input_selector, timeout=3)
