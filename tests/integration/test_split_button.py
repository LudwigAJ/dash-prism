"""
Integration tests for the split panel button in the TabBar.

Tests that the split button is visible on the active panel, creates a new panel
when clicked, and is hidden on inactive panels.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By

from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_split_button_visible_on_active_panel(prism_app_with_layouts):
    """Split button should be visible on the single (active) panel."""
    duo = prism_app_with_layouts

    buttons = duo.driver.find_elements(By.CSS_SELECTOR, testutils.SPLIT_PANEL_BUTTON)
    assert len(buttons) == 1, "Split button should be visible on the active panel"


def test_split_button_has_an_accessible_name(prism_app_with_layouts):
    """The split button shows only an icon, so its name must come from aria-label."""
    duo = prism_app_with_layouts

    assert duo.find_element(testutils.SPLIT_PANEL_BUTTON).accessible_name == "Split panel"


def test_split_button_creates_new_panel(prism_app_with_layouts):
    """Clicking the split button should create a second panel with a new tab."""
    duo = prism_app_with_layouts

    assert len(testutils.get_panels(duo)) == 1
    assert len(testutils.get_tabs(duo)) == 1

    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()

    testutils.wait_for_panel_count(duo, 2)
    testutils.wait_for_tab_count(duo, 2)
    testutils.wait_for_panel_layout_stable(duo)


def test_split_button_hidden_when_not_active(prism_app_with_layouts):
    """After split, only the active panel should show the split button."""
    duo = prism_app_with_layouts

    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()
    testutils.wait_for_panel_count(duo, 2)
    testutils.wait_for_panel_layout_stable(duo)

    buttons = duo.driver.find_elements(By.CSS_SELECTOR, testutils.SPLIT_PANEL_BUTTON)
    assert len(buttons) == 1, "Only the active panel should show the split button"


def test_double_click_empty_space_still_works(prism_app_with_layouts):
    """Non-regression: double-clicking the empty tab bar space still adds a tab."""
    duo = prism_app_with_layouts

    assert len(testutils.get_tabs(duo)) == 1

    empty_space = duo.driver.find_element(By.CSS_SELECTOR, "[title='Double-click to add new tab']")

    ActionChains(duo.driver).double_click(empty_space).perform()

    testutils.wait_for_tab_count(duo, 2)
