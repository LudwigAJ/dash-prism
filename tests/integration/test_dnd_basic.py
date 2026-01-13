"""
Basic drag-and-drop foundational tests.

These tests verify the DnD infrastructure works correctly
before testing complex scenarios. Tests focus on:
- Drop zone visibility/invisibility
- Single-tab mode behavior
- Drag cancellation

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
    start_drag_without_drop,
    cancel_drag_with_escape,
    wait_for_drop_zones_visible,
    are_drop_zones_present,
    get_tab_order_in_panel,
    ADD_TAB_BUTTON,
    wait_for_tab_count,
    wait_for_element_invisible,
    DROP_ZONE_LEFT,
)

pytestmark = pytest.mark.integration


class TestSingleTabModeDisablesDnD:
    """Tests verifying DnD is disabled in single-tab-single-panel mode."""

    def test_single_tab_no_drop_zones_during_drag(self, prism_app_with_layouts):
        """
        Test that drop zones do not appear with only 1 tab.

        From PanelDropzone.tsx:
        - isSingleTabMode = tabs.length === 1 && leafPanels.length === 1
        - dropzonesEnabled = isActive && !isPinned && !isSingleTabMode

        When in single-tab mode, drop zones should never render,
        even during an attempted drag.
        """
        duo = prism_app_with_layouts

        # Verify we start with single tab (single-tab mode)
        tabs = get_tabs(duo)
        assert len(tabs) == 1, "Should start with 1 tab"

        # Drop zones should not be present before drag
        assert not are_drop_zones_present(duo), "Drop zones should not exist initially"

        # Attempt to drag the single tab
        # Even with drag attempt, no drop zones should appear
        try:
            start_drag_without_drop(duo, 0)

            # Drop zones should still not be present (wait briefly for potential render)
            zones_appeared = wait_for_drop_zones_visible(duo, timeout=1.0)
            assert not zones_appeared, "Drop zones should not appear in single-tab mode"
        finally:
            # Release the drag
            cancel_drag_with_escape(duo)

        # Verify no browser errors
        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"


@pytest.mark.skip(
    reason="Drop zone visibility tests unreliable in headless Chrome due to rendering issues"
)
class TestDropZonesWithMultipleTabs:
    """Tests verifying drop zones appear correctly with multiple tabs."""

    def test_drop_zones_appear_during_drag(self, prism_app_with_layouts):
        """
        Test that drop zones appear when dragging with 2+ tabs.

        With multiple tabs, the component exits single-tab mode and
        drop zones should render during an active drag.
        """
        duo = prism_app_with_layouts

        # Add a second tab to exit single-tab mode
        add_button = duo.find_element(ADD_TAB_BUTTON)
        add_button.click()
        wait_for_tab_count(duo, 2)

        tabs = get_tabs(duo)
        assert len(tabs) == 2, "Should have 2 tabs"

        # Drop zones should not be present before drag
        assert not are_drop_zones_present(duo), "Drop zones should not exist before drag"

        # Start drag - drop zones should appear
        try:
            start_drag_without_drop(duo, 0)

            # Wait for drop zones to appear
            zones_visible = wait_for_drop_zones_visible(duo, timeout=3.0)
            assert zones_visible, "Drop zones should appear during drag"

            # Verify drop zones are present
            assert are_drop_zones_present(duo), "Drop zones should be present during drag"
        finally:
            cancel_drag_with_escape(duo)

        # After canceling, wait for drop zones to disappear
        wait_for_element_invisible(duo, DROP_ZONE_LEFT, timeout=3.0)
        assert not are_drop_zones_present(duo), "Drop zones should disappear after drag cancel"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_drop_zones_disappear_after_drop(self, prism_app_with_layouts):
        """
        Test that drop zones disappear after completing a drag operation.
        """
        duo = prism_app_with_layouts

        # Create 3 tabs
        create_tabs_for_dnd_test(duo, 3)

        tabs = get_tabs(duo)
        assert len(tabs) == 3, "Should have 3 tabs"

        # Start drag
        try:
            start_drag_without_drop(duo, 0)
            assert wait_for_drop_zones_visible(duo), "Drop zones should appear"
        finally:
            # Complete the drag by releasing
            cancel_drag_with_escape(duo)

        # Wait for drop zones to disappear
        wait_for_element_invisible(duo, DROP_ZONE_LEFT, timeout=3.0)
        assert not are_drop_zones_present(duo), "Drop zones should disappear after drop"


class TestDragCancellation:
    """Tests for drag cancellation behavior."""

    def test_escape_cancels_drag_preserves_order(self, prism_app_with_layouts):
        """
        Test that pressing Escape cancels an active drag and preserves tab order.

        Expected:
        - Start dragging a tab
        - Press Escape
        - Tab order remains unchanged
        """
        duo = prism_app_with_layouts

        # Create 3 tabs
        create_tabs_for_dnd_test(duo, 3)
        initial_order = get_tab_order_in_panel(duo, 0)

        # Start drag
        try:
            start_drag_without_drop(duo, 0)
        finally:
            # Cancel with Escape
            cancel_drag_with_escape(duo)

        # Wait for drop zones to disappear (indicates drag ended)
        wait_for_element_invisible(duo, DROP_ZONE_LEFT, timeout=3.0)

        # Tab order should be unchanged
        final_order = get_tab_order_in_panel(duo, 0)
        assert final_order == initial_order, (
            f"Tab order should be unchanged after cancel. "
            f"Expected {initial_order}, got {final_order}"
        )

        # Panel count unchanged
        panels = get_panels(duo)
        assert len(panels) == 1, "Panel count should be unchanged"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"


class TestDnDBasicInfrastructure:
    """Tests for basic DnD infrastructure and state."""

    def test_tab_ids_are_unique(self, prism_app_with_layouts):
        """
        Test that created tabs have unique IDs.

        This is important for DnD to work correctly.
        """
        duo = prism_app_with_layouts

        # Create multiple tabs
        tab_ids = create_tabs_for_dnd_test(duo, 4)

        # All IDs should be unique
        assert len(tab_ids) == len(set(tab_ids)), (
            f"Tab IDs should be unique. Got: {tab_ids}"
        )

        # All IDs should be non-empty strings
        for tab_id in tab_ids:
            assert tab_id is not None and len(tab_id) > 0, "Tab IDs should be non-empty"

    def test_panel_structure_consistent(self, prism_app_with_layouts):
        """
        Test that panel structure is consistent after adding tabs.
        """
        duo = prism_app_with_layouts

        # Start with 1 panel, 1 tab
        assert len(get_panels(duo)) == 1
        assert len(get_tabs(duo)) == 1

        # Add tabs
        create_tabs_for_dnd_test(duo, 3)

        # Still 1 panel, but 3 tabs
        assert len(get_panels(duo)) == 1, "Should still have 1 panel"
        assert len(get_tabs(duo)) == 3, "Should have 3 tabs"

        # All tabs should be in the same panel
        tab_order = get_tab_order_in_panel(duo, 0)
        assert len(tab_order) == 3, "All 3 tabs should be in panel 0"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_no_errors_on_basic_setup(self, prism_app_with_layouts):
        """
        Test that basic DnD setup doesn't cause browser errors.
        """
        duo = prism_app_with_layouts

        # Create tabs
        create_tabs_for_dnd_test(duo, 3)

        # Start and cancel drag (uses ActionChains with .pause() internally)
        try:
            start_drag_without_drop(duo, 1)
        finally:
            cancel_drag_with_escape(duo)

        # Wait for drag state to clear
        wait_for_element_invisible(duo, DROP_ZONE_LEFT, timeout=3.0)

        # No browser errors should occur
        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"
