"""Tests for the keyboard drag of a tab between panels.

Space picks up the focused tab. The arrow keys move the drag from one drop target to the
next, Enter drops the tab, and Escape cancels the drag. The keys reach only the drop
targets that a mouse drag of the same tab reaches.
"""

from __future__ import annotations

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration

# Keeps each announcement of dnd-kit, so a test can check every target that a drag passed.
_RECORD_ANNOUNCEMENTS = """
window.__dndAnnouncements = [];
const region = document.querySelector("[id^='DndLiveRegion']");
new MutationObserver(() => window.__dndAnnouncements.push(region.textContent)).observe(
  region, {childList: true, characterData: true, subtree: true}
);
"""


def _open_two_panels(duo) -> tuple[str, str, str]:
    """Open tabs A and B in panel 1, and tab C in panel 2 at its right.

    :returns: The IDs of A, B and C.
    """
    a, b = testutils.create_tabs_for_dnd_test(duo, 2)
    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()
    testutils.wait_for_panel_count(duo, 2)
    testutils.wait_for_panel_layout_stable(duo)
    (c,) = testutils.get_tab_order_in_panel(duo, 1)
    return a, b, c


def _press_shortcut(duo, key: str) -> None:
    duo.find_element("body").send_keys(testutils.get_modifier_key(), key)


def test_arrow_keys_move_the_tab_to_an_edge_of_another_panel(prism_app_with_layouts):
    """Space, the arrow keys and Enter split panel 2 and move the tab into the new panel."""
    duo = prism_app_with_layouts
    a, b, c = _open_two_panels(duo)
    panel_2 = testutils.get_panel_id(duo, 1)

    duo.find_element(testutils.tab_trigger(a)).click()
    testutils.press_drag_key(duo, Keys.SPACE, "Drop target: position 1 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 1 in panel 2")
    testutils.press_drag_key(duo, Keys.ARROW_DOWN, "Drop target: top edge of panel 2")
    # The zone shows the same highlight as for a mouse drag.
    duo.wait_for_element(f"[data-testid='prism-drop-zone-top-{panel_2}'] > div", timeout=3)
    testutils.press_drag_key(duo, Keys.ENTER, "You dropped tab")

    testutils.wait_for_panel_count(duo, 3)
    assert [testutils.get_tab_order_in_panel(duo, i) for i in range(3)] == [[b], [a], [c]]
    testutils.wait_for_focus(duo, testutils.tab_trigger(a))


def test_arrow_keys_reach_the_end_of_the_tab_bar_of_another_panel(prism_app_with_layouts):
    """The end of a tab bar comes after its last tab. A drop there appends the tab."""
    duo = prism_app_with_layouts
    a, b, c = _open_two_panels(duo)

    duo.find_element(testutils.tab_trigger(a)).click()
    testutils.press_drag_key(duo, Keys.SPACE, "Drop target: position 1 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 1 in panel 2")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 2")
    testutils.press_drag_key(duo, Keys.ENTER, "You dropped tab")

    WebDriverWait(duo.driver, 5).until(
        lambda _: testutils.get_tab_order_in_panel(duo, 1) == [c, a],
        message="The tab should move to the end of panel 2",
    )
    assert testutils.get_tab_order_in_panel(duo, 0) == [b]
    testutils.wait_for_focus(duo, testutils.tab_trigger(a))


def test_escape_leaves_the_workspace_unchanged(prism_app_with_layouts):
    """Escape cancels a keyboard drag, also over another panel, and the tab stays."""
    duo = prism_app_with_layouts
    a, b, c = _open_two_panels(duo)

    duo.find_element(testutils.tab_trigger(a)).click()
    testutils.press_drag_key(duo, Keys.SPACE, "Drop target: position 1 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 1 in panel 2")
    testutils.press_drag_key(duo, Keys.ESCAPE, "You cancelled the drag")

    assert len(testutils.get_panels(duo)) == 2
    assert [testutils.get_tab_order_in_panel(duo, i) for i in range(2)] == [[a, b], [c]]
    testutils.wait_for_focus(duo, testutils.tab_trigger(a))


def test_space_on_a_locked_tab_selects_it_and_starts_no_drag(prism_app_with_layouts):
    """A mouse cannot drag a locked tab, so Space does not pick it up. Space selects it."""
    duo = prism_app_with_layouts
    a, b = testutils.create_tabs_for_dnd_test(duo, 2)
    duo.find_element(testutils.tab_trigger(a)).click()
    _press_shortcut(duo, "o")
    duo.wait_for_element(f"{testutils.tab_trigger(a)}[data-locked]", timeout=3)

    duo.find_element(testutils.tab_trigger(b)).click()
    testutils.press_key(duo, Keys.ARROW_LEFT)
    testutils.wait_for_focus(duo, testutils.tab_trigger(a))
    testutils.press_key(duo, Keys.SPACE)

    WebDriverWait(duo.driver, 3).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, testutils.tab_trigger(a)).get_attribute(
            "aria-selected"
        )
        == "true",
        message="Space should select a tab that cannot move",
    )
    assert "Drop target" not in testutils.dnd_announcement(duo)


def test_arrow_keys_skip_a_pinned_panel(prism_app_with_layouts):
    """A mouse cannot drop a tab on a pinned panel, so the arrow keys do not reach it."""
    duo = prism_app_with_layouts
    a, b, c = _open_two_panels(duo)
    _pin_panel_2(duo, c)
    duo.driver.execute_script(_RECORD_ANNOUNCEMENTS)

    duo.find_element(testutils.tab_trigger(a)).click()
    testutils.press_drag_key(duo, Keys.SPACE, "Drop target: position 1 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 1")
    # Panel 2 is out of reach, so no target is in line to the right. The nearest target in
    # that direction is the top edge of panel 1.
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: top edge of panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: right edge of panel 1")
    testutils.press_key(duo, Keys.ARROW_RIGHT)
    testutils.press_drag_key(duo, Keys.ARROW_UP, "Drop target: top edge of panel 1")
    testutils.press_drag_key(duo, Keys.ESCAPE, "You cancelled the drag")

    announcements = duo.driver.execute_script("return window.__dndAnnouncements;")
    assert not [text for text in announcements if "panel 2" in text]
    assert [testutils.get_tab_order_in_panel(duo, i) for i in range(2)] == [[a, b], [c]]


def _pin_panel_2(duo, tab_in_panel_2: str) -> None:
    duo.find_element(testutils.tab_trigger(tab_in_panel_2)).click()
    _press_shortcut(duo, "i")
    # A pinned panel has no add button.
    WebDriverWait(duo.driver, 3).until(
        lambda driver: len(driver.find_elements(By.CSS_SELECTOR, testutils.ADD_TAB_BUTTON)) == 1,
        message="Panel 2 should be pinned",
    )


def test_a_mouse_drop_on_a_tab_of_a_pinned_panel_leaves_the_panel_unchanged(
    prism_app_with_layouts,
):
    """The tabs of a pinned panel are no drop target, so a mouse drop there skips the panel."""
    duo = prism_app_with_layouts
    a, b, c = _open_two_panels(duo)
    panel_2 = testutils.get_panel_id(duo, 1)
    _pin_panel_2(duo, c)

    testutils.start_drag_without_drop(duo, 0)
    ActionChains(duo.driver).move_to_element(duo.find_element(testutils.tab_trigger(c))).perform()
    WebDriverWait(duo.driver, 5).until(
        lambda _: "Drop target" in testutils.dnd_announcement(duo)
        and "position 1 in panel 1" not in testutils.dnd_announcement(duo),
        message="The drag should reach a new drop target",
    )
    assert "panel 2" not in testutils.dnd_announcement(duo)
    ActionChains(duo.driver).release().perform()
    testutils.wait_for_element_invisible(duo, testutils.DROP_ZONE_LEFT)

    panel_ids = [testutils.get_panel_id(duo, i) for i in range(len(testutils.get_panels(duo)))]
    assert testutils.get_tab_order_in_panel(duo, panel_ids.index(panel_2)) == [c]


def test_a_shortcut_cannot_close_the_tab_of_a_keyboard_drag(prism_app_with_layouts):
    """While a tab is picked up, the trigger stops every key, the shortcuts included."""
    duo = prism_app_with_layouts
    a, b, c = testutils.create_tabs_for_dnd_test(duo, 3)

    duo.find_element(testutils.tab_trigger(a)).click()
    testutils.press_drag_key(duo, Keys.SPACE, "Drop target: position 1 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 1")
    modifier = testutils.get_modifier_key()
    ActionChains(duo.driver).key_down(modifier).send_keys("d").key_up(modifier).perform()
    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 2, timeout=1.5)

    testutils.press_drag_key(duo, Keys.ESCAPE, "You cancelled the drag")
    assert testutils.get_tab_order_in_panel(duo, 0) == [a, b, c]


def test_a_tab_that_closes_during_a_mouse_drag_ends_the_drag_cleanly(prism_app_with_layouts):
    """A shortcut from outside the tab can close the dragged tab, and the drag still ends."""
    duo = prism_app_with_layouts
    a, b, c = testutils.create_tabs_for_dnd_test(duo, 3)

    testutils.start_drag_without_drop(duo, 0)
    testutils.wait_for_drop_zones_visible(duo)
    _press_shortcut(duo, "d")
    testutils.wait_for_tab_count(duo, 2)

    testutils.press_drag_key(duo, Keys.ESCAPE, "You cancelled the drag")
    ActionChains(duo.driver).release().perform()
    testutils.wait_for_element_invisible(duo, testutils.DROP_ZONE_LEFT)
    assert testutils.get_tab_order_in_panel(duo, 0) == [b, c]


def test_ctrl_space_on_a_focused_tab_focuses_the_search_and_starts_no_drag(
    prism_app_with_layouts,
):
    """Space with a modifier belongs to a shortcut, so it does not pick up the tab."""
    duo = prism_app_with_layouts
    a, b = testutils.create_tabs_for_dnd_test(duo, 2)
    duo.find_element(testutils.tab_trigger(a)).click()

    ActionChains(duo.driver).key_down(Keys.CONTROL).send_keys(Keys.SPACE).key_up(
        Keys.CONTROL
    ).perform()

    testutils.wait_for_focus(duo, testutils.SEARCHBAR_INPUT)
    assert "Drop target" not in testutils.dnd_announcement(duo)
    assert not testutils.are_drop_zones_present(duo)
