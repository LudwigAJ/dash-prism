"""
Integration tests for panel operations.

Tests basic panel interactions. Complex panel split operations
are skipped as they require more advanced drag-and-drop setup.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest

from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    PANEL_SELECTOR,
    wait_for_tab_count,
    get_tabs,
    get_panels,
    check_browser_errors,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def test_initial_panel_exists(prism_app_with_layouts):
    """Test that Prism starts with one panel."""
    duo = prism_app_with_layouts

    # Prism should start with exactly 1 panel
    panels = get_panels(duo)
    assert len(panels) == 1, "Should start with 1 panel"

    # The panel should contain the initial tab
    tabs = get_tabs(duo)
    assert len(tabs) == 1, "Panel should have 1 tab"


def test_panel_contains_tab(prism_app_with_layouts):
    """Test that tabs are contained within panels."""
    duo = prism_app_with_layouts

    # Get the panel
    panel = duo.find_element(PANEL_SELECTOR)
    assert panel is not None, "Panel should exist"

    # Find tab within panel
    tab_in_panel = panel.find_elements("css selector", TAB_SELECTOR)
    assert len(tab_in_panel) == 1, "Panel should contain 1 tab"


def test_multiple_tabs_in_single_panel(prism_app_with_layouts):
    """Test adding multiple tabs to the same panel."""
    duo = prism_app_with_layouts

    # Add 2 more tabs
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    add_button.click()
    wait_for_tab_count(duo, 3)

    # Should still have 1 panel
    panels = get_panels(duo)
    assert len(panels) == 1, "Should still have 1 panel"

    # Panel should have 3 tabs
    panel = panels[0]
    tabs_in_panel = panel.find_elements("css selector", TAB_SELECTOR)
    assert len(tabs_in_panel) == 3, "Panel should contain 3 tabs"


def test_no_browser_errors_with_panels(prism_app_with_layouts):
    """Test that panel operations don't cause browser errors."""
    duo = prism_app_with_layouts

    # Perform some operations
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    # Check no browser errors
    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"


# Note: Panel split tests via drag-and-drop have been moved to test_dnd_panel_split.py
# which contains comprehensive DnD tests with proper ActionChains handling.
