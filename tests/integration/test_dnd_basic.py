"""
Basic drag-and-drop infrastructure tests.

These tests verify the DnD infrastructure works correctly:
- Drop zone visibility in single-tab vs multi-tab mode
- Drag cancellation behavior

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


class TestDropZoneBehavior:
    """Tests for drop zone visibility based on tab count."""

    def test_single_tab_no_drop_zones(self, prism_app_with_layouts):
        """
        Test that drop zones do not appear with only 1 tab (single-tab mode).

        Drop zones are disabled when isSingleTabMode = true.
        """
        duo = prism_app_with_layouts

        # Verify single tab mode
        assert len(get_tabs(duo)) == 1, "Should start with 1 tab"
        assert not are_drop_zones_present(duo), "No drop zones in single-tab mode"

        # Even during drag attempt, no drop zones
        try:
            start_drag_without_drop(duo, 0)
            zones_appeared = wait_for_drop_zones_visible(duo, timeout=2.0)
            assert not zones_appeared, "Drop zones should not appear in single-tab mode"
        finally:
            cancel_drag_with_escape(duo)

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"

    def test_multi_tab_drop_zones_appear(self, prism_app_with_layouts):
        """
        Test that drop zones appear during drag with 2+ tabs.
        """
        duo = prism_app_with_layouts

        # Add second tab to exit single-tab mode
        duo.find_element(ADD_TAB_BUTTON).click()
        wait_for_tab_count(duo, 2, timeout=10.0)

        assert not are_drop_zones_present(duo), "No drop zones before drag"

        try:
            start_drag_without_drop(duo, 0)
            assert wait_for_drop_zones_visible(duo, timeout=5.0), "Drop zones should appear"
        finally:
            cancel_drag_with_escape(duo)

        # Drop zones disappear after cancel
        wait_for_element_invisible(duo, DROP_ZONE_LEFT, timeout=5.0)
        assert not are_drop_zones_present(duo), "Drop zones should disappear"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"


class TestDragCancellation:
    """Tests for drag cancellation behavior."""

    def test_escape_cancels_drag_preserves_order(self, prism_app_with_layouts):
        """
        Test that pressing Escape cancels drag and preserves tab order.
        """
        duo = prism_app_with_layouts

        create_tabs_for_dnd_test(duo, 3)
        initial_order = get_tab_order_in_panel(duo, 0)

        try:
            start_drag_without_drop(duo, 0)
        finally:
            cancel_drag_with_escape(duo)

        wait_for_element_invisible(duo, DROP_ZONE_LEFT, timeout=5.0)

        # Tab order unchanged
        final_order = get_tab_order_in_panel(duo, 0)
        assert final_order == initial_order, "Order should be unchanged after cancel"
        assert len(get_panels(duo)) == 1, "Panel count unchanged"

        errors = check_browser_errors(duo)
        assert len(errors) == 0, f"No browser errors expected: {errors}"
