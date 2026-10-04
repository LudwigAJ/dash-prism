"""
Integration tests for keyboard shortcuts.

Tests Cmd/Ctrl+Alt+N (new tab), Cmd/Ctrl+D (close tab).

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Keep tests isolated and focused
"""

from __future__ import annotations

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from conftest import (
    ADD_TAB_BUTTON,
    CONTEXT_MENU,
    SPLIT_PANEL_BUTTON,
    get_modifier_key,
    get_tabs,
    open_context_menu,
    wait_for_panel_count,
    wait_for_tab_count,
)

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


def _css(selector: str) -> tuple[str, str]:
    return (By.CSS_SELECTOR, selector)


def test_keyboard_shortcut_new_tab(prism_app_with_layouts):
    """Test Cmd/Ctrl+Alt+N creates a new tab (02 G-1).

    Plain Cmd/Ctrl+N is a browser-reserved shortcut that Chrome never delivers
    to the page, so Prism binds a three-key chord instead.
    """
    duo = prism_app_with_layouts

    # Prism starts with 1 initial tab
    initial_tabs = get_tabs(duo)
    assert len(initial_tabs) == 1, "Should start with 1 initial tab"

    modifier = get_modifier_key()
    body = duo.find_element("body")

    # The old binding must be gone: plain modifier+N does nothing in Prism
    body.send_keys(modifier, "n")
    with pytest.raises(TimeoutException):
        wait_for_tab_count(duo, 2, timeout=1.5)
    assert len(get_tabs(duo)) == 1, "Cmd/Ctrl+N must no longer create a tab"

    # Press the chord: Cmd+Option+N (Mac) or Ctrl+Alt+N (Windows/Linux)
    body.send_keys(modifier, Keys.ALT, "n")

    # Wait for new tab to appear (explicit wait)
    wait_for_tab_count(duo, 2, timeout=5)

    # Verify tab created
    tabs = get_tabs(duo)
    assert len(tabs) == 2, "Cmd/Ctrl+Alt+N should create new tab"


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


def test_shortcuts_do_not_fire_while_a_context_menu_is_open(prism_app_with_layouts):
    """An open menu owns the keyboard: Ctrl+D must not close the tab behind it.

    Radix portals the menu to document.body, outside every Prism root, so the
    window-level shortcut listener used to act on the workspace underneath
    (02 G-1).
    """
    duo = prism_app_with_layouts

    duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(duo, 2)

    open_context_menu(duo, get_tabs(duo)[0])

    modifier = get_modifier_key()
    duo.find_element(CONTEXT_MENU).send_keys(modifier, "d")

    with pytest.raises(TimeoutException):
        wait_for_tab_count(duo, 1, timeout=1.5)
    assert len(get_tabs(duo)) == 2, "Ctrl/Cmd+D must be ignored while a menu is open"

    # Closing the menu hands the keyboard back.
    duo.find_element("body").send_keys(Keys.ESCAPE)
    WebDriverWait(duo.driver, 3).until(lambda d: not d.find_elements(*_css(CONTEXT_MENU)))
    duo.find_element("body").send_keys(modifier, "d")
    wait_for_tab_count(duo, 1, timeout=5)


def test_ctrl_space_focuses_the_search_bar_of_the_active_panel(prism_app_with_layouts):
    """Ctrl+Space puts the focus in the search bar of the active panel only."""
    duo = prism_app_with_layouts
    duo.find_element(SPLIT_PANEL_BUTTON).click()
    wait_for_panel_count(duo, 2)
    wait_for_tab_count(duo, 2)

    panel_of = "return arguments[0].closest(\"[data-testid^='prism-panel-']\").dataset.testid;"
    focused = (
        "var el = document.activeElement;"
        "var panel = el.closest(\"[data-testid^='prism-panel-']\");"
        "return [el.dataset.testid, panel && panel.dataset.testid];"
    )

    for index in (1, 0):
        tab = get_tabs(duo)[index]
        tab.click()
        expected = ["prism-searchbar-input", duo.driver.execute_script(panel_of, tab)]

        duo.find_element("body").send_keys(Keys.CONTROL, Keys.SPACE)
        WebDriverWait(duo.driver, 5).until(
            lambda driver: driver.execute_script(focused) == expected,
            message=f"Ctrl+Space should focus the search bar of the panel of tab {index}",
        )


def test_keyboard_shortcuts_can_be_disabled(dash_duo):
    """enableKeyboardShortcuts=False installs no listener and hides the help section."""
    from dash import Dash, html

    app = Dash(__name__, suppress_callback_exceptions=True)
    import dash_prism

    from conftest import PRISM_ROOT, get_free_port

    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                enableKeyboardShortcuts=False,
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh"},
            )
        ],
        style={"height": "100vh"},
    )
    dash_prism.init("prism", app)
    dash_duo.start_server(app, port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    wait_for_tab_count(dash_duo, 1)

    body = dash_duo.find_element("body")
    body.send_keys(get_modifier_key(), Keys.ALT, "n")
    with pytest.raises(TimeoutException):
        wait_for_tab_count(dash_duo, 2, timeout=1.5)
    assert len(get_tabs(dash_duo)) == 1

    # Help dialog no longer advertises shortcuts
    dash_duo.find_element("[data-testid='prism-statusbar-help']").click()
    dash_duo.wait_for_element("[role='dialog']", timeout=5)
    # Section titles are rendered uppercase via CSS; compare case-insensitively.
    dialog_text = dash_duo.find_element("[role='dialog']").text.lower()
    assert "tab management" in dialog_text
    assert "keyboard shortcuts" not in dialog_text
