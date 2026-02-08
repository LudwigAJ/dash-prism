"""
Integration tests for tab renaming.

Tests renaming tabs via the context menu and double-click, verifying the rename
input appears, accepts new text, and commits on Enter/blur.

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
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from conftest import (
    TAB_SELECTOR,
    CONTEXT_MENU,
    get_tabs,
    get_tab_id,
    wait_for_tab_count,
    wait_for_element_invisible,
    check_browser_errors,
    open_context_menu,
    trigger_rename_mode,
    set_input_value_react,
    press_enter_on_element,
)

pytestmark = pytest.mark.integration


def _click_context_menu_rename(duo, tab_id: str) -> str:
    """
    Open context menu and click Rename, waiting for the rename input to appear.

    Radix ContextMenu fires onSelect asynchronously after the menu-close
    animation, so we:
    1. Click the rename item
    2. Wait for the context menu to close (Radix animation)
    3. Wait for the rename input to appear (React state update)

    Returns the CSS selector for the rename input.
    """
    # Click rename menu item
    rename_item = duo.find_element("[data-testid='prism-context-menu-rename']")
    rename_item.click()

    # Wait for context menu to close (Radix animation completes, onSelect fires)
    wait_for_element_invisible(duo, CONTEXT_MENU, timeout=3)

    # Wait for rename input to appear (React renders after state update)
    rename_input_selector = f"[data-testid='prism-tab-rename-{tab_id}']"
    WebDriverWait(duo.driver, 5).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, rename_input_selector)),
        message=f"Rename input should appear after clicking Rename in context menu",
    )
    return rename_input_selector


def test_rename_via_context_menu(prism_app_with_layouts):
    """Test renaming a tab via the context menu Rename option."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    tab_id = get_tab_id(duo, 0)
    assert tab_id is not None, "Tab ID should not be None"

    # Right-click tab to open context menu
    tab = get_tabs(duo)[0]
    open_context_menu(duo, tab)

    # Click rename and wait for input
    rename_input_selector = _click_context_menu_rename(duo, tab_id)

    # Type new name
    rename_input = duo.find_element(rename_input_selector)
    rename_input.clear()
    rename_input.send_keys("My Custom Tab")
    rename_input.send_keys(Keys.ENTER)

    # Wait for rename input to disappear (commit)
    wait_for_element_invisible(duo, rename_input_selector, timeout=3)

    # Verify tab text changed
    def tab_has_new_name(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("My Custom Tab" in t.text for t in tabs)

    WebDriverWait(duo.driver, 5).until(
        tab_has_new_name, message="Tab should be renamed to 'My Custom Tab'"
    )

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_rename_via_double_click(prism_app_with_layouts):
    """Test renaming a tab by double-clicking it."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    tab_id = get_tab_id(duo, 0)
    assert tab_id is not None, "Tab ID should not be None"

    # Double-click the tab's inner trigger (button) to enter rename mode
    result = trigger_rename_mode(duo, tab_id)
    assert result, "Should be able to trigger rename mode"

    # Wait for rename input (allow time for React state + render cycle)
    rename_input_selector = f"[data-testid='prism-tab-rename-{tab_id}']"
    WebDriverWait(duo.driver, 5).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, rename_input_selector)),
        message="Rename input should appear after double-click",
    )

    # Set new name using React-compatible input setter
    set_input_value_react(duo, rename_input_selector, "Renamed Tab")

    # Press Enter to confirm
    press_enter_on_element(duo, rename_input_selector)

    # Wait for rename input to disappear
    wait_for_element_invisible(duo, rename_input_selector, timeout=3)

    # Verify the tab shows the new name
    def tab_has_new_name(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return any("Renamed Tab" in t.text for t in tabs)

    WebDriverWait(duo.driver, 5).until(
        tab_has_new_name, message="Tab should be renamed to 'Renamed Tab'"
    )

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


def test_rename_cancel_with_escape(prism_app_with_layouts):
    """Test that pressing Escape cancels a rename operation."""
    duo = prism_app_with_layouts
    wait_for_tab_count(duo, 1)

    tab_id = get_tab_id(duo, 0)
    assert tab_id is not None

    # Get original tab name
    original_name = get_tabs(duo)[0].text

    # Open context menu and click rename
    tab = get_tabs(duo)[0]
    open_context_menu(duo, tab)

    # Click rename and wait for input
    rename_input_selector = _click_context_menu_rename(duo, tab_id)

    # Type a new name but press Escape to cancel
    rename_input = duo.find_element(rename_input_selector)
    rename_input.clear()
    rename_input.send_keys("This should not stick")
    rename_input.send_keys(Keys.ESCAPE)

    # Wait for rename input to disappear
    wait_for_element_invisible(duo, rename_input_selector, timeout=3)

    # Verify original name is preserved
    tab_text = get_tabs(duo)[0].text
    assert "This should not stick" not in tab_text, (
        f"Escape should cancel rename, but tab text is '{tab_text}'"
    )

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"
