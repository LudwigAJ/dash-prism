"""Integration tests for the showStatusBar prop (doc 03 §3.1)."""

from __future__ import annotations

import warnings

import pytest
from dash import Dash, html
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism

from conftest import (
    ADD_TAB_BUTTON,
    PRISM_ROOT,
    check_browser_errors,
    get_free_port,
    press_key,
    tab_to,
    wait_for_tab_count,
)

pytestmark = pytest.mark.integration

HELP_BUTTON = "[data-testid='prism-statusbar-help']"
RESET_BUTTON = "[data-testid='prism-statusbar-reset']"
UNDO_BUTTON = "[data-testid='prism-statusbar-undo']"
TAB_SEGMENT = "[data-testid='prism-statusbar-tab']"
POPOVER = "[data-slot='popover-content']"
ACTION_BUTTON = "[data-testid='prism-action-save']"


def _app(show_status_bar: bool, items: list[str] | None = None) -> Dash:
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    # Passing actions with showStatusBar=False warns on purpose (covered by the
    # unit tests); here we only care that the buttons are not rendered.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        prism = dash_prism.Prism(
            id="prism",
            showStatusBar=show_status_bar,
            statusBarItems=items,
            actions=[dash_prism.Action(id="save", label="Save")],
            persistence=False,
            persistence_type="memory",
            style={"height": "100vh"},
        )
    app.layout = html.Div([prism], style={"height": "100vh"})
    dash_prism.init("prism", app)
    return app


def test_status_bar_hidden(dash_duo):
    dash_duo.start_server(_app(False), port=get_free_port())
    dash_duo.wait_for_element(PRISM_ROOT, timeout=10)
    dash_duo.wait_for_element(ADD_TAB_BUTTON, timeout=10)

    assert dash_duo.find_elements(HELP_BUTTON) == []
    assert dash_duo.find_elements(UNDO_BUTTON) == []
    assert dash_duo.find_elements(ACTION_BUTTON) == []

    # The workspace itself keeps working
    dash_duo.find_element(ADD_TAB_BUTTON).click()
    wait_for_tab_count(dash_duo, 2)
    assert check_browser_errors(dash_duo) == []


def test_status_bar_icon_buttons_have_accessible_names(dash_duo):
    dash_duo.start_server(_app(True), port=get_free_port())
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)

    # The buttons show only an icon, so the name is the only text a screen reader gets.
    assert dash_duo.find_element(RESET_BUTTON).accessible_name == "Reset workspace"
    assert dash_duo.find_element(HELP_BUTTON).accessible_name == "Help"
    assert dash_duo.find_element(UNDO_BUTTON).accessible_name == "Undo last change"


@pytest.mark.parametrize("key", [Keys.ENTER, Keys.SPACE], ids=["enter", "space"])
def test_status_bar_tab_segment_opens_its_popover_from_the_keyboard(dash_duo, key):
    dash_duo.start_server(_app(True), port=get_free_port())
    dash_duo.wait_for_element(TAB_SEGMENT, timeout=10)

    segment = dash_duo.find_element(TAB_SEGMENT)
    assert segment.tag_name == "button"
    assert segment.get_attribute("aria-expanded") == "false"

    tab_to(dash_duo, TAB_SEGMENT)
    press_key(dash_duo, key)

    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.find_element("css selector", TAB_SEGMENT).get_attribute(
            "aria-expanded"
        )
        == "true",
        message="The popover should open when Enter or Space presses the segment",
    )
    assert "Tab ID" in dash_duo.find_element(POPOVER).text
    assert check_browser_errors(dash_duo) == []


def test_status_bar_dividers_are_decoration_not_text(dash_duo):
    dash_duo.start_server(_app(True), port=get_free_port())
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
    dash_duo.start_server(_app(True), port=get_free_port())
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)
    assert check_browser_errors(dash_duo) == []


def test_status_bar_items_selects_segments(dash_duo):
    dash_duo.start_server(_app(True, ["count", "help"]), port=get_free_port())
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)
    dash_duo.wait_for_element("[data-testid='prism-statusbar-count']", timeout=10)

    for hidden in ("reset", "undo", "mode", "panels", "tab", "updated"):
        assert dash_duo.find_elements(f"[data-testid='prism-statusbar-{hidden}']") == []
    # Actions are always appended
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)

    assert _segment_order(dash_duo) == ["count", "help"]
    assert check_browser_errors(dash_duo) == []


def test_status_bar_items_follows_the_listed_order(dash_duo):
    """The prop is an ordered subset: reversing the list reverses the bar."""
    dash_duo.start_server(_app(True, ["help", "count"]), port=get_free_port())
    dash_duo.wait_for_element(HELP_BUTTON, timeout=10)

    assert _segment_order(dash_duo) == ["help", "count"]
    assert check_browser_errors(dash_duo) == []


def test_status_bar_items_keeps_updated_on_the_right(dash_duo):
    """'updated' is pinned right whatever position it is listed in."""
    dash_duo.start_server(_app(True, ["updated", "count", "reset"]), port=get_free_port())
    dash_duo.wait_for_element("[data-testid='prism-statusbar-updated']", timeout=10)

    assert _segment_order(dash_duo) == ["count", "reset", "updated"]
    assert check_browser_errors(dash_duo) == []


def test_status_bar_items_empty_leaves_only_actions(dash_duo):
    dash_duo.start_server(_app(True, []), port=get_free_port())
    dash_duo.wait_for_element(ACTION_BUTTON, timeout=10)

    for hidden in ("reset", "help", "undo", "mode", "panels", "tab", "count", "updated"):
        assert dash_duo.find_elements(f"[data-testid='prism-statusbar-{hidden}']") == []
    assert check_browser_errors(dash_duo) == []
