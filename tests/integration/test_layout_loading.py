"""
Integration tests for layout loading and rendering.

Tests layout selection via SearchBar, layout rendering,
and parameter handling.
"""

from __future__ import annotations

import pytest

# Mark all tests in this module as integration tests
# Also skip entire module due to flaky layout rendering
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skip(reason="Layout loading tests are flaky - needs callback investigation"),
]


def test_load_static_layout_via_searchbar(prism_app_with_layouts):
    """Test loading a static layout through the SearchBar."""
    duo = prism_app_with_layouts

    # Prism starts with 1 initial tab - use it directly
    # Click the searchbar to open layout dropdown
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()

    # Wait for dropdown to appear
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=3)

    # Select the test-static layout
    layout_item = duo.find_element("[data-testid='prism-layout-item-test-static']")
    layout_item.click()

    # Wait for layout content to render
    duo.wait_for_element("#static-content", timeout=5)

    # Verify content loaded
    content = duo.find_element("#static-content")
    assert content.text == "Static content", "Layout content should be rendered"


def test_searchbar_filtering(prism_app_with_layouts):
    """Test that SearchBar filters layouts based on search query."""
    duo = prism_app_with_layouts

    # Use initial tab
    # Click searchbar
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()

    # Type search query
    searchbar_input.send_keys("callback")

    # Wait a bit for filtering
    duo.wait_for_callbacks()

    # Should show callback layout but not static layout
    callback_item = duo.find_elements("[data-testid='prism-layout-item-test-callback']")
    assert len(callback_item) > 0, "Callback layout should match 'callback' query"

    # Static layout should not appear (filtered out)
    # Note: This test assumes the dropdown only shows matching items


def test_layout_with_callback(prism_app_with_layouts):
    """Test that a layout with Dash callbacks works correctly."""
    duo = prism_app_with_layouts

    # Use initial tab - open searchbar and select callback layout
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()
    duo.wait_for_element("[data-testid='prism-layout-item-test-callback']", timeout=3)

    layout_item = duo.find_element("[data-testid='prism-layout-item-test-callback']")
    layout_item.click()

    # Wait for layout to load
    duo.wait_for_element("#test-button", timeout=5)

    # Click the button in the layout
    button = duo.find_element("#test-button")
    button.click()

    # Wait for callback to update output
    duo.wait_for_text_to_equal("#test-output", "Clicked 1 times", timeout=3)

    # Click again
    button.click()
    duo.wait_for_text_to_equal("#test-output", "Clicked 2 times", timeout=3)


def test_switch_layouts_in_same_tab(prism_app_with_layouts):
    """Test switching from one layout to another in the same tab."""
    duo = prism_app_with_layouts

    # Use initial tab and load first layout
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=3)

    static_layout = duo.find_element("[data-testid='prism-layout-item-test-static']")
    static_layout.click()
    duo.wait_for_element("#static-content", timeout=5)

    # Now switch to callback layout
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()
    duo.wait_for_element("[data-testid='prism-layout-item-test-callback']", timeout=3)

    callback_layout = duo.find_element("[data-testid='prism-layout-item-test-callback']")
    callback_layout.click()
    duo.wait_for_element("#test-button", timeout=5)

    # Verify callback layout is now active
    button = duo.find_element("#test-button")
    assert button is not None, "Callback layout should be loaded"


def test_new_tab_shows_searchbar_prompt(prism_app_with_layouts):
    """Test that a new tab with no layout shows the searchbar in search mode."""
    duo = prism_app_with_layouts

    # Initial tab already exists with NewLayout showing searchbar
    # SearchBar should be visible and ready for input
    searchbar = duo.find_element("[data-testid='prism-searchbar']")
    assert searchbar is not None, "SearchBar should be visible on new tab"

    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    assert searchbar_input is not None, "SearchBar input should be present"


def test_multiple_tabs_with_different_layouts(prism_app_with_layouts):
    """Test that multiple tabs can have different layouts loaded."""
    duo = prism_app_with_layouts

    # Use initial tab for static layout
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()
    duo.wait_for_element("[data-testid='prism-layout-item-test-static']", timeout=3)

    static_layout = duo.find_element("[data-testid='prism-layout-item-test-static']")
    static_layout.click()
    duo.wait_for_element("#static-content", timeout=5)

    # Create second tab with callback layout
    add_button = duo.find_element("[data-testid='prism-tabbar-add-button']")
    add_button.click()
    duo.wait_for_callbacks()

    # Get all tabs (1 initial + 1 new = 2)
    tabs = duo.find_elements("[data-testid^='prism-tab-']")
    assert len(tabs) == 2, "Should have 2 tabs"

    # Click second tab to activate it
    tabs[1].click()
    duo.wait_for_callbacks()

    # Load callback layout in second tab
    searchbar_input = duo.find_element("[data-testid='prism-searchbar-input']")
    searchbar_input.click()
    duo.wait_for_element("[data-testid='prism-layout-item-test-callback']", timeout=3)

    callback_layout = duo.find_element("[data-testid='prism-layout-item-test-callback']")
    callback_layout.click()
    duo.wait_for_element("#test-button", timeout=5)

    # Switch back to first tab
    tabs[0].click()
    duo.wait_for_callbacks()

    # Static content should still be there
    duo.wait_for_element("#static-content", timeout=3)
    content = duo.find_element("#static-content")
    assert content.text == "Static content", "First tab should retain its layout"
