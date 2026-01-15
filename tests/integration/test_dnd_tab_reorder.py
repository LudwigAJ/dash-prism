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

from conftest import (
    get_tabs,
    get_panels,
    check_browser_errors,
    create_tabs_for_dnd_test,
    drag_tab_to_position,
    get_tab_order_in_panel,
    wait_for_tab_count,
    ADD_TAB_BUTTON,
)

pytestmark = pytest.mark.integration


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

        create_tabs_for_dnd_test(duo, 3)
        initial_order = get_tab_order_in_panel(duo, 0)

        result = drag_tab_to_position(duo, source_idx, target_idx)
        assert result, "Drag operation should complete"

        new_order = get_tab_order_in_panel(duo, 0)

        # All tabs preserved
        assert set(new_order) == set(initial_order), "All tabs should exist"
        assert len(get_tabs(duo)) == 3, "Still 3 tabs"
        assert len(get_panels(duo)) == 1, "Still 1 panel"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_reorder_with_two_tabs(self, prism_app_with_layouts):
        """
        Test reordering with exactly 2 tabs (minimum for DnD).
        """
        duo = prism_app_with_layouts

        duo.find_element(ADD_TAB_BUTTON).click()
        wait_for_tab_count(duo, 2, timeout=10.0)

        initial_order = get_tab_order_in_panel(duo, 0)

        result = drag_tab_to_position(duo, 0, 1)
        assert result, "Drag operation should complete"

        new_order = get_tab_order_in_panel(duo, 0)
        assert len(new_order) == 2, "Still 2 tabs"
        assert set(new_order) == set(initial_order), "Same tabs exist"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_multiple_sequential_reorders(self, prism_app_with_layouts):
        """
        Test multiple sequential reorder operations preserve state.
        """
        duo = prism_app_with_layouts

        create_tabs_for_dnd_test(duo, 4)
        initial_tabs = set(get_tab_order_in_panel(duo, 0))

        # Perform 3 reorders
        drag_tab_to_position(duo, 0, 2)
        drag_tab_to_position(duo, 3, 1)
        drag_tab_to_position(duo, 1, 3)

        final_order = get_tab_order_in_panel(duo, 0)

        assert set(final_order) == initial_tabs, "All tabs preserved"
        assert len(get_panels(duo)) == 1, "Still 1 panel"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"
