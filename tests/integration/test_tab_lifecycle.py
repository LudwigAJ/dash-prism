"""
Integration tests for tab lifecycle operations.

Tests tab creation, closing, renaming, and other tab management operations
using browser automation via dash[testing].

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest

# Import helpers from conftest
from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    wait_for_tab_count,
    get_tabs,
    get_tab_id,
    check_browser_errors,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def test_create_new_tab(prism_app_with_layouts):
    """Test creating a new tab via the add button."""
    duo = prism_app_with_layouts

    # Prism always starts with 1 initial tab (showing NewLayout)
    initial_tabs = get_tabs(duo)
    assert len(initial_tabs) == 1, "Should start with 1 initial tab"

    # Click the add tab button
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()

    # Wait for new tab to appear (explicit wait, not sleep)
    wait_for_tab_count(duo, 2)

    # Verify two tabs now exist
    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Should have 2 tabs after clicking add"

    # Best practice: check for browser errors
    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"


def test_close_tab(prism_app_with_layouts):
    """Test closing a tab via the close button."""
    duo = prism_app_with_layouts

    # Create a second tab (Prism starts with 1)
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Should have 2 tabs"

    # Get the second tab's ID
    tab_id = get_tab_id(duo, 1)
    assert tab_id is not None, "Tab ID should not be None"

    # Hover over tab to reveal close button (it's hidden until hover)
    tab = tabs[1]
    duo.driver.execute_script(
        "arguments[0].dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}))", tab
    )

    # Find and click the close button
    close_selector = f"[data-testid='prism-tab-close-{tab_id}']"
    duo.wait_for_element(close_selector, timeout=2)
    close_button = duo.find_element(close_selector)
    close_button.click()

    # Wait for tab to be removed (explicit wait)
    wait_for_tab_count(duo, 1)

    # Verify tab was removed
    tabs_after = get_tabs(duo)
    assert len(tabs_after) == 1, "Should have 1 tab remaining after closing"


def test_create_multiple_tabs(prism_app_with_layouts):
    """Test creating multiple tabs."""
    duo = prism_app_with_layouts

    # Start with 1 initial tab, create 2 more for total of 3
    add_button = duo.find_element(ADD_TAB_BUTTON)

    add_button.click()
    wait_for_tab_count(duo, 2)

    add_button.click()
    wait_for_tab_count(duo, 3)

    # Verify 3 tabs exist
    tabs = get_tabs(duo)
    assert len(tabs) == 3, "Should have 3 tabs"


def test_max_tabs_limit(prism_app_with_layouts):
    """Test that maxTabs limit is enforced."""
    duo = prism_app_with_layouts

    # App is configured with maxTabs=10, start with 1 initial tab
    # Create 9 more tabs (1 initial + 9 = 10 total)
    for i in range(9):
        # Re-fetch button each iteration to avoid stale element
        add_button = duo.find_element(ADD_TAB_BUTTON)
        # Use JavaScript click for reliability
        duo.driver.execute_script("arguments[0].click();", add_button)
        wait_for_tab_count(duo, i + 2)

    tabs = get_tabs(duo)
    assert len(tabs) == 10, "Should have 10 tabs (the max)"

    # Re-fetch button and verify it's disabled at max tabs
    add_button = duo.find_element(ADD_TAB_BUTTON)
    is_disabled = add_button.get_attribute("disabled")
    assert is_disabled is not None, "Add button should be disabled at max tabs"


def test_tab_selection(prism_app_with_layouts):
    """Test switching between tabs."""
    duo = prism_app_with_layouts

    # Create 1 more tab (1 initial + 1 = 2 total)
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Should have 2 tabs"

    # Click first tab
    tabs[0].click()

    # Click second tab
    # Re-fetch to avoid stale element after first click
    tabs = get_tabs(duo)
    tabs[1].click()

    # Both clicks should complete without error
    # Verify we still have 2 tabs (no side effects)
    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Should still have 2 tabs after switching"


def test_tab_persists_after_creation(prism_app_with_layouts):
    """
    Test that a newly created tab persists after Redux sync cycles.

    This is a regression test for an issue where tabs would appear briefly
    and then disappear due to a race condition in the Redux/Dash sync:
    1. Tab is created in Redux state
    2. dashSyncMiddleware syncs state to Dash via setProps
    3. If setProps caused store recreation, the tab would be lost

    The fix ensures the store is stable and tabs persist.
    """
    import time

    duo = prism_app_with_layouts

    # Start with 1 initial tab
    initial_tabs = get_tabs(duo)
    assert len(initial_tabs) == 1, "Should start with 1 initial tab"

    # Click the add tab button (single click should work)
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()

    # Wait for the new tab to appear
    wait_for_tab_count(duo, 2)

    # Critical: Wait for Redux sync cycle to complete
    # The dashSyncMiddleware has a 500ms debounce, so we wait longer
    # to ensure any potential state overwrites would have occurred
    time.sleep(1.5)

    # Verify the tab is STILL there after the sync cycle
    tabs_after_sync = get_tabs(duo)
    assert len(tabs_after_sync) == 2, (
        f"Tab should persist after Redux sync cycle. "
        f"Expected 2 tabs, found {len(tabs_after_sync)}. "
        "This may indicate a state synchronization regression."
    )

    # Add another tab to verify continued functionality
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 3)

    # Wait again for sync
    time.sleep(1.5)

    # Verify both new tabs persist
    final_tabs = get_tabs(duo)
    assert (
        len(final_tabs) == 3
    ), f"Both new tabs should persist. Expected 3 tabs, found {len(final_tabs)}."

    # Verify no browser errors occurred
    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"
