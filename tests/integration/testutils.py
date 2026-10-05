"""Helpers for the dash_prism integration tests.

The module starts apps (:func:`start_prism`, :func:`start_app`), waits for
states of the page (the ``wait_for_*`` functions), and drives Prism through
Selenium. Each wait raises ``TimeoutException`` when its condition does not
hold in time. The selectors use the ``data-testid`` attributes of Prism.
"""

from __future__ import annotations

import os
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
# CSS Selectors
# =============================================================================
# The prefix prism-tab- also matches the close buttons, the rename input and the tab bar buttons.
TAB_SELECTOR = (
    "[data-testid^='prism-tab-']:not([data-testid*='close'])"
    ":not([data-testid^='prism-tab-rename-']):not([data-testid^='prism-tab-bar-'])"
)
PANEL_SELECTOR = "[data-testid^='prism-panel-']"
ADD_TAB_BUTTON = "[data-testid='prism-tab-bar-add-button']"
SPLIT_PANEL_BUTTON = "[data-testid='prism-tab-bar-split-button']"
SEARCHBAR_INPUT = "[data-testid='prism-search-bar-input']"
CONTEXT_MENU = "[data-testid='prism-context-menu']"
HELP_BUTTON = "[data-testid='prism-status-bar-help']"
UNDO_BUTTON = "[data-testid='prism-status-bar-undo']"
TOAST = "[data-sonner-toast]"
PRISM_ROOT = ".prism-root"

# The test ID of a drop zone is prism-drop-zone-{edge}-{panelId}. The prefix
# matches the left zone of each panel.
DROP_ZONE_LEFT = "[data-testid^='prism-drop-zone-left']"


def get_free_port() -> int:
    """Return a port that no other server uses.

    Each xdist worker counts the default ports of dash[testing] from the same
    start, so two workers would give two servers the same port.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        return sock.getsockname()[1]


def storage_key(component_id: str) -> str:
    """Return the browser storage key of the persisted workspace of a Prism component.

    The format must match ``getWorkspaceStorageKey`` in ``src/ts/store/index.ts``.
    """
    return f"persist:prism-workspace-{component_id}"


# With PRISM_STRICT_MODE=1, the suite runs against the bundle of `pnpm run build:strict`.
STRICT_MODE = os.environ.get("PRISM_STRICT_MODE") == "1"

# The fiber mode bits StrictLegacyMode (8) and StrictEffectsMode (16) of React 18. React sets both
# inside <React.StrictMode> under a createRoot root.
_STRICT_MODE_SCRIPT = """
const root = document.querySelector(arguments[0]);
const key = Object.keys(root).find((name) => name.startsWith('__reactFiber$'));
return key !== undefined && (root[key].mode & 24) === 24;
"""


def start_app(dash_duo: DashComposite, app: Dash, **server_options: Any) -> DashComposite:
    """Serve ``app`` on a free port and wait until the first Prism component renders.

    Call :func:`dash_prism.init` before this function. With ``PRISM_STRICT_MODE=1``,
    Dash serves the development build of React, and the function makes sure that
    Prism runs in StrictMode.

    :param dash_duo: The dash[testing] fixture.
    :param app: The Dash app to serve.
    :param server_options: More keyword arguments for ``app.run``, for example
        ``debug=True``.
    :returns: ``dash_duo``, after Prism rendered.
    :raises AssertionError: When ``PRISM_STRICT_MODE=1`` and Prism does not run in
        StrictMode, for example because the bundle is not the StrictMode build.
    """
    # Dash serves the development build of React only together with the props check.
    dash_duo.start_server(
        app,
        port=get_free_port(),
        dev_tools_serve_dev_bundles=STRICT_MODE,
        dev_tools_props_check=STRICT_MODE,
        **server_options,
    )
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    if STRICT_MODE:
        assert dash_duo.driver.execute_script(
            _STRICT_MODE_SCRIPT, PRISM_ROOT
        ), "Prism does not run in StrictMode. Build the bundle with `pnpm run build:strict`."
    return dash_duo


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
    return start_app(dash_duo, app)


# =============================================================================
# Wait Helpers
# Each wait raises TimeoutException when its condition does not hold in time.
# =============================================================================
def wait_for_panel_layout_stable(dash_duo, timeout: float = 5.0) -> None:
    """Wait until every panel has a width and a height.

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
    """Wait until the number of tabs equals ``expected_count``.

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
    """Wait until the number of panels equals ``expected_count``.

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


def wait_for_tab_named(
    dash_duo, name: str, *, index: int | None = None, timeout: float = 10.0
) -> None:
    """Wait until a tab shows ``name``.

    :param dash_duo: The dash testing fixture.
    :param name: The text that the tab must contain.
    :param index: The index of the tab that must show the name. The default
        accepts any tab.
    :param timeout: The maximum wait in seconds.
    """

    def tab_shows_name(driver):
        tabs = driver.find_elements(By.CSS_SELECTOR, TAB_SELECTOR)
        if index is not None:
            tabs = tabs[index : index + 1]
        return any(name in tab.text for tab in tabs)

    WebDriverWait(dash_duo.driver, timeout).until(tab_shows_name, message=f"No tab shows {name!r}")


def wait_for_element_invisible(dash_duo, selector: str, timeout: float = 5.0) -> None:
    """Wait until no visible element matches ``selector``.

    :param dash_duo: The dash testing fixture.
    :param selector: The CSS selector of the element.
    :param timeout: The maximum wait in seconds.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, selector)),
        message=f"Element {selector} did not become invisible",
    )


def wait_for_drop_zones_visible(dash_duo, timeout: float = 5.0) -> None:
    """Wait until the drop zones of a drag appear.

    The drop zones exist only while a drag is active, and only in a panel that is
    not pinned, when the workspace holds more than one tab.

    :param dash_duo: The dash testing fixture.
    :param timeout: The maximum wait in seconds.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, DROP_ZONE_LEFT)),
        message="The drop zones did not appear",
    )


def wait_for_focus(dash_duo, selector: str, timeout: float = 3.0) -> None:
    """Wait until the element that matches ``selector`` has focus.

    The tab list of Radix moves the focus one task after an arrow key, so a test waits
    for the focus before the next key.

    :param dash_duo: The dash testing fixture.
    :param selector: The CSS selector of the element that must receive focus.
    :param timeout: The maximum wait in seconds.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        lambda driver: driver.execute_script(
            "return document.activeElement.matches(arguments[0]);", selector
        ),
        message=f"{selector} did not receive focus",
    )


def wait_for_callbacks_idle(dash_duo, timeout: float = 10.0) -> None:
    """Wait until Dash has no callback that is requested or running.

    Use it before an assertion that a callback did not change the page.

    :param dash_duo: The dash testing fixture.
    :param timeout: The maximum wait in seconds.
    """
    WebDriverWait(dash_duo.driver, timeout).until(
        lambda _: dash_duo.redux_state_rqs == [], message="Dash callbacks did not finish"
    )


# =============================================================================
# Element Getters
# =============================================================================
def get_tabs(dash_duo):
    """Return the tab elements, without their close buttons."""
    return dash_duo.find_elements(TAB_SELECTOR)


def get_panels(dash_duo):
    """Return the panel elements."""
    return dash_duo.find_elements(PANEL_SELECTOR)


def get_tab_id(dash_duo, index: int = 0) -> str | None:
    """Return the ID of the tab at ``index``, or ``None`` if there is no such tab.

    :param dash_duo: The dash testing fixture.
    :param index: The index of the tab in the DOM order of all tabs.
    """
    tabs = get_tabs(dash_duo)
    if index < len(tabs):
        testid = tabs[index].get_attribute("data-testid")
        return testid.replace("prism-tab-", "") if testid else None
    return None


def get_panel_id(dash_duo, panel_index: int = 0) -> str | None:
    """Return the ID of the panel at ``panel_index``, or ``None`` if there is no such panel.

    :param dash_duo: The dash testing fixture.
    :param panel_index: The index of the panel in the DOM order.
    """
    panels = get_panels(dash_duo)
    if panel_index >= len(panels):
        return None

    testid = panels[panel_index].get_attribute("data-testid")
    return testid.replace("prism-panel-", "") if testid else None


def tab_trigger(tab_id: str) -> str:
    """Return the CSS selector of the trigger of a tab, the element that takes the focus."""
    return f"[data-testid='prism-tab-{tab_id}'] [role='tab']"


def get_tab_order_in_panel(dash_duo, panel_index: int = 0) -> list[str]:
    """Return the IDs of the tabs in a panel, in the order of the tab bar.

    :param dash_duo: The dash testing fixture.
    :param panel_index: The index of the panel in the DOM order.
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
    """Return whether the drop zones of a drag are in the DOM."""
    return bool(dash_duo.driver.find_elements(By.CSS_SELECTOR, DROP_ZONE_LEFT))


def check_browser_errors(dash_duo) -> list[dict[str, Any]]:
    """Return the console errors that the browser logged since the last call.

    :param dash_duo: The dash testing fixture.
    :returns: The log entries of level ``SEVERE``.
    """
    # get_logs filters by time only, whatever its docstring says.
    return [log for log in dash_duo.get_logs() if log["level"] == "SEVERE"]


# =============================================================================
# React Interaction Helpers
# =============================================================================
def trigger_rename_mode(dash_duo, tab_id: str) -> str:
    """Double-click a tab and wait for its rename input.

    :param dash_duo: The dash testing fixture.
    :param tab_id: The ID of the tab to rename.
    :returns: The CSS selector of the rename input.
    """
    # The onDoubleClick handler is on the inner TabsTrigger button, not on the
    # wrapper that has the test ID. A synthetic event on the button reaches it
    # without the pointer events that start a drag.
    trigger = dash_duo.find_element(tab_trigger(tab_id))
    dash_duo.driver.execute_script(
        "arguments[0].dispatchEvent(new MouseEvent('dblclick', "
        "{bubbles: true, cancelable: true, view: window, detail: 2}));",
        trigger,
    )
    rename_input = f"[data-testid='prism-tab-rename-{tab_id}']"
    dash_duo.wait_for_element(rename_input, timeout=5)
    return rename_input


def set_input_value_react(dash_duo, selector: str, value: str):
    """Set the value of a React controlled input and wait until the input shows it.

    React replaces the value property of an input, so a plain assignment does
    not reach its onChange handler. The native setter does.

    :param dash_duo: The dash testing fixture.
    :param selector: The CSS selector of the input.
    :param value: The value to set.
    """
    dash_duo.driver.execute_script(
        """
        var input = document.querySelector(arguments[0]);
        if (input) {
            input.focus();
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(input, arguments[1]);

            // React listens for 'input', other handlers for 'change'.
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        """,
        selector,
        value,
    )

    WebDriverWait(dash_duo.driver, 2.0).until(
        lambda d: d.find_element(By.CSS_SELECTOR, selector).get_attribute("value") == value,
        message=f"Value '{value}' was not set on element '{selector}'",
    )


def press_enter_on_element(dash_duo, selector: str):
    """Send an Enter keydown event to the element that matches ``selector``.

    :param dash_duo: The dash testing fixture.
    :param selector: The CSS selector of the element.
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
    """Press Tab until the element that matches ``selector`` has focus.

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


def create_tabs_for_dnd_test(dash_duo, count: int = 3) -> list[str]:
    """Add tabs until the workspace holds ``count`` tabs.

    :param dash_duo: The dash testing fixture.
    :param count: The number of tabs, the initial tab included.
    :returns: The IDs of the tabs, in order.
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
    """Drag a tab onto another tab of the same panel, so the tabs change places.

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
    """Drag a tab onto an edge drop zone of a panel, so the panel splits.

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
    """Start a drag of a tab and keep the mouse pressed.

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


# The live region of dnd-kit holds the last announcement of a drag.
_DND_ANNOUNCEMENT = "return document.querySelector(\"[id^='DndLiveRegion']\")?.textContent ?? '';"


def dnd_announcement(dash_duo) -> str:
    """Return the last announcement of dnd-kit for a screen reader."""
    return dash_duo.driver.execute_script(_DND_ANNOUNCEMENT)


def press_drag_key(dash_duo, key: str, announcement: str) -> None:
    """Press a key of a keyboard drag and wait until dnd-kit announces the result.

    A keyboard drag changes its target one render after the key, so a test waits for
    the announcement before the next key.

    :param dash_duo: The dash testing fixture.
    :param key: The key to press.
    :param announcement: A part of the announcement that the key causes.
    """
    press_key(dash_duo, key)
    WebDriverWait(dash_duo.driver, 5).until(
        lambda _: announcement in dnd_announcement(dash_duo),
        message=f"dnd-kit should announce {announcement!r} after the key",
    )


# =============================================================================
# Common Interaction Helpers
# =============================================================================
def get_modifier_key():
    """Return the modifier key of the shortcuts: Command on macOS, Control elsewhere."""
    return Keys.COMMAND if platform.system() == "Darwin" else Keys.CONTROL


def open_context_menu(dash_duo, tab_element):
    """Right-click a tab and wait until its context menu is visible.

    :param dash_duo: The dash testing fixture.
    :param tab_element: The tab element.
    """
    ActionChains(dash_duo.driver).context_click(tab_element).perform()
    WebDriverWait(dash_duo.driver, 3).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, CONTEXT_MENU))
    )
