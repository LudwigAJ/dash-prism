"""Integration tests for tab lifecycle operations.

Tests tab creation, closing, renaming, and other tab management operations
using browser automation via dash[testing].
"""

from __future__ import annotations

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
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


def test_close_button_is_a_named_button_outside_the_tab(prism_app_with_layouts):
    """The close button is a native button next to the tab trigger, not inside it.

    A button inside the role=tab button is invalid nesting, and a screen reader
    announces the two controls as one. The tab wrapper is no button either.
    """
    duo = prism_app_with_layouts
    tab_id = testutils.get_tab_id(duo, 0)
    close = duo.find_element(f"[data-testid='prism-tab-close-{tab_id}']")

    assert close.tag_name == "button"
    assert close.accessible_name == f"Close {testutils.get_tabs(duo)[0].text} tab"
    nested = duo.driver.execute_script(
        "return document.querySelectorAll("
        "\"[role='tab'] button, [role='tab'] [role='button'], [role='tab'] input\").length;"
    )
    assert nested == 0, "A tab trigger must not hold another control"
    wrapper = testutils.get_tabs(duo)[0]
    assert wrapper.get_attribute("role") is None
    assert wrapper.get_attribute("tabindex") is None


def test_tab_list_has_one_tab_stop(prism_app_with_layouts):
    """Tab leaves the tab list from the active tab: no wrapper and no close button stops it."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    tab_id = testutils.get_tab_id(duo, 0)
    close = duo.find_element(f"[data-testid='prism-tab-close-{tab_id}']")
    assert close.get_attribute("tabindex") == "-1"

    duo.find_element(f"[data-testid='prism-tab-{tab_id}'] [role='tab']").click()
    testutils.press_key(duo, Keys.TAB)

    focused = duo.driver.execute_script("return document.activeElement.dataset.testid;")
    assert focused == "prism-tab-bar-add-button"


# The live region of dnd-kit announces each step of a keyboard drag.
DND_ANNOUNCEMENT = "return document.querySelector(\"[id^='DndLiveRegion']\")?.textContent ?? '';"


def _focus_first_tab_with_the_arrow_key(duo) -> str:
    """Select the second of two tabs, move the focus to the first with ArrowLeft, return its trigger."""
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    first, second = testutils.get_tab_id(duo, 0), testutils.get_tab_id(duo, 1)
    trigger = "[data-testid='prism-tab-{}'] [role='tab']"

    duo.find_element(trigger.format(second)).click()
    testutils.press_key(duo, Keys.ARROW_LEFT)
    assert duo.find_element(trigger.format(first)).get_attribute("aria-selected") == "false"
    return trigger.format(first)


def _wait_until_selected(duo, trigger: str) -> None:
    WebDriverWait(duo.driver, 3).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, trigger).get_attribute("aria-selected")
        == "true",
        message="The key should select the focused tab",
    )


def test_enter_selects_the_focused_tab_without_a_drag(prism_app_with_layouts):
    """The tabs use manual activation: an arrow key moves the focus, and Enter selects.

    The keyboard sensor of dnd-kit starts on Space only, so Enter starts no drag.
    """
    duo = prism_app_with_layouts
    trigger = _focus_first_tab_with_the_arrow_key(duo)

    testutils.press_key(duo, Keys.ENTER)
    _wait_until_selected(duo, trigger)
    announcement = duo.driver.execute_script(DND_ANNOUNCEMENT)
    assert "Picked up" not in announcement and "moved over" not in announcement

    testutils.press_key(duo, Keys.ESCAPE)
    assert "cancelled" not in duo.driver.execute_script(DND_ANNOUNCEMENT)


def test_space_selects_the_focused_tab_and_picks_it_up(prism_app_with_layouts):
    """Space selects the focused tab and starts a keyboard drag, which Escape cancels."""
    duo = prism_app_with_layouts
    trigger = _focus_first_tab_with_the_arrow_key(duo)

    testutils.press_key(duo, Keys.SPACE)
    _wait_until_selected(duo, trigger)
    WebDriverWait(duo.driver, 3).until(
        lambda driver: "moved over" in driver.execute_script(DND_ANNOUNCEMENT),
        message="Space should pick the tab up",
    )

    testutils.press_key(duo, Keys.ESCAPE)
    WebDriverWait(duo.driver, 3).until(
        lambda driver: "cancelled" in driver.execute_script(DND_ANNOUNCEMENT),
        message="Escape should cancel the drag",
    )


@pytest.mark.parametrize("key", [Keys.DELETE, Keys.BACKSPACE])
def test_delete_closes_the_focused_tab(prism_app_with_layouts, key):
    """Delete (Backspace on a Mac keyboard) closes the focused tab and keeps the focus in the tab list."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    tab_id = testutils.get_tab_id(duo, 1)

    duo.find_element(f"[data-testid='prism-tab-{tab_id}'] [role='tab']").click()
    testutils.press_key(duo, key)

    testutils.wait_for_tab_count(duo, 1)
    assert testutils.get_tab_id(duo, 0) != tab_id
    WebDriverWait(duo.driver, 2).until(
        lambda driver: driver.execute_script("return document.activeElement.getAttribute('role');")
        == "tab",
        message="The focus must move to the tab that is active after the close",
    )


def test_delete_on_the_last_tab_of_a_panel_moves_the_focus_to_another_panel(
    prism_app_with_layouts,
):
    """The panel closes with its last tab, so the focus goes to the active tab of another panel."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()
    testutils.wait_for_panel_count(duo, 2)
    testutils.wait_for_tab_count(duo, 2)
    tab_id = testutils.get_tab_id(duo, 1)

    duo.find_element(f"[data-testid='prism-tab-{tab_id}'] [role='tab']").click()
    testutils.press_key(duo, Keys.DELETE)

    testutils.wait_for_panel_count(duo, 1)
    WebDriverWait(duo.driver, 2).until(
        lambda driver: driver.execute_script("return document.activeElement.getAttribute('role');")
        == "tab",
        message="The focus must move to the active tab of the panel that is left",
    )


def test_delete_keeps_a_locked_tab(prism_app_with_layouts):
    """Delete does nothing on a locked tab, as the hidden close button suggests."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    tab_id = testutils.get_tab_id(duo, 1)
    trigger = f"[data-testid='prism-tab-{tab_id}'] [role='tab']"
    duo.find_element(trigger).click()
    duo.find_element("body").send_keys(testutils.get_modifier_key(), "o")
    duo.wait_for_element(f"{trigger}[data-locked]", timeout=3)

    duo.find_element(trigger).click()
    testutils.press_key(duo, Keys.DELETE)

    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 1, timeout=1.5)


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
