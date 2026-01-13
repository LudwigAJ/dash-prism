"""
Integration tests for keyboard shortcuts.

Tests Cmd/Ctrl+N (new tab), Cmd/Ctrl+D (close tab).

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Keep tests isolated and focused
"""

from __future__ import annotations

import platform
import pytest
from selenium.webdriver.common.keys import Keys

from conftest import (
    TAB_SELECTOR,
    ADD_TAB_BUTTON,
    wait_for_tab_count,
    get_tabs,
    check_browser_errors,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def get_modifier_key():
    """Get the correct modifier key for the current platform."""
    return Keys.COMMAND if platform.system() == "Darwin" else Keys.CONTROL


def test_keyboard_shortcut_new_tab(prism_app_with_layouts):
    """Test Cmd/Ctrl+N creates new tab."""
    duo = prism_app_with_layouts

    # Prism starts with 1 initial tab
    initial_tabs = get_tabs(duo)
    assert len(initial_tabs) == 1, "Should start with 1 initial tab"

    # Press Cmd+N (Mac) or Ctrl+N (Windows/Linux)
    modifier = get_modifier_key()
    body = duo.find_element("body")
    body.send_keys(modifier, "n")

    # Wait for new tab to appear (explicit wait)
    wait_for_tab_count(duo, 2, timeout=5)

    # Verify tab created
    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Cmd/Ctrl+N should create new tab"


def test_keyboard_shortcut_close_tab(prism_app_with_layouts):
    """Test Cmd/Ctrl+D closes active tab when multiple tabs exist."""
    duo = prism_app_with_layouts

    # Create 1 more tab (1 initial + 1 = 2 total)
    add_button = duo.find_element(ADD_TAB_BUTTON)
    add_button.click()
    wait_for_tab_count(duo, 2)

    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Should have 2 tabs"

    # Press Cmd+D to close active tab
    modifier = get_modifier_key()
    body = duo.find_element("body")
    body.send_keys(modifier, "d")

    # Wait for tab to close (explicit wait)
    wait_for_tab_count(duo, 1, timeout=5)

    # Verify one tab closed
    tabs_after = get_tabs(duo)
    assert len(tabs_after) == 1, "Cmd/Ctrl+D should close active tab"


def test_keyboard_new_tab_no_errors(prism_app_with_layouts):
    """Test that keyboard shortcuts don't cause browser errors."""
    duo = prism_app_with_layouts

    # Create tab with keyboard
    modifier = get_modifier_key()
    body = duo.find_element("body")
    body.send_keys(modifier, "n")

    wait_for_tab_count(duo, 2)

    # Check no browser errors
    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"No browser errors expected: {errors}"
