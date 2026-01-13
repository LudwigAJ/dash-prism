"""
Utility functions for dash_prism integration tests.

This module contains helper functions for interacting with Prism components
in integration tests. These utilities follow Dash testing best practices:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Use ActionChains with .pause() for DnD operations
- Check for browser console errors

See DASH_TESTING_GUIDELINES.md for more details.
"""

from __future__ import annotations

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys


# =============================================================================
# CSS Selectors - use data-testid for stability across React re-renders
# =============================================================================
TAB_SELECTOR = "[data-testid^='prism-tab-']:not([data-testid*='close'])"
PANEL_SELECTOR = "[data-testid^='prism-panel-']"
ADD_TAB_BUTTON = "[data-testid='prism-tabbar-add-button']"
SEARCHBAR_INPUT = "[data-testid='prism-searchbar-input']"
CONTEXT_MENU = "[data-testid='prism-context-menu']"
PRISM_ROOT = ".prism-root"

# DnD Drop Zone Selectors
DROP_ZONE_LEFT = "[data-testid='prism-drop-zone-left']"
DROP_ZONE_RIGHT = "[data-testid='prism-drop-zone-right']"
DROP_ZONE_TOP = "[data-testid='prism-drop-zone-top']"
DROP_ZONE_BOTTOM = "[data-testid='prism-drop-zone-bottom']"


# =============================================================================
# Wait Helpers - explicit waits per Dash testing best practices
# =============================================================================
def wait_for_tab_count(dash_duo, expected_count: int, timeout: float = 5.0) -> bool:
    """
    Wait until the number of tabs equals expected_count.

    Uses explicit WebDriverWait instead of time.sleep() for reliability.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    expected_count : int
        Expected number of tabs.
    timeout : float
        Maximum wait time in seconds.

    Returns
    -------
    bool
        True if condition met within timeout.

    Raises
    ------
    TimeoutException
        If condition not met within timeout.
    """

    def tab_count_equals(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return len(tabs) == expected_count

    WebDriverWait(dash_duo.driver, timeout).until(
        tab_count_equals, message=f"Expected {expected_count} tabs but condition not met"
    )
    return True


def wait_for_panel_count(dash_duo, expected_count: int, timeout: float = 5.0) -> bool:
    """
    Wait until the number of panels equals expected_count.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    expected_count : int
        Expected number of panels.
    timeout : float
        Maximum wait time in seconds.

    Returns
    -------
    bool
        True if condition met within timeout.
    """

    def panel_count_equals(driver):
        panels = driver.find_elements(By.CSS_SELECTOR, PANEL_SELECTOR)
        return len(panels) == expected_count

    WebDriverWait(dash_duo.driver, timeout).until(
        panel_count_equals, message=f"Expected {expected_count} panels but condition not met"
    )
    return True


def wait_for_element_invisible(dash_duo, selector: str, timeout: float = 3.0) -> bool:
    """
    Wait until an element is no longer visible.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    selector : str
        CSS selector for the element.
    timeout : float
        Maximum wait time in seconds.

    Returns
    -------
    bool
        True if element became invisible within timeout.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, selector)),
        message=f"Element {selector} did not become invisible",
    )
    return True


def wait_for_drop_zones_visible(dash_duo, timeout: float = 3.0) -> bool:
    """
    Wait for drop zone elements to appear during drag.

    Drop zones only render when a drag is active and panel is not
    in single-tab mode or pinned.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    timeout : float
        Maximum wait time.

    Returns
    -------
    bool
        True if drop zones appeared.
    """
    try:
        WebDriverWait(dash_duo.driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, DROP_ZONE_LEFT))
        )
        return True
    except Exception:
        return False


# =============================================================================
# Element Getters
# =============================================================================
def get_tabs(dash_duo):
    """Return list of tab elements (excluding close buttons)."""
    return dash_duo.find_elements(TAB_SELECTOR)


def get_panels(dash_duo):
    """Return list of panel elements."""
    return dash_duo.find_elements(PANEL_SELECTOR)


def get_tab_id(dash_duo, index: int = 0) -> str | None:
    """
    Get the ID of a tab by index.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    index : int
        Tab index (0-based).

    Returns
    -------
    str | None
        The tab ID or None if not found.
    """
    tabs = get_tabs(dash_duo)
    if index < len(tabs):
        testid = tabs[index].get_attribute("data-testid")
        return testid.replace("prism-tab-", "") if testid else None
    return None


def get_panel_id(dash_duo, panel_index: int = 0) -> str | None:
    """
    Get the panel ID by index.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    panel_index : int
        Panel index.

    Returns
    -------
    str | None
        Panel ID or None if not found.
    """
    panels = get_panels(dash_duo)
    if panel_index >= len(panels):
        return None

    testid = panels[panel_index].get_attribute("data-testid")
    return testid.replace("prism-panel-", "") if testid else None


def get_tab_order_in_panel(dash_duo, panel_index: int = 0) -> list[str]:
    """
    Get the order of tab IDs in a specific panel.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    panel_index : int
        Panel index.

    Returns
    -------
    list[str]
        List of tab IDs in order.
    """
    panels = get_panels(dash_duo)
    if panel_index >= len(panels):
        return []

    panel = panels[panel_index]
    tabs = panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)

    tab_ids = []
    for tab in tabs:
        testid = tab.get_attribute("data-testid")
        if testid:
            tab_ids.append(testid.replace("prism-tab-", ""))

    return tab_ids


def verify_tab_in_panel(dash_duo, tab_id: str, panel_index: int = 0) -> bool:
    """
    Verify a specific tab is in a specific panel.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_id : str
        Tab ID to find.
    panel_index : int
        Panel index to check.

    Returns
    -------
    bool
        True if tab is in the panel.
    """
    tab_ids = get_tab_order_in_panel(dash_duo, panel_index)
    return tab_id in tab_ids


def are_drop_zones_present(dash_duo) -> bool:
    """
    Check if drop zone elements are currently present in the DOM.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.

    Returns
    -------
    bool
        True if at least one drop zone is present.
    """
    elements = dash_duo.driver.find_elements(By.CSS_SELECTOR, DROP_ZONE_LEFT)
    return len(elements) > 0


def check_browser_errors(dash_duo) -> list:
    """
    Check browser console for errors.

    Per Dash testing best practices, always check for console errors.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.

    Returns
    -------
    list
        List of error log entries (should be empty for passing tests).
    """
    logs = dash_duo.get_logs()
    # Filter for severe errors only
    errors = [log for log in logs if log.get("level") == "SEVERE"]
    return errors


# =============================================================================
# React Interaction Helpers
# =============================================================================
def trigger_rename_mode(dash_duo, tab_id: str) -> bool:
    """
    Trigger rename mode on a tab using JavaScript dblclick.

    This handles React's async state updates by using execute_async_script.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_id : str
        The tab ID to rename.

    Returns
    -------
    bool
        True if rename mode was triggered successfully.
    """
    result = dash_duo.driver.execute_async_script(
        """
        var callback = arguments[arguments.length - 1];
        var tabId = arguments[0];
        var tab = document.querySelector("[data-testid='prism-tab-" + tabId + "']");
        if (!tab) { callback(false); return; }

        // Dispatch dblclick event
        var evt = new MouseEvent('dblclick', {
            bubbles: true, cancelable: true, view: window, detail: 2
        });
        tab.dispatchEvent(evt);

        // Wait for React to process the state update
        setTimeout(function() { callback(true); }, 100);
    """,
        tab_id,
    )
    return result


def set_input_value_react(dash_duo, selector: str, value: str):
    """
    Set input value in a way that works with React's controlled inputs.

    React uses custom value descriptors, so we need to use the native setter.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    selector : str
        CSS selector for the input element.
    value : str
        Value to set.
    """
    dash_duo.driver.execute_async_script(
        """
        var callback = arguments[arguments.length - 1];
        var input = document.querySelector(arguments[0]);
        if (input) {
            // Focus the input first
            input.focus();

            // Use the native setter to bypass React's descriptor
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(input, arguments[1]);

            // Trigger React's onChange - need both 'input' and 'change' events
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Wait for React to process the state update
            setTimeout(function() { callback(true); }, 200);
        } else {
            callback(false);
        }
    """,
        selector,
        value,
    )


def press_enter_on_element(dash_duo, selector: str):
    """
    Press Enter key on an element to trigger onKeyDown handler.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    selector : str
        CSS selector for the element.
    """
    dash_duo.driver.execute_script(
        """
        var input = document.querySelector(arguments[0]);
        if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
            }));
        }
    """,
        selector,
    )


# =============================================================================
# Tab Management Helpers
# =============================================================================
def create_tabs_for_dnd_test(dash_duo, count: int = 3) -> list[str]:
    """
    Create multiple tabs for DnD testing.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    count : int
        Total number of tabs desired (including initial tab).

    Returns
    -------
    list[str]
        List of tab IDs in order.
    """
    initial_tab_id = get_tab_id(dash_duo, 0)
    tab_ids = [initial_tab_id] if initial_tab_id else []

    add_button = dash_duo.find_element(ADD_TAB_BUTTON)
    for _ in range(count - 1):
        add_button.click()
        wait_for_tab_count(dash_duo, len(tab_ids) + 1)
        new_tab_id = get_tab_id(dash_duo, len(tab_ids))
        if new_tab_id:
            tab_ids.append(new_tab_id)

    return tab_ids


# =============================================================================
# Drag-and-Drop Helpers - for @dnd-kit testing with ActionChains
# =============================================================================
def perform_drag_and_drop(
    dash_duo,
    source_element,
    target_element,
    offset_x: int = 0,
    offset_y: int = 0,
    initial_offset: int = 15,
) -> bool:
    """
    Perform a drag-and-drop operation compatible with @dnd-kit.

    @dnd-kit's PointerSensor requires >8px initial movement to activate drag.
    This function uses ActionChains chaining with .pause() for reliable event processing.

    Per DASH_TESTING_GUIDELINES.md:
    - Use ActionChains chaining (not time.sleep)
    - Use .pause() between actions for dnd-kit event processing

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    source_element : WebElement
        The element to drag.
    target_element : WebElement
        The drop target element.
    offset_x : int
        X offset from target center (default 0).
    offset_y : int
        Y offset from target center (default 0).
    initial_offset : int
        Initial movement to trigger drag (must be >8px, default 15).

    Returns
    -------
    bool
        True if drag completed without error.
    """
    actions = ActionChains(dash_duo.driver)
    actions.click_and_hold(source_element).pause(0.5).move_by_offset(
        initial_offset, initial_offset
    ).pause(0.3).move_to_element_with_offset(target_element, offset_x, offset_y).pause(
        0.5
    ).release().perform()
    return True


def drag_tab_to_position(
    dash_duo,
    source_tab_index: int,
    target_tab_index: int,
    panel_index: int = 0,
) -> bool:
    """
    Drag a tab to a new position within the same panel (reorder).

    For @dnd-kit/sortable, we need to:
    1. Start the drag (click_and_hold + initial movement)
    2. Move to the target tab element (sortable handles reordering on hover)
    3. Release

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    source_tab_index : int
        Index of the tab to drag.
    target_tab_index : int
        Index position to drop at.
    panel_index : int
        Panel index if multiple panels exist (default 0).

    Returns
    -------
    bool
        True if operation completed.
    """
    panels = get_panels(dash_duo)
    if panel_index >= len(panels):
        return False

    panel = panels[panel_index]
    tabs = panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)

    if source_tab_index >= len(tabs) or target_tab_index >= len(tabs):
        return False

    source_tab = tabs[source_tab_index]
    target_tab = tabs[target_tab_index]

    # Calculate offset direction based on position (drop to left or right of target)
    # Moving forward: drop on right side of target
    # Moving backward: drop on left side of target
    if source_tab_index < target_tab_index:
        # Moving forward - offset to right side of target
        offset_x = 10
    else:
        # Moving backward - offset to left side of target
        offset_x = -10

    # Use ActionChains chaining with pauses for @dnd-kit event processing
    actions = ActionChains(dash_duo.driver)
    actions.click_and_hold(source_tab).pause(0.5).move_by_offset(15, 0).pause(
        0.3
    ).move_to_element_with_offset(target_tab, offset_x, 0).pause(0.5).release().perform()

    return True


def drag_tab_to_panel_edge(
    dash_duo,
    tab_index: int,
    edge: str,
    source_panel_index: int = 0,
    target_panel_index: int = 0,
) -> bool:
    """
    Drag a tab to a panel edge to trigger panel splitting.

    NOTE: Panel split tests are currently skipped due to react-split-pane
    ResizeObserver issues in headless Chrome. This function is retained
    for future use when the issue is resolved.

    Uses a two-phase approach:
    1. Start drag to make drop zones appear
    2. Move to the target drop zone and release

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_index : int
        Index of the tab to drag within source panel.
    edge : str
        Edge to drop on: 'left', 'right', 'top', 'bottom'.
    source_panel_index : int
        Source panel index (default 0).
    target_panel_index : int
        Target panel index (default 0).

    Returns
    -------
    bool
        True if operation completed.
    """
    panels = get_panels(dash_duo)
    if source_panel_index >= len(panels) or target_panel_index >= len(panels):
        return False

    source_panel = panels[source_panel_index]

    tabs = source_panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
    if tab_index >= len(tabs):
        return False

    source_tab = tabs[tab_index]

    # Get source position for offset calculation
    source_rect = source_tab.rect
    source_x = source_rect["x"] + source_rect["width"] / 2
    source_y = source_rect["y"] + source_rect["height"] / 2

    # Phase 1: Start drag to make drop zones appear
    actions = ActionChains(dash_duo.driver)
    actions.click_and_hold(source_tab).pause(0.5).move_by_offset(15, 15).pause(0.5).perform()

    # Find the drop zone element now that drag is active
    drop_zone_selector = f"[data-testid^='prism-drop-zone-{edge}']"
    drop_zones = dash_duo.driver.find_elements(By.CSS_SELECTOR, drop_zone_selector)

    if not drop_zones:
        ActionChains(dash_duo.driver).release().perform()
        return False

    dz = drop_zones[0]
    dz_rect = dz.rect

    # Phase 2: Move to drop zone center and release
    dz_center_x = dz_rect["x"] + dz_rect["width"] / 2
    dz_center_y = dz_rect["y"] + dz_rect["height"] / 2

    # Current position after phase 1: source_x + 15, source_y + 15
    current_x = source_x + 15
    current_y = source_y + 15

    # Calculate delta to drop zone center
    delta_x = int(dz_center_x - current_x)
    delta_y = int(dz_center_y - current_y)

    # Move to drop zone and release
    actions2 = ActionChains(dash_duo.driver)
    actions2.move_by_offset(delta_x, delta_y).pause(0.3).release().perform()

    return True


def drag_tab_to_other_panel(
    dash_duo,
    tab_index: int,
    source_panel_index: int,
    target_panel_index: int,
) -> bool:
    """
    Drag a tab from one panel to another panel (cross-panel move).

    The cross-panel drop zone only becomes active when dragging from a
    different panel. We need to:
    1. Start the drag from source panel
    2. Move to a tab in the target panel (triggers MOVE_TAB action)

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_index : int
        Index of tab within source panel.
    source_panel_index : int
        Index of source panel.
    target_panel_index : int
        Index of target panel.

    Returns
    -------
    bool
        True if operation completed.
    """
    panels = get_panels(dash_duo)
    if source_panel_index >= len(panels) or target_panel_index >= len(panels):
        return False

    source_panel = panels[source_panel_index]
    target_panel = panels[target_panel_index]

    source_tabs = source_panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
    if tab_index >= len(source_tabs):
        return False

    source_tab = source_tabs[tab_index]

    # Find a tab in the target panel to drop onto
    target_tabs = target_panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)

    # Use ActionChains for the drag operation
    actions = ActionChains(dash_duo.driver)
    actions.click_and_hold(source_tab).pause(0.5).move_by_offset(15, 15).pause(0.3)

    if target_tabs:
        # Drop onto the first tab in target panel
        actions.move_to_element(target_tabs[0]).pause(0.5).release().perform()
    else:
        # No tabs in target panel - drop on the panel itself (upper area)
        target_panel_rect = target_panel.rect
        actions.move_to_element_with_offset(
            target_panel, 0, -target_panel_rect["height"] // 3
        ).pause(0.5).release().perform()

    return True


def start_drag_without_drop(dash_duo, tab_index: int, panel_index: int = 0) -> None:
    """
    Start a drag operation without releasing (for testing drag state).

    Uses ActionChains chaining with .pause() per DASH_TESTING_GUIDELINES.md.
    After calling this, use cancel_drag_with_escape() to cancel.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_index : int
        Index of the tab to drag.
    panel_index : int
        Panel index (default 0).
    """
    panels = get_panels(dash_duo)
    if panel_index >= len(panels):
        raise ValueError(f"Panel index {panel_index} out of range")

    panel = panels[panel_index]
    tabs = panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)

    if tab_index >= len(tabs):
        raise ValueError(f"Tab index {tab_index} out of range")

    source_tab = tabs[tab_index]

    # Use chained ActionChains with pause() - not time.sleep()
    actions = ActionChains(dash_duo.driver)
    actions.click_and_hold(source_tab).pause(0.5).move_by_offset(15, 15).pause(
        0.5
    ).perform()  # >8px to trigger PointerSensor


def cancel_drag_with_escape(dash_duo) -> None:
    """
    Cancel an active drag operation by pressing Escape.

    Uses ActionChains chaining with .pause() per DASH_TESTING_GUIDELINES.md.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    """
    actions = ActionChains(dash_duo.driver)
    actions.send_keys(Keys.ESCAPE).pause(0.3).perform()
