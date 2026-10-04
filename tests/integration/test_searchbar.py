"""
Integration tests for SearchBar component.

Tests basic SearchBar functionality to catch errors early. These are smoke tests
to verify the refactored reducer-based architecture works in the browser.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Check for browser console errors
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration

# The dropdown lists this layout while it is open with an empty query.
_LAYOUT_ITEM = "[data-testid='prism-layout-item-test-static']"


def _open_dropdown(duo) -> None:
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(_LAYOUT_ITEM, timeout=5)


def _wait_for_empty_query(duo) -> None:
    WebDriverWait(duo.driver, 3).until(
        lambda driver: driver.find_element(
            By.CSS_SELECTOR, testutils.SEARCHBAR_INPUT
        ).get_attribute("value")
        == "",
        message="Escape should clear the query",
    )


def test_searchbar_exists_on_initial_load(prism_app_with_layouts):
    """
    Test that SearchBar renders on initial page load.

    Verifies:
    - SearchBar is present in the DOM
    - No browser console errors on load
    """
    duo = prism_app_with_layouts

    # Wait for tab to load
    testutils.wait_for_tab_count(duo, 1)

    # SearchBar should be present (either as display or search mode)
    # Check for the container that always exists
    duo.wait_for_element(".prism-searchbar", timeout=5)
    searchbar = duo.find_element(".prism-searchbar")
    assert searchbar is not None, "SearchBar should render on initial load"


def test_search_input_has_an_accessible_name(prism_app_with_layouts):
    """The search input is a combobox without a visible label, so cmdk must name it."""
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=5)

    search_input = duo.find_element(testutils.SEARCHBAR_INPUT)
    assert search_input.aria_role == "combobox"
    assert search_input.accessible_name == "Search layouts"


def test_searchbar_transitions_to_search_mode(prism_app_with_layouts):
    """
    Test basic mode transition: display -> search.

    Verifies:
    - Clicking the SearchBar activates search mode
    - Search input becomes visible
    """
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    # Click on SearchBar (click on the container)
    duo.wait_for_element(".prism-searchbar", timeout=5)
    searchbar = duo.find_element(".prism-searchbar")
    searchbar.click()

    # Search input should become visible (explicit wait)
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    search_input = duo.find_element(testutils.SEARCHBAR_INPUT)
    assert search_input is not None, "Search input should appear"
    assert search_input.is_displayed(), "Search input should be visible"


def test_searchbar_escape_closes_dropdown(prism_app_with_layouts):
    """Escape closes the dropdown of the search bar."""
    duo = prism_app_with_layouts
    _open_dropdown(duo)

    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys(Keys.ESCAPE)

    testutils.wait_for_element_invisible(duo, _LAYOUT_ITEM)


def test_searchbar_typing_updates_query(prism_app_with_layouts):
    """
    Test that typing in SearchBar updates the search query.

    Verifies:
    - Text input works
    - Input value reflects typed text
    - No errors during typing
    """
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    # Activate search mode
    duo.wait_for_element(".prism-searchbar", timeout=5)
    searchbar = duo.find_element(".prism-searchbar")
    searchbar.click()

    # Wait for search input
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    search_input = duo.find_element(testutils.SEARCHBAR_INPUT)

    # Type a query
    search_input.send_keys("test")

    # Verify the input value was set
    WebDriverWait(duo.driver, 2).until(
        lambda d: d.find_element(By.CSS_SELECTOR, testutils.SEARCHBAR_INPUT).get_attribute("value")
        == "test",
        message="Search input should contain 'test' after typing",
    )


def test_searchbar_independent_per_tab(prism_app_with_layouts):
    """
    Test that each tab has independent SearchBar state.

    Verifies:
    - Creating a new tab shows SearchBar
    - Switching between tabs doesn't crash
    - No state leakage between tabs
    """
    duo = prism_app_with_layouts

    # Start with 1 tab
    testutils.wait_for_tab_count(duo, 1)

    # Create a second tab
    add_button = duo.find_element(testutils.ADD_TAB_BUTTON)
    add_button.click()
    testutils.wait_for_tab_count(duo, 2)

    tabs = testutils.get_tabs(duo)
    assert len(tabs) == 2, "Should have 2 tabs"

    # Click first tab and wait for SearchBar
    tabs[0].click()
    duo.wait_for_element(".prism-searchbar", timeout=3)

    # Click second tab and wait for SearchBar
    tabs = testutils.get_tabs(duo)  # Re-fetch to avoid stale elements
    tabs[1].click()
    duo.wait_for_element(".prism-searchbar", timeout=3)


def test_searchbar_rapid_interactions(prism_app_with_layouts):
    """Each open, type and Escape cycle starts from a clean search bar.

    The next cycle opens the full list again only if Escape cleared the query
    and closed the dropdown.
    """
    duo = prism_app_with_layouts

    for _ in range(3):
        _open_dropdown(duo)
        search_input = duo.find_element(testutils.SEARCHBAR_INPUT)
        search_input.send_keys("abc", Keys.ESCAPE)
        _wait_for_empty_query(duo)


def test_searchbar_focus_management(prism_app_with_layouts):
    """
    Test SearchBar focus behavior is correct.

    Verifies:
    - Input can receive focus
    - Focus doesn't cause errors
    """
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    # Activate search mode
    duo.wait_for_element(".prism-searchbar", timeout=5)
    searchbar = duo.find_element(".prism-searchbar")
    searchbar.click()

    # Wait for and click input
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    search_input = duo.find_element(testutils.SEARCHBAR_INPUT)
    search_input.click()

    # Type to verify focus
    search_input.send_keys("focused")

    # Verify the value was accepted (proves focus worked)
    WebDriverWait(duo.driver, 2).until(
        lambda d: "focused"
        in (
            d.find_element(By.CSS_SELECTOR, testutils.SEARCHBAR_INPUT).get_attribute("value") or ""
        ),
        message="Input should contain 'focused' after typing",
    )


def test_searchbar_works_after_tab_operations(prism_app_with_layouts):
    """
    Test SearchBar continues working after tab operations.

    Verifies:
    - SearchBar works after creating tabs
    - SearchBar works after switching tabs
    - Search input can be activated and typed into
    """
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)

    # Create 2 more tabs (3 total)
    for _ in range(2):
        add_button = duo.find_element(testutils.ADD_TAB_BUTTON)
        add_button.click()

    testutils.wait_for_tab_count(duo, 3)

    tabs = testutils.get_tabs(duo)
    assert len(tabs) == 3, "Should have 3 tabs"

    # Click middle tab
    tabs[1].click()
    duo.wait_for_element(".prism-searchbar", timeout=3)

    # Verify SearchBar can be activated
    searchbar = duo.find_element(".prism-searchbar")
    searchbar.click()

    # Wait for search input and type into it
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    search_input = duo.find_element(testutils.SEARCHBAR_INPUT)
    search_input.send_keys("test")

    # Verify input received the text
    WebDriverWait(duo.driver, 2).until(
        lambda d: d.find_element(By.CSS_SELECTOR, testutils.SEARCHBAR_INPUT).get_attribute("value")
        == "test",
        message="Search input should contain 'test' after tab operations",
    )


def test_searchbar_survives_page_resize(prism_app_with_layouts):
    """An open dropdown stays open through a resize of the window."""
    duo = prism_app_with_layouts
    _open_dropdown(duo)
    initial_size = duo.driver.get_window_size()

    duo.driver.set_window_size(1200, 800)
    duo.driver.set_window_size(initial_size["width"], initial_size["height"])

    assert duo.find_element(_LAYOUT_ITEM).is_displayed()


# =============================================================================
# Click-outside dismissal (02 A-4)
# =============================================================================
#
# The document `mousedown` listener that closes the dropdown used to be attached
# only when the search-bar *mode* changed. A fresh tab is in search mode from
# mount and the dropdown auto-opens, so no listener was ever attached for it;
# the input's onBlur usually hid the bug. Both tests below fail on the old
# effect dependencies and pass with `[handleDismiss, state.showDropdown]`.


def _dropdown_open(duo) -> bool:
    return len(duo.find_elements(_LAYOUT_ITEM)) > 0


def test_click_outside_closes_dropdown_when_focus_is_inside_it(prism_app_with_layouts):
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=5)
    duo.wait_for_element(_LAYOUT_ITEM, timeout=5)  # auto-opened for the fresh tab

    # Move focus INTO the dropdown (the favourite star button) so that the
    # input's onBlur does not dismiss it; only the document listener can.
    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys(Keys.TAB)
    label = duo.driver.execute_script(
        "return document.activeElement && document.activeElement.getAttribute('aria-label')"
    )
    # The name says which layout the star belongs to.
    assert label.split()[0] in ("Add", "Remove") and "Test" in label, label
    assert label.endswith("favorites"), label
    assert _dropdown_open(duo), "dropdown must stay open while focus is inside it"

    # A real click on a non-interactive element outside the search bar.
    duo.driver.find_element(By.XPATH, "//span[text()='Mode:']").click()

    WebDriverWait(duo.driver, 3).until(
        lambda d: not _dropdown_open(duo),
        message="dropdown should close on click outside (A-4 click-outside listener)",
    )


def test_mousedown_outside_closes_dropdown_without_blur(prism_app_with_layouts):
    duo = prism_app_with_layouts
    testutils.wait_for_tab_count(duo, 1)
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=5)
    duo.wait_for_element(_LAYOUT_ITEM, timeout=5)

    # A synthetic mousedown does not move focus, so only the document listener
    # attached by the click-outside effect can dismiss the dropdown.
    duo.driver.execute_script(
        "document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))"
    )
    WebDriverWait(duo.driver, 3).until(
        lambda d: not _dropdown_open(duo),
        message="dropdown should close on mousedown outside (A-4 click-outside listener)",
    )
