"""
Integration tests for the split panel button in the TabBar.

Tests that the split button is visible on the active panel, creates a new panel
when clicked, and is hidden on inactive panels.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By

from conftest import (
    SPLIT_PANEL_BUTTON,
    ADD_TAB_BUTTON,
    PANEL_SELECTOR,
    TAB_SELECTOR,
    wait_for_tab_count,
    wait_for_panel_count,
    wait_for_panel_layout_stable,
    get_tabs,
    get_panels,
    check_browser_errors,
)

pytestmark = pytest.mark.integration


def test_split_button_visible_on_active_panel(prism_app_with_layouts):
    """Split button should be visible on the single (active) panel."""
    duo = prism_app_with_layouts

    buttons = duo.driver.find_elements(By.CSS_SELECTOR, SPLIT_PANEL_BUTTON)
    assert len(buttons) == 1, "Split button should be visible on the active panel"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"


def test_split_button_creates_new_panel(prism_app_with_layouts):
    """Clicking the split button should create a second panel with a new tab."""
    duo = prism_app_with_layouts

    # Start with 1 panel, 1 tab
    assert len(get_panels(duo)) == 1
    assert len(get_tabs(duo)) == 1

    # Click split button
    split_btn = duo.find_element(SPLIT_PANEL_BUTTON)
    split_btn.click()

    # Wait for the new panel and tab to appear
    wait_for_panel_count(duo, 2)
    wait_for_tab_count(duo, 2)
    wait_for_panel_layout_stable(duo)

    assert len(get_panels(duo)) == 2, "Should have 2 panels after split"
    assert len(get_tabs(duo)) == 2, "Should have 2 tabs after split"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"


def test_split_button_hidden_when_not_active(prism_app_with_layouts):
    """After split, only the active panel should show the split button."""
    duo = prism_app_with_layouts

    # Split to create two panels
    split_btn = duo.find_element(SPLIT_PANEL_BUTTON)
    split_btn.click()

    wait_for_panel_count(duo, 2)
    wait_for_panel_layout_stable(duo)

    # Only 1 split button should be visible (on the active panel)
    buttons = duo.driver.find_elements(By.CSS_SELECTOR, SPLIT_PANEL_BUTTON)
    assert len(buttons) == 1, "Only the active panel should show the split button"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"


def test_double_click_empty_space_still_works(prism_app_with_layouts):
    """Non-regression: double-clicking the empty tab bar space still adds a tab."""
    duo = prism_app_with_layouts

    assert len(get_tabs(duo)) == 1

    # Double-click the empty space area in the tab bar (inside the scrollable div)
    # The empty space div has title="Double-click to add new tab"
    empty_space = duo.driver.find_element(By.CSS_SELECTOR, "[title='Double-click to add new tab']")

    from selenium.webdriver.common.action_chains import ActionChains

    ActionChains(duo.driver).double_click(empty_space).perform()

    wait_for_tab_count(duo, 2)
    assert len(get_tabs(duo)) == 2, "Double-click on empty space should add a tab"

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"
