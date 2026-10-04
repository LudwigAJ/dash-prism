"""
Tests for tab reordering within the same panel.

Tab reordering uses the REORDER_TAB action and operates on panelTabs array.
These tests verify that tabs can be dragged to new positions within
the same panel without creating new panels.

Best Practices Applied (per DASH_TESTING_GUIDELINES.md):
- Use explicit waits (dash_duo.wait_for_*) instead of time.sleep()
- Use ActionChains chaining with .pause() for DnD operations
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
"""

from __future__ import annotations

import pytest

from tests.integration import testutils

pytestmark = pytest.mark.integration


def _moved(order: list[str], source_idx: int, target_idx: int) -> list[str]:
    """Return ``order`` with the tab at ``source_idx`` moved to ``target_idx``."""
    moved = list(order)
    moved.insert(target_idx, moved.pop(source_idx))
    return moved


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
        """
        Test dragging tabs to different positions within the panel.

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

    def test_reorder_with_two_tabs(self, prism_app_with_layouts):
        """
        Test reordering with exactly 2 tabs (minimum for DnD).
        """
        duo = prism_app_with_layouts

        duo.find_element(testutils.ADD_TAB_BUTTON).click()
        testutils.wait_for_tab_count(duo, 2, timeout=10.0)

        initial_order = testutils.get_tab_order_in_panel(duo, 0)

        testutils.drag_tab_to_position(duo, 0, 1)

        assert testutils.get_tab_order_in_panel(duo, 0) == initial_order[::-1]

    def test_multiple_sequential_reorders(self, prism_app_with_layouts):
        """
        Test multiple sequential reorder operations preserve state.
        """
        duo = prism_app_with_layouts

        expected = testutils.create_tabs_for_dnd_test(duo, 4)

        for source_idx, target_idx in [(0, 2), (3, 1), (1, 3)]:
            testutils.drag_tab_to_position(duo, source_idx, target_idx)
            expected = _moved(expected, source_idx, target_idx)
            assert testutils.get_tab_order_in_panel(duo, 0) == expected

        assert len(testutils.get_panels(duo)) == 1, "Still 1 panel"
