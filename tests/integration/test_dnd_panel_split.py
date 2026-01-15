"""
Tests for panel splitting via drag-to-edge operations.

Panel splitting uses the SPLIT_PANEL action which:
- Creates a container panel
- Keeps original panel ID
- Creates new sibling panel
- Moves tab to new panel

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
    get_panel_id,
    check_browser_errors,
    create_tabs_for_dnd_test,
    drag_tab_to_panel_edge,
    get_tab_order_in_panel,
    wait_for_panel_count,
)

pytestmark = pytest.mark.integration


class TestPanelSplit:
    """Tests for panel splitting in all directions and tab distribution."""

    @pytest.mark.parametrize("edge", ["left", "right", "top", "bottom"])
    def test_split_panel_by_edge(self, prism_app_with_layouts, edge):
        """
        Test splitting panel by dragging tab to each edge.

        Setup: 3 tabs in panel
        Action: Drag tab to specified edge drop zone
        Expected:
        - 2 panels now exist
        - All 3 tabs still present
        - No browser errors
        """
        duo = prism_app_with_layouts

        # Create 3 tabs (need 2+ to enable DnD and allow split)
        create_tabs_for_dnd_test(duo, 3)
        assert len(get_tabs(duo)) == 3, "Should have 3 tabs for DnD test"
        assert len(get_panels(duo)) == 1, "Should start with 1 panel"

        # Drag to specified edge to split
        result = drag_tab_to_panel_edge(duo, 1, edge)
        assert result, f"Drag to {edge} edge should complete"

        # Wait for panel split (10s timeout for reliability)
        wait_for_panel_count(duo, 2, timeout=10.0)

        # Verify 2 panels and 3 tabs
        assert len(get_panels(duo)) == 2, "Should have 2 panels after split"
        assert len(get_tabs(duo)) == 3, "Should still have 3 tabs total"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_split_moves_only_dragged_tab(self, prism_app_with_layouts):
        """
        Test that only the dragged tab moves to the new panel.

        Setup: 3 tabs [A, B, C] in panel
        Action: Drag B to right edge
        Expected: Distribution is [2, 1] or [1, 2] tabs
        """
        duo = prism_app_with_layouts

        tab_ids = create_tabs_for_dnd_test(duo, 3)

        # Drag middle tab to right edge
        drag_tab_to_panel_edge(duo, 1, "right")
        wait_for_panel_count(duo, 2, timeout=10.0)

        # Get tabs in each panel
        panel0_tabs = get_tab_order_in_panel(duo, 0)
        panel1_tabs = get_tab_order_in_panel(duo, 1)

        # Verify all tabs accounted for
        all_panel_tabs = set(panel0_tabs + panel1_tabs)
        assert all_panel_tabs == set(tab_ids), "All tabs should be preserved"

        # One panel should have 1 tab, other should have 2
        tab_counts = sorted([len(panel0_tabs), len(panel1_tabs)])
        assert tab_counts == [1, 2], f"Expected [1, 2] distribution, got {tab_counts}"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_split_preserves_original_panel_id(self, prism_app_with_layouts):
        """
        Test that original panel keeps its ID after split.
        """
        duo = prism_app_with_layouts

        create_tabs_for_dnd_test(duo, 3)
        original_panel_id = get_panel_id(duo, 0)

        drag_tab_to_panel_edge(duo, 1, "right")
        wait_for_panel_count(duo, 2, timeout=10.0)

        # One of the panels should have original ID
        panel_ids = [get_panel_id(duo, 0), get_panel_id(duo, 1)]
        assert original_panel_id in panel_ids, f"Original ID should exist: {panel_ids}"

    def test_two_sequential_splits(self, prism_app_with_layouts):
        """
        Test performing two splits to create 3 panels.

        Workflow:
        1. Start with 4 tabs in 1 panel
        2. Split once -> 2 panels
        3. Split again -> 3 panels
        """
        duo = prism_app_with_layouts

        create_tabs_for_dnd_test(duo, 4)

        # First split
        drag_tab_to_panel_edge(duo, 1, "right")
        wait_for_panel_count(duo, 2, timeout=10.0)
        assert len(get_panels(duo)) == 2, "Should have 2 panels after first split"

        # Second split from first panel
        drag_tab_to_panel_edge(duo, 0, "bottom", source_panel_index=0)
        wait_for_panel_count(duo, 3, timeout=10.0)

        # Verify state
        assert len(get_panels(duo)) >= 2, "Should have at least 2 panels"
        assert len(get_tabs(duo)) == 4, "Should still have 4 tabs"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"
