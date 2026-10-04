"""Integration tests for the showStatusBar prop (doc 03 §3.1)."""

from __future__ import annotations

import pytest
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

HELP_BUTTON = "[data-testid='prism-statusbar-help']"
RESET_BUTTON = "[data-testid='prism-statusbar-reset']"
UNDO_BUTTON = "[data-testid='prism-statusbar-undo']"
TAB_SEGMENT = "[data-testid='prism-statusbar-tab']"
POPOVER = "[data-slot='popover-content']"
ACTION_BUTTON = "[data-testid='prism-action-save']"


def _start(dash_duo, items: list[str] | None = None) -> None:
    testutils.start_prism(
        dash_duo, statusBarItems=items, actions=[dash_prism.Action(id="save", label="Save")]
    )


def test_status_bar_hidden(dash_duo):
    # The actions show that the hidden bar renders nothing. Prism warns about them on purpose.
    with pytest.warns(UserWarning, match="showStatusBar=False"):
        testutils.start_prism(
            dash_duo,
            showStatusBar=False,
            actions=[dash_prism.Action(id="save", label="Save")],
        )
    dash_duo.wait_for_element(testutils.ADD_TAB_BUTTON, timeout=10)

    assert dash_duo.find_elements(HELP_BUTTON) == []
    assert dash_duo.find_elements(UNDO_BUTTON) == []
    assert dash_duo.find_elements(ACTION_BUTTON) == []

    # The workspace itself keeps working
    dash_duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(dash_duo, 2)
    assert testutils.check_browser_errors(dash_duo) == []


def test_status_bar_icon_buttons_have_accessible_names(dash_duo):
    _start(dash_duo)
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)

    # The buttons show only an icon, so the name is the only text a screen reader gets.
    assert dash_duo.find_element(RESET_BUTTON).accessible_name == "Reset workspace"
    assert dash_duo.find_element(HELP_BUTTON).accessible_name == "Help"
    assert dash_duo.find_element(UNDO_BUTTON).accessible_name == "Undo last change"


@pytest.mark.parametrize("key", [Keys.ENTER, Keys.SPACE], ids=["enter", "space"])
def test_status_bar_tab_segment_opens_its_popover_from_the_keyboard(dash_duo, key):
    _start(dash_duo)
    dash_duo.wait_for_element(TAB_SEGMENT, timeout=10)

    segment = dash_duo.find_element(TAB_SEGMENT)
    assert segment.tag_name == "button"
    assert segment.get_attribute("aria-expanded") == "false"

    testutils.tab_to(dash_duo, TAB_SEGMENT)
    testutils.press_key(dash_duo, key)

    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.find_element("css selector", TAB_SEGMENT).get_attribute(
            "aria-expanded"
        )
        == "true",
        message="The popover should open when Enter or Space presses the segment",
    )
    assert "Tab ID" in dash_duo.find_element(POPOVER).text
    assert testutils.check_browser_errors(dash_duo) == []


def test_help_dialog_sections_are_h3_headings_under_the_h2_title(dash_duo):
    _start(dash_duo)
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)

    dash_duo.find_element(HELP_BUTTON).click()
    dash_duo.wait_for_element("[role='dialog']", timeout=5)

    dialog = dash_duo.find_element("[role='dialog']")
    assert [h.text for h in dialog.find_elements("css selector", "h2")] == ["Prism"]
    # The stylesheet upper-cases the section headings.
    h3_texts = [h.text.lower() for h in dialog.find_elements("css selector", "h3")]
    assert "tab management" in h3_texts
    assert dialog.find_elements("css selector", "h4") == []


def test_status_bar_dividers_are_decoration_not_text(dash_duo):
    _start(dash_duo)
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)

    # A literal "|" in the text would be read aloud between every pair of segments.
    assert "|" not in dash_duo.find_element(".prism-status-bar").text
    dividers = dash_duo.find_elements(".prism-status-bar [data-orientation='vertical']")
    assert dividers, "The status bar should still draw dividers"
    assert all(divider.get_attribute("role") == "none" for divider in dividers)


def _segment_order(dash_duo) -> list[str]:
    """Names of the status bar segments, in the order they appear in the DOM."""
    testids = dash_duo.driver.execute_script(
        "return Array.from("
        "  document.querySelectorAll('.prism-status-bar [data-testid^=\"prism-statusbar-\"]')"
        ").map(el => el.getAttribute('data-testid'));"
    )
    return [testid.removeprefix("prism-statusbar-") for testid in testids]


def test_status_bar_shown_by_default(dash_duo):
    _start(dash_duo)
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)
    assert testutils.check_browser_errors(dash_duo) == []


def test_status_bar_items_selects_segments(dash_duo):
    _start(dash_duo, ["count", "help"])
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)
    dash_duo.wait_for_element("[data-testid='prism-statusbar-count']", timeout=10)

    for hidden in ("reset", "undo", "mode", "panels", "tab", "updated"):
        assert dash_duo.find_elements(f"[data-testid='prism-statusbar-{hidden}']") == []
    # Actions are always appended
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)

    assert _segment_order(dash_duo) == ["count", "help"]
    assert testutils.check_browser_errors(dash_duo) == []


def test_status_bar_items_follows_the_listed_order(dash_duo):
    """The prop is an ordered subset: reversing the list reverses the bar."""
    _start(dash_duo, ["help", "count"])
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)

    assert _segment_order(dash_duo) == ["help", "count"]
    assert testutils.check_browser_errors(dash_duo) == []


def test_status_bar_items_keeps_updated_on_the_right(dash_duo):
    """'updated' is pinned right whatever position it is listed in."""
    _start(dash_duo, ["updated", "count", "reset"])
    dash_duo.wait_for_element("[data-testid='prism-statusbar-updated']", timeout=10)

    assert _segment_order(dash_duo) == ["count", "reset", "updated"]
    assert testutils.check_browser_errors(dash_duo) == []


def test_status_bar_items_empty_leaves_only_actions(dash_duo):
    _start(dash_duo, [])
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)

    for hidden in ("reset", "help", "undo", "mode", "panels", "tab", "count", "updated"):
        assert dash_duo.find_elements(f"[data-testid='prism-statusbar-{hidden}']") == []
    assert testutils.check_browser_errors(dash_duo) == []
