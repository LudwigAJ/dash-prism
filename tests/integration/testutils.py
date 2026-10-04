"""
Utility functions for dash_prism integration tests.

This module contains helper functions for interacting with Prism components
in integration tests. These utilities follow Dash testing best practices:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Use ActionChains with .pause() for DnD operations
- Check for browser console errors
"""

from __future__ import annotations

import platform
import socket
from collections.abc import Mapping, Sequence
from typing import Any

from dash import Dash, html
from dash.development.base_component import Component
from dash.testing.composite import DashComposite
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism

# =============================================================================
# CSS Selectors - use data-testid for stability across React re-renders
# =============================================================================
TAB_SELECTOR = "[data-testid^='prism-tab-']:not([data-testid*='close'])"
PANEL_SELECTOR = "[data-testid^='prism-panel-']"
ADD_TAB_BUTTON = "[data-testid='prism-tabbar-add-button']"
SPLIT_PANEL_BUTTON = "[data-testid='prism-tabbar-split-button']"
SEARCHBAR_INPUT = "[data-testid='prism-searchbar-input']"
CONTEXT_MENU = "[data-testid='prism-context-menu']"
PRISM_ROOT = ".prism-root"

# DnD Drop Zone Selectors
# Note: Actual DOM uses data-testid="prism-drop-zone-{edge}-{panelId}"
# so we use ^= (starts-with) prefix matching
DROP_ZONE_LEFT = "[data-testid^='prism-drop-zone-left']"


def get_free_port() -> int:
    """
    Find and return an available port by binding to port 0.

    This is thread-safe and avoids port conflicts in parallel test execution.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


def start_app(dash_duo: DashComposite, app: Dash) -> None:
    """Serve ``app`` on a free port and wait until the first Prism component renders.

    Call :func:`dash_prism.init` before this function.

    :param dash_duo: The dash[testing] fixture.
    :param app: The Dash app to serve.
    """
    dash_duo.start_server(app, port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)


def start_prism(
    dash_duo: DashComposite,
    *,
    app: Dash | None = None,
    layouts: Mapping[str, Component] | None = None,
    children: Sequence[Component] = (),
    **prism_props: Any,
) -> DashComposite:
    """Serve a Dash app with one Prism component and wait until Prism renders.

    The Prism component has the ID ``prism`` and fills the viewport. It keeps the
    workspace in memory, so no workspace goes from one test to the next. A keyword
    argument replaces one of these props or adds a prop.

    :param dash_duo: The dash[testing] fixture.
    :param app: The Dash app to serve. Give an app when the test needs app options
        or callbacks of its own. The default is a new app.
    :param layouts: The static layouts to register, by layout ID. The name of each
        layout is its ID in title case. The default registers a ``home`` layout.
        Give ``{}`` when the test registers its layouts itself.
    :param children: The components that follow Prism in the app layout.
    :param prism_props: The props of the Prism component.
    :returns: ``dash_duo``, after Prism rendered.
    """
    if app is None:
        app = Dash(__name__, suppress_callback_exceptions=True)
    if layouts is None:
        layouts = {"home": html.Div("Home", id="home-content")}
    for layout_id, layout in layouts.items():
        dash_prism.register_layout(id=layout_id, name=layout_id.title(), layout=layout)

    props = {
        "id": "prism",
        "persistence": False,
        "persistence_type": "memory",
        "style": {"height": "100vh", "width": "100%"},
        **prism_props,
    }
    app.layout = html.Div(
        [dash_prism.Prism(**props), *children],
        style={"height": "100vh", "width": "100vw", "margin": "0", "padding": "0"},
    )
    dash_prism.init(props["id"], app)
    start_app(dash_duo, app)
    return dash_duo


# =============================================================================
# Wait Helpers
# Each wait raises TimeoutException when its condition does not hold in time.
# =============================================================================
def wait_for_panel_layout_stable(dash_duo, timeout: float = 5.0) -> None:
    """
    Wait until every panel has a width and a height.

    react-split-pane renders the children of a panel only after a ResizeObserver
    gave the panel a size, so a drag must not start before then.

    :param dash_duo: The dash testing fixture.
    :param timeout: The maximum wait in seconds.
    """

    def panels_have_size(driver):
        panels = driver.find_elements(By.CSS_SELECTOR, PANEL_SELECTOR)
        return bool(panels) and all(
            panel.rect["width"] > 0 and panel.rect["height"] > 0 for panel in panels
        )

    WebDriverWait(dash_duo.driver, timeout).until(
        panels_have_size, message="Panels do not have non-zero dimensions"
    )


def wait_for_tab_count(dash_duo, expected_count: int, timeout: float = 10.0) -> None:
    """
    Wait until the number of tabs equals ``expected_count``.

    :param dash_duo: The dash testing fixture.
    :param expected_count: The expected number of tabs.
    :param timeout: The maximum wait in seconds.
    """

    def tab_count_equals(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        return len(tabs) == expected_count

    WebDriverWait(dash_duo.driver, timeout).until(
        tab_count_equals, message=f"Expected {expected_count} tabs but condition not met"
    )


def wait_for_panel_count(dash_duo, expected_count: int, timeout: float = 10.0) -> None:
    """
    Wait until the number of panels equals ``expected_count``.

    :param dash_duo: The dash testing fixture.
    :param expected_count: The expected number of panels.
    :param timeout: The maximum wait in seconds.
    """

    def panel_count_equals(driver):
        panels = driver.find_elements(By.CSS_SELECTOR, PANEL_SELECTOR)
        return len(panels) == expected_count

    WebDriverWait(dash_duo.driver, timeout).until(
        panel_count_equals, message=f"Expected {expected_count} panels but condition not met"
    )


def wait_for_element_invisible(dash_duo, selector: str, timeout: float = 5.0) -> None:
    """
    Wait until no visible element matches ``selector``.

    :param dash_duo: The dash testing fixture.
    :param selector: The CSS selector of the element.
    :param timeout: The maximum wait in seconds.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, selector)),
        message=f"Element {selector} did not become invisible",
    )


def wait_for_drop_zones_visible(dash_duo, timeout: float = 5.0) -> None:
    """
    Wait until the drop zones of a drag appear.

    The drop zones exist only while a drag is active, and only in a panel that is
    not pinned, when the workspace holds more than one tab.

    :param dash_duo: The dash testing fixture.
    :param timeout: The maximum wait in seconds.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, DROP_ZONE_LEFT)),
        message="The drop zones did not appear",
    )


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
def trigger_rename_mode(dash_duo, tab_id: str) -> str:
    """
    Double-click a tab and wait for its rename input.

    :param dash_duo: The dash testing fixture.
    :param tab_id: The ID of the tab to rename.
    :returns: The CSS selector of the rename input.
    """
    # The onDoubleClick handler is on the inner TabsTrigger button, not on the
    # wrapper that has the test ID. A synthetic event on the button reaches it
    # without the pointer events that start a drag.
    trigger = dash_duo.find_element(f"[data-testid='prism-tab-{tab_id}'] [role='tab']")
    dash_duo.driver.execute_script(
        "arguments[0].dispatchEvent(new MouseEvent('dblclick', "
        "{bubbles: true, cancelable: true, view: window, detail: 2}));",
        trigger,
    )
    rename_input = f"[data-testid='prism-tab-rename-{tab_id}']"
    dash_duo.wait_for_element(rename_input, timeout=5)
    return rename_input


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
    dash_duo.driver.execute_script(
        """
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
        }
        """,
        selector,
        value,
    )

    # explicit wait for the value to be set, replacing the hardcoded JS timeout
    WebDriverWait(dash_duo.driver, 2.0).until(
        lambda d: d.find_element(By.CSS_SELECTOR, selector).get_attribute("value") == value,
        message=f"Value '{value}' was not set on element '{selector}'",
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
                key: 'Enter',
                code: 'Enter',
                bubbles: true,
                cancelable: true,
                view: window
            }));
        }
    """,
        selector,
    )


def tab_to(dash_duo, selector: str, max_presses: int = 80) -> None:
    """
    Press Tab until the element that matches ``selector`` has focus.

    A control that a keyboard user cannot reach with Tab fails here. The helper
    starts from the current focus, so a test can move to a known element first.

    :param dash_duo: The dash testing fixture.
    :param selector: The CSS selector of the element that must receive focus.
    :param max_presses: The number of Tab presses after which the helper gives up.
    :raises AssertionError: If no element that matches ``selector`` received focus.
    """
    for _ in range(max_presses):
        if dash_duo.driver.execute_script(
            "return document.activeElement.matches(arguments[0]);", selector
        ):
            return
        ActionChains(dash_duo.driver).send_keys(Keys.TAB).perform()
    raise AssertionError(f"Tab did not reach {selector!r} in {max_presses} presses")


def press_key(dash_duo, key: str) -> None:
    """Send one key press to the element that has focus."""
    ActionChains(dash_duo.driver).send_keys(key).perform()


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
def _activate_drag(dash_duo, source) -> None:
    """Press the mouse on ``source`` and move it past the 8 px activation distance of dnd-kit."""
    ActionChains(dash_duo.driver).click_and_hold(source).move_by_offset(15, 0).perform()


def _drop(dash_duo) -> None:
    """Release the mouse and wait until the drag ends."""
    ActionChains(dash_duo.driver).release().perform()
    # A WebDriver search for a missing element waits out the implicit wait of
    # dash[testing] (2 s). A query in the page returns at once.
    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.execute_script(
            "return document.querySelector(arguments[0]) === null;", DROP_ZONE_LEFT
        ),
        message="The drag did not end",
    )


def drag_tab_to_position(
    dash_duo,
    source_tab_index: int,
    target_tab_index: int,
    panel_index: int = 0,
) -> None:
    """
    Drag a tab onto another tab of the same panel, so the tabs change places.

    :param dash_duo: The dash testing fixture.
    :param source_tab_index: The index of the tab to drag.
    :param target_tab_index: The index of the tab to drop on.
    :param panel_index: The index of the panel that holds both tabs.
    """
    wait_for_panel_layout_stable(dash_duo)
    tabs = get_panels(dash_duo)[panel_index].find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
    source_tab, target_tab = tabs[source_tab_index], tabs[target_tab_index]

    _activate_drag(dash_duo, source_tab)
    wait_for_drop_zones_visible(dash_duo)
    ActionChains(dash_duo.driver).move_to_element(target_tab).perform()
    # dnd-kit reads the drop target from its last render. The sortable list moves
    # the target tab aside when it renders the target, so a release before that
    # would drop on the previous target.
    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.execute_script(
            "return /translate3d\\((?!0px, 0px)/.test(arguments[0].style.transform);",
            target_tab,
        ),
        message="The target tab did not move aside for the dragged tab",
    )
    _drop(dash_duo)


def drag_tab_to_panel_edge(
    dash_duo,
    tab_index: int,
    edge: str,
    source_panel_index: int = 0,
    target_panel_index: int = 0,
) -> None:
    """
    Drag a tab onto an edge drop zone of a panel, so the panel splits.

    The caller waits for the new panel count.

    :param dash_duo: The dash testing fixture.
    :param tab_index: The index of the tab in the source panel.
    :param edge: The edge to drop on: ``left``, ``right``, ``top`` or ``bottom``.
    :param source_panel_index: The index of the panel that holds the tab.
    :param target_panel_index: The index of the panel to split.
    """
    wait_for_panel_layout_stable(dash_duo)
    source_panel = get_panels(dash_duo)[source_panel_index]
    source_tab = source_panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)[tab_index]
    drop_zone = (
        f"[data-testid='prism-drop-zone-{edge}-{get_panel_id(dash_duo, target_panel_index)}']"
    )

    _activate_drag(dash_duo, source_tab)
    ActionChains(dash_duo.driver).move_to_element(
        dash_duo.wait_for_element(drop_zone, timeout=5)
    ).perform()
    # The zone renders its highlight child when dnd-kit picks it as the drop target.
    dash_duo.wait_for_element(f"{drop_zone} > div", timeout=5)
    _drop(dash_duo)


def start_drag_without_drop(dash_duo, tab_index: int, panel_index: int = 0) -> None:
    """
    Start a drag of a tab and keep the mouse pressed.

    Call :func:`cancel_drag_with_escape` to end the drag.

    :param dash_duo: The dash testing fixture.
    :param tab_index: The index of the tab in the panel.
    :param panel_index: The index of the panel that holds the tab.
    """
    panel = get_panels(dash_duo)[panel_index]
    _activate_drag(dash_duo, panel.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)[tab_index])


def cancel_drag_with_escape(dash_duo) -> None:
    """Press Escape, which cancels an active drag."""
    ActionChains(dash_duo.driver).send_keys(Keys.ESCAPE).perform()


# =============================================================================
# Common Interaction Helpers
# =============================================================================
def get_modifier_key():
    """Get the correct modifier key for the current platform.

    Returns Keys.COMMAND on macOS, Keys.CONTROL elsewhere.
    """
    return Keys.COMMAND if platform.system() == "Darwin" else Keys.CONTROL


def open_context_menu(dash_duo, tab_element):
    """
    Open context menu on a tab element.

    Parameters
    ----------
    dash_duo : DashComposite
        The dash testing fixture.
    tab_element : WebElement
        The tab element to right-click.
    """
    ActionChains(dash_duo.driver).context_click(tab_element).perform()
    WebDriverWait(dash_duo.driver, 3).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, CONTEXT_MENU))
    )
