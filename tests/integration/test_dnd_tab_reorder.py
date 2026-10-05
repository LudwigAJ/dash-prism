"""Tests for tab reordering within the same panel.

Tab reordering uses the REORDER_TAB action and operates on panelTabs array.
These tests verify that tabs can be dragged to new positions within
the same panel without creating new panels.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration


def _moved(order: list[str], source_idx: int, target_idx: int) -> list[str]:
    """Return ``order`` with the tab at ``source_idx`` moved to ``target_idx``."""
    moved = list(order)
    moved.insert(target_idx, moved.pop(source_idx))
    return moved


def _keyboard_move_right(duo, tab_ids: list[str]) -> None:
    """Move the first tab one place to the right with the keyboard drag."""
    duo.find_element(testutils.tab_trigger(tab_ids[0])).click()
    testutils.press_drag_key(duo, Keys.SPACE, "Drop target: position 1 in panel 1")
    testutils.press_drag_key(duo, Keys.ARROW_RIGHT, "Drop target: position 2 in panel 1")
    testutils.press_drag_key(duo, Keys.ENTER, "You dropped tab")


class TestTabReorder:
    """Tests for tab reorder operations within a single panel."""

    @pytest.mark.parametrize(
        "source_idx,target_idx",
        [
            (0, 1),  # Drag first tab forward
            (2, 0),  # Drag last tab backward
            (1, 2),  # Drag middle tab to end
        ],
    )
    def test_reorder_tab_positions(self, prism_app_with_layouts, source_idx, target_idx):
        """Test dragging tabs to different positions within the panel.

        Verifies:
        - Tab order changes
        - All tabs preserved
        - Still 1 panel
        """
        duo = prism_app_with_layouts

        testutils.create_tabs_for_dnd_test(duo, 3)
        initial_order = testutils.get_tab_order_in_panel(duo, 0)

        testutils.drag_tab_to_position(duo, source_idx, target_idx)

        assert testutils.get_tab_order_in_panel(duo, 0) == _moved(
            initial_order, source_idx, target_idx
        )
        assert len(testutils.get_panels(duo)) == 1, "Still 1 panel"

    def test_keyboard_reorder_from_the_tab_trigger(self, prism_app_with_layouts):
        """Space on a focused tab picks it up, an arrow key moves it, and Enter drops it."""
        duo = prism_app_with_layouts
        initial_order = testutils.create_tabs_for_dnd_test(duo, 3)

        _keyboard_move_right(duo, initial_order)

        WebDriverWait(duo.driver, 5).until(
            lambda _: testutils.get_tab_order_in_panel(duo, 0) == _moved(initial_order, 0, 1),
            message="The keyboard drag should move the first tab one place to the right",
        )

    def test_keyboard_drop_returns_the_focus_to_the_tab(self, prism_app_with_layouts):
        """The tab trigger is the drag activator, so the focus comes back to it after the drop."""
        duo = prism_app_with_layouts
        initial_order = testutils.create_tabs_for_dnd_test(duo, 3)

        _keyboard_move_right(duo, initial_order)

        testutils.wait_for_focus(duo, testutils.tab_trigger(initial_order[0]))

    def test_reorder_with_two_tabs(self, prism_app_with_layouts):
        """Test reordering with exactly 2 tabs (minimum for DnD)."""
        duo = prism_app_with_layouts

        duo.find_element(testutils.ADD_TAB_BUTTON).click()
        testutils.wait_for_tab_count(duo, 2, timeout=10.0)

        initial_order = testutils.get_tab_order_in_panel(duo, 0)

        testutils.drag_tab_to_position(duo, 0, 1)

        assert testutils.get_tab_order_in_panel(duo, 0) == initial_order[::-1]

    def test_multiple_sequential_reorders(self, prism_app_with_layouts):
        """Test multiple sequential reorder operations preserve state."""
        duo = prism_app_with_layouts

        expected = testutils.create_tabs_for_dnd_test(duo, 4)

        for source_idx, target_idx in [(0, 2), (3, 1), (1, 3)]:
            testutils.drag_tab_to_position(duo, source_idx, target_idx)
            expected = _moved(expected, source_idx, target_idx)
            assert testutils.get_tab_order_in_panel(duo, 0) == expected

        assert len(testutils.get_panels(duo)) == 1, "Still 1 panel"
