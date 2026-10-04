"""Integration tests for tab lifecycle operations.

Tests tab creation, closing, renaming, and other tab management operations
using browser automation via dash[testing].
"""

from __future__ import annotations

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_create_new_tab(prism_app_with_layouts):
    """Test creating a new tab via the add button."""
    duo = prism_app_with_layouts
    assert len(testutils.get_tabs(duo)) == 1, "Should start with 1 initial tab"

    duo.find_element(testutils.ADD_TAB_BUTTON).click()

    testutils.wait_for_tab_count(duo, 2)


def test_add_tab_button_has_an_accessible_name(prism_app_with_layouts):
    """The add button shows only an icon, so its name must come from aria-label."""
    duo = prism_app_with_layouts

    assert duo.find_element(testutils.ADD_TAB_BUTTON).accessible_name == "New tab"


def test_close_tab(prism_app_with_layouts):
    """Test closing a tab via the close button."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    tab_id = testutils.get_tab_id(duo, 1)
    assert tab_id is not None, "Tab ID should not be None"

    # The close button shows only while the pointer is over the tab.
    duo.driver.execute_script(
        "arguments[0].dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}))",
        testutils.get_tabs(duo)[1],
    )
    duo.wait_for_element(f"[data-testid='prism-tab-close-{tab_id}']", timeout=2).click()

    testutils.wait_for_tab_count(duo, 1)


def test_create_multiple_tabs(prism_app_with_layouts):
    """Test creating multiple tabs."""
    duo = prism_app_with_layouts
    add_button = duo.find_element(testutils.ADD_TAB_BUTTON)

    add_button.click()
    testutils.wait_for_tab_count(duo, 2)
    add_button.click()
    testutils.wait_for_tab_count(duo, 3)


def test_max_tabs_limit(prism_app_with_layouts):
    """Test that maxTabs limit is enforced."""
    duo = prism_app_with_layouts

    # The fixture sets maxTabs=10, and the workspace starts with one tab.
    for count in range(2, 11):
        # The button re-renders after each click, so look it up again each time.
        add_button = duo.find_element(testutils.ADD_TAB_BUTTON)
        duo.driver.execute_script("arguments[0].click();", add_button)
        testutils.wait_for_tab_count(duo, count)

    add_button = duo.find_element(testutils.ADD_TAB_BUTTON)
    assert add_button.get_attribute("disabled") is not None, "Add button should be disabled"


def test_tab_selection(prism_app_with_layouts):
    """A click on a tab makes it the one selected tab of the panel."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    tab_ids = [testutils.get_tab_id(duo, 0), testutils.get_tab_id(duo, 1)]

    def selected_tab_ids(driver) -> list[str]:
        return [
            tab_id
            for tab_id in tab_ids
            if driver.find_element(
                By.CSS_SELECTOR, f"[data-testid='prism-tab-{tab_id}'] [role='tab']"
            ).get_attribute("aria-selected")
            == "true"
        ]

    for tab_id in (tab_ids[0], tab_ids[1]):
        duo.find_element(f"[data-testid='prism-tab-{tab_id}']").click()
        WebDriverWait(duo.driver, 5).until(
            lambda driver: selected_tab_ids(driver) == [tab_id],
            message=f"Only tab {tab_id} should be selected",
        )


def test_tab_persists_after_creation(prism_app_with_layouts):
    """Test that a newly created tab persists after Redux sync cycles.

    This is a regression test for an issue where tabs would appear briefly
    and then disappear due to a race condition in the Redux/Dash sync:
    1. Tab is created in Redux state
    2. dashSyncMiddleware syncs state to Dash via setProps
    3. If setProps caused store recreation, the tab would be lost

    The fix ensures the store is stable and tabs persist.
    """
    duo = prism_app_with_layouts
    assert len(testutils.get_tabs(duo)) == 1, "Should start with 1 initial tab"

    # The sync runs 500 ms after the last change. The new tab must outlive it.
    for count in (2, 3):
        duo.find_element(testutils.ADD_TAB_BUTTON).click()
        testutils.wait_for_tab_count(duo, count)
        with pytest.raises(TimeoutException):
            testutils.wait_for_tab_count(duo, count - 1, timeout=1.5)
