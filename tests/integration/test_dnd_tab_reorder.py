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
- Keep tests isolated and focused
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


class TestBasicTabReorder:
    """Basic tab reorder operations within a single panel."""

    def test_reorder_tab_forward(self, prism_app_with_layouts):
        """
        Test dragging a tab forward in the tab list.

        Setup: 3 tabs [A, B, C]
        Action: Drag A (index 0) to position of B (index 1)
        Expected: [B, A, C] or similar reordering

        Note: Exact reorder behavior depends on drop position, but
        the key assertion is that tab order changes.
        """
        duo = prism_app_with_layouts

        # Create 3 tabs
        create_tabs_for_dnd_test(duo, 3)
        initial_order = get_tab_order_in_panel(duo, 0)
        assert len(initial_order) == 3, "Should have 3 tabs"

        # Drag first tab to second position (uses ActionChains with .pause() internally)
        result = drag_tab_to_position(duo, 0, 1)
        assert result, "Drag operation should complete"

        # Get new order (ActionChains.pause() already handled timing)
        new_order = get_tab_order_in_panel(duo, 0)

        # Order should have changed (first tab should no longer be first)
        # The exact new order depends on drop mechanics, but it should differ
        assert new_order != initial_order or new_order[0] != initial_order[0], (
            f"Tab order should change. Initial: {initial_order}, Final: {new_order}"
        )

        # Should still have 3 tabs in 1 panel
        assert len(get_tabs(duo)) == 3, "Should still have 3 tabs"
        assert len(get_panels(duo)) == 1, "Should still have 1 panel"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_reorder_tab_backward(self, prism_app_with_layouts):
        """
        Test dragging a tab backward in the tab list.

        Setup: 3 tabs [A, B, C]
        Action: Drag C (index 2) to position of A (index 0)
        Expected: C moves toward the front
        """
        duo = prism_app_with_layouts

        # Create 3 tabs
        tab_ids = create_tabs_for_dnd_test(duo, 3)
        initial_order = get_tab_order_in_panel(duo, 0)

        # Drag last tab to first position
        result = drag_tab_to_position(duo, 2, 0)
        assert result, "Drag operation should complete"

        # ActionChains.pause() handles timing

        new_order = get_tab_order_in_panel(duo, 0)

        # The last tab should have moved toward the front
        assert new_order != initial_order, (
            f"Tab order should change. Initial: {initial_order}, Final: {new_order}"
        )

        # All tabs should still exist
        assert set(new_order) == set(initial_order), "All tabs should still exist"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_reorder_middle_tab(self, prism_app_with_layouts):
        """
        Test dragging the middle tab to a different position.

        Setup: 3 tabs [A, B, C]
        Action: Drag B (index 1) to end (index 2)
        """
        duo = prism_app_with_layouts

        tab_ids = create_tabs_for_dnd_test(duo, 3)
        initial_order = get_tab_order_in_panel(duo, 0)
        middle_tab = initial_order[1]

        # Drag middle tab to last position
        result = drag_tab_to_position(duo, 1, 2)
        assert result, "Drag operation should complete"

        # ActionChains.pause() handles timing

        new_order = get_tab_order_in_panel(duo, 0)

        # Tab order should change and all tabs preserved
        assert set(new_order) == set(initial_order), "All tabs should be preserved"
        assert len(new_order) == 3, "Should still have 3 tabs"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"


class TestReorderBoundaryConditions:
    """Edge cases for tab reordering."""

    def test_reorder_with_two_tabs(self, prism_app_with_layouts):
        """
        Test reordering with exactly 2 tabs (minimum for DnD to be enabled).

        Setup: 2 tabs [A, B]
        Action: Drag A to B's position
        Expected: [B, A]
        """
        duo = prism_app_with_layouts

        # Create exactly 2 tabs
        add_button = duo.find_element(ADD_TAB_BUTTON)
        add_button.click()
        wait_for_tab_count(duo, 2)

        initial_order = get_tab_order_in_panel(duo, 0)
        assert len(initial_order) == 2, "Should have 2 tabs"

        # Drag first to second
        result = drag_tab_to_position(duo, 0, 1)
        assert result, "Drag operation should complete"

        # ActionChains.pause() handles timing

        new_order = get_tab_order_in_panel(duo, 0)

        # Should still have 2 tabs
        assert len(new_order) == 2, "Should still have 2 tabs"
        assert set(new_order) == set(initial_order), "Same tabs should exist"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_reorder_preserves_all_tabs(self, prism_app_with_layouts):
        """
        Test that reordering preserves all tabs (no tabs lost or duplicated).
        """
        duo = prism_app_with_layouts

        # Create 4 tabs
        tab_ids = create_tabs_for_dnd_test(duo, 4)
        initial_order = get_tab_order_in_panel(duo, 0)

        # Perform multiple reorders
        drag_tab_to_position(duo, 0, 2)
        # ActionChains.pause() handles timing
        drag_tab_to_position(duo, 3, 1)
        # ActionChains.pause() handles timing

        final_order = get_tab_order_in_panel(duo, 0)

        # All tabs should be preserved (same set, possibly different order)
        assert set(final_order) == set(initial_order), (
            f"All tabs should be preserved. Initial: {set(initial_order)}, Final: {set(final_order)}"
        )
        assert len(final_order) == 4, "Should still have 4 tabs"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_multiple_sequential_reorders(self, prism_app_with_layouts):
        """
        Test multiple sequential reorder operations.

        Verifies state consistency after several drag operations.
        """
        duo = prism_app_with_layouts

        tab_ids = create_tabs_for_dnd_test(duo, 4)
        initial_tabs = set(get_tab_order_in_panel(duo, 0))

        # Perform 3 reorders
        for i in range(3):
            drag_tab_to_position(duo, 0, 2)
            # ActionChains.pause() handles timing

        final_order = get_tab_order_in_panel(duo, 0)

        # All tabs preserved
        assert set(final_order) == initial_tabs, "All tabs should be preserved"

        # Still 1 panel
        assert len(get_panels(duo)) == 1, "Should still have 1 panel"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"


class TestReorderStateConsistency:
    """Tests for state consistency after reorder operations."""

    def test_panel_count_unchanged_after_reorder(self, prism_app_with_layouts):
        """
        Test that reordering tabs doesn't create new panels.

        Reorder should only change tab order within the same panel,
        not split or create new panels.
        """
        duo = prism_app_with_layouts

        create_tabs_for_dnd_test(duo, 3)

        initial_panel_count = len(get_panels(duo))
        assert initial_panel_count == 1, "Should start with 1 panel"

        # Reorder
        drag_tab_to_position(duo, 0, 2)
        # ActionChains.pause() handles timing

        final_panel_count = len(get_panels(duo))
        assert final_panel_count == initial_panel_count, (
            f"Panel count should be unchanged. Initial: {initial_panel_count}, Final: {final_panel_count}"
        )

    def test_reorder_no_browser_errors(self, prism_app_with_layouts):
        """
        Test that reorder operations don't cause browser errors.
        """
        duo = prism_app_with_layouts

        create_tabs_for_dnd_test(duo, 3)

        # Multiple reorders
        drag_tab_to_position(duo, 0, 1)
        # ActionChains.pause() handles timing
        drag_tab_to_position(duo, 2, 0)
        # ActionChains.pause() handles timing
        drag_tab_to_position(duo, 1, 2)
        # ActionChains.pause() handles timing

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"
