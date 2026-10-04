"""Integration tests for keyboard shortcuts.

Tests Cmd/Ctrl+Alt+N (new tab), Cmd/Ctrl+D (close tab).
"""

from __future__ import annotations

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration


def test_keyboard_shortcut_new_tab(prism_app_with_layouts):
    """Test Cmd/Ctrl+Alt+N creates a new tab.

    Plain Cmd/Ctrl+N is a browser-reserved shortcut that Chrome never delivers
    to the page, so Prism binds a three-key chord instead.
    """
    duo = prism_app_with_layouts
    assert len(testutils.get_tabs(duo)) == 1, "Should start with 1 initial tab"

    modifier = testutils.get_modifier_key()
    body = duo.find_element("body")

    # The old binding must be gone: plain modifier+N does nothing in Prism
    body.send_keys(modifier, "n")
    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 2, timeout=1.5)
    assert len(testutils.get_tabs(duo)) == 1, "Cmd/Ctrl+N must no longer create a tab"

    body.send_keys(modifier, Keys.ALT, "n")
    testutils.wait_for_tab_count(duo, 2, timeout=5)


def test_keyboard_shortcut_close_tab(prism_app_with_layouts):
    """Test Cmd/Ctrl+D closes active tab when multiple tabs exist."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    duo.find_element("body").send_keys(testutils.get_modifier_key(), "d")

    testutils.wait_for_tab_count(duo, 1, timeout=5)


def test_shortcuts_do_not_fire_while_a_context_menu_is_open(prism_app_with_layouts):
    """An open menu owns the keyboard: Ctrl+D must not close the tab behind it.

    Radix portals the menu to document.body, outside every Prism root, so the
    window-level shortcut listener used to act on the workspace underneath.
    """
    duo = prism_app_with_layouts

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)

    testutils.open_context_menu(duo, testutils.get_tabs(duo)[0])

    modifier = testutils.get_modifier_key()
    duo.find_element(testutils.CONTEXT_MENU).send_keys(modifier, "d")

    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 1, timeout=1.5)
    assert len(testutils.get_tabs(duo)) == 2, "Ctrl/Cmd+D must be ignored while a menu is open"

    # Closing the menu hands the keyboard back.
    duo.find_element("body").send_keys(Keys.ESCAPE)
    testutils.wait_for_element_invisible(duo, testutils.CONTEXT_MENU, timeout=3)
    duo.find_element("body").send_keys(modifier, "d")
    testutils.wait_for_tab_count(duo, 1, timeout=5)


def test_ctrl_space_focuses_the_search_bar_of_the_active_panel(prism_app_with_layouts):
    """Ctrl+Space puts the focus in the search bar of the active panel only."""
    duo = prism_app_with_layouts
    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()
    testutils.wait_for_panel_count(duo, 2)
    testutils.wait_for_tab_count(duo, 2)

    panel_of = "return arguments[0].closest(\"[data-testid^='prism-panel-']\").dataset.testid;"
    focused = (
        "var el = document.activeElement;"
        "var panel = el.closest(\"[data-testid^='prism-panel-']\");"
        "return [el.dataset.testid, panel && panel.dataset.testid];"
    )

    for index in (1, 0):
        tab = testutils.get_tabs(duo)[index]
        tab.click()
        expected = ["prism-searchbar-input", duo.driver.execute_script(panel_of, tab)]

        duo.find_element("body").send_keys(Keys.CONTROL, Keys.SPACE)
        WebDriverWait(duo.driver, 5).until(
            lambda driver: driver.execute_script(focused) == expected,
            message=f"Ctrl+Space should focus the search bar of the panel of tab {index}",
        )


def test_keyboard_shortcuts_can_be_disabled(dash_duo):
    """enableKeyboardShortcuts=False installs no listener and hides the help section."""
    duo = testutils.start_prism(dash_duo, enableKeyboardShortcuts=False)
    testutils.wait_for_tab_count(duo, 1)

    body = duo.find_element("body")
    body.send_keys(testutils.get_modifier_key(), Keys.ALT, "n")
    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 2, timeout=1.5)
    assert len(testutils.get_tabs(duo)) == 1

    # The help dialog no longer lists the shortcuts.
    duo.find_element(testutils.HELP_BUTTON).click()
    duo.wait_for_element("[role='dialog']", timeout=5)
    # Section titles are rendered uppercase via CSS; compare case-insensitively.
    dialog_text = duo.find_element("[role='dialog']").text.lower()
    assert "tab management" in dialog_text
    assert "keyboard shortcuts" not in dialog_text


@pytest.mark.parametrize(
    ("platform", "rename", "refresh"),
    [
        ("MacIntel", ["⌃", "R"], ["⌃", "⇧", "R"]),
        ("Win32", ["Ctrl", "R"], ["Ctrl", "Shift", "R"]),
    ],
)
def test_help_and_context_menu_show_the_keys_of_the_platform(
    prism_app_with_layouts, platform, rename, refresh
):
    """The help modal and the tab context menu read one shortcut table.

    macOS shows the menu symbols and the other platforms show words, in both places.
    """
    duo = prism_app_with_layouts
    user_agent = duo.driver.execute_script("return navigator.userAgent;")
    duo.driver.execute_cdp_cmd(
        "Emulation.setUserAgentOverride", {"userAgent": user_agent, "platform": platform}
    )
    duo.driver.refresh()
    testutils.wait_for_tab_count(duo, 1)
    assert duo.driver.execute_script("return navigator.platform;") == platform

    duo.find_element(testutils.HELP_BUTTON).click()
    rows = duo.wait_for_element("[data-testid='prism-help-shortcuts']", timeout=5)
    keys_by_label = {
        row.find_element(By.CSS_SELECTOR, "span").text: [
            kbd.text for kbd in row.find_elements(By.CSS_SELECTOR, "kbd")
        ]
        for row in rows.find_elements(By.XPATH, "./div")
    }
    assert keys_by_label["Rename tab"] == rename
    assert keys_by_label["Refresh tab"] == refresh

    duo.find_element("body").send_keys(Keys.ESCAPE)
    testutils.wait_for_element_invisible(duo, "[role='dialog']", timeout=3)
    testutils.open_context_menu(duo, testutils.get_tabs(duo)[0])
    rename_item = duo.find_element("[data-testid='prism-context-menu-rename']")
    separator = "" if platform == "MacIntel" else "+"
    assert rename_item.text.splitlines()[-1] == separator.join(rename)
