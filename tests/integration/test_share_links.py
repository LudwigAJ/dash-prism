"""Integration tests for the enableShareLinks prop."""

from __future__ import annotations

import base64
import json

import pytest
from dash import html
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.keys import Keys

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

SHARE_ITEM = "[data-testid='prism-context-menu-share']"


def _share_hash(layout_id: str, name: str) -> str:
    payload = json.dumps({"layoutId": layout_id, "name": name}, separators=(",", ":"))
    return "#p:" + base64.b64encode(payload.encode("utf-8")).decode("ascii")


def _start(dash_duo, enable_share_links: bool, *, allow_multiple: bool = True, **prism_props):
    dash_prism.register_layout(
        id="home",
        name="Home",
        allow_multiple=allow_multiple,
        layout=html.Div("Home", id="home-content"),
    )
    return testutils.start_prism(
        dash_duo, layouts={}, enableShareLinks=enable_share_links, **prism_props
    )


def _open_home(duo) -> None:
    duo.find_element(".prism-search-bar").click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys("home")
    duo.wait_for_element("[data-testid='prism-layout-item-home']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-home']").click()
    duo.wait_for_element("[id*='home-content']", timeout=10)


def test_share_links_enabled_by_default(dash_duo):
    duo = _start(dash_duo, True)
    _open_home(duo)

    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))
    duo.wait_for_element(SHARE_ITEM, timeout=3)
    duo.find_element("body").send_keys(Keys.ESCAPE)

    # A share hash opens the layout in a new tab
    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "Shared"))
    testutils.wait_for_tab_count(duo, 2, timeout=10)


def test_share_links_disabled(dash_duo):
    duo = _start(dash_duo, False)
    _open_home(duo)

    testutils.open_context_menu(duo, duo.find_element(testutils.TAB_SELECTOR))
    assert duo.find_elements(SHARE_ITEM) == []
    duo.find_element("body").send_keys(Keys.ESCAPE)

    # A share hash is ignored
    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "Shared"))
    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 2, timeout=2.0)
    assert len(duo.find_elements(testutils.TAB_SELECTOR)) == 1
    # ...and left in the URL rather than consumed
    assert "#p:" in duo.driver.current_url


def _load_with_hash(duo, share_hash: str) -> None:
    """Load the page afresh with the hash already in the URL.

    Changing only the fragment is a same-document navigation: the page is not
    reloaded, so only the hashchange listener runs. A different query string
    forces a real load, which is the path a user takes when they paste a share
    link into a new browser tab, and the mount effect handles it instead.
    """
    base = duo.driver.current_url.split("#")[0].split("?")[0]
    duo.driver.get(f"{base}?reload=1{share_hash}")
    duo.wait_for_element(testutils.PRISM_ROOT, timeout=10)


def test_share_link_opens_on_a_cold_load(dash_duo):
    """Pasting a share link into a fresh browser tab opens the layout."""
    duo = _start(dash_duo, True)
    _load_with_hash(duo, _share_hash("home", "Shared"))

    # A fresh workspace starts with one empty tab; the shared one is the second.
    testutils.wait_for_tab_count(duo, 2, timeout=10)
    assert "Shared" in duo.find_element(testutils.PRISM_ROOT).text


def test_share_link_is_ignored_on_a_cold_load_when_disabled(dash_duo):
    """The same paste does nothing when the prop is off."""
    duo = _start(dash_duo, False)
    _load_with_hash(duo, _share_hash("home", "Shared"))

    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 2, timeout=2.0)
    assert len(duo.find_elements(testutils.TAB_SELECTOR)) == 1
    assert "#p:" in duo.driver.current_url


def test_invalid_share_link_on_a_cold_load_shows_one_error(dash_duo):
    """An invalid link shows one error toast, and the hash stays in the URL.

    React StrictMode runs the effect that reads the hash two times.
    """
    duo = _start(dash_duo, True)
    _load_with_hash(duo, "#p:not-base64!")

    duo.wait_for_contains_text(testutils.TOAST, "Invalid share link: decoding failed", timeout=10)
    assert len(duo.find_elements(testutils.TOAST)) == 1
    assert len(duo.find_elements(testutils.TAB_SELECTOR)) == 1
    assert "#p:" in duo.driver.current_url


def test_share_link_at_the_tab_limit_shows_the_limit_and_no_success(dash_duo):
    """The tab limit refuses the share link, and the thunk tells the user why."""
    duo = _start(dash_duo, True, maxTabs=2)
    _open_home(duo)

    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "First"))
    testutils.wait_for_tab_count(duo, 2, timeout=10)

    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "Second"))
    duo.wait_for_contains_text(testutils.TOAST, "Maximum tabs limit reached (2)", timeout=10)

    toast_text = " ".join(t.text for t in duo.find_elements(testutils.TOAST))
    assert "Opened shared tab: Second" not in toast_text
    assert len(duo.find_elements(testutils.TAB_SELECTOR)) == 2


def test_share_link_to_an_open_single_instance_layout_switches_to_it(dash_duo):
    """A layout with allow_multiple=False is not opened twice by a share link."""
    duo = _start(dash_duo, True, allow_multiple=False)
    _open_home(duo)

    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "Again"))
    duo.wait_for_contains_text(testutils.TOAST, "is already open. Switching to it.", timeout=10)

    assert len(duo.find_elements(testutils.TAB_SELECTOR)) == 1
