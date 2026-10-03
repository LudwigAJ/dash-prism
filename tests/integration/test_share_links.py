"""Integration tests for the enableShareLinks prop (doc 03 §3.1)."""

from __future__ import annotations

import base64
import json

import pytest
from dash import Dash, html
from selenium.common.exceptions import TimeoutException

import dash_prism

from conftest import (
    PRISM_ROOT,
    SEARCHBAR_INPUT,
    TAB_SELECTOR,
    check_browser_errors,
    get_free_port,
    open_context_menu,
    wait_for_tab_count,
)

pytestmark = pytest.mark.integration

SHARE_ITEM = "[data-testid='prism-context-menu-share']"


def _share_hash(layout_id: str, name: str) -> str:
    payload = json.dumps({"layoutId": layout_id, "name": name}, separators=(",", ":"))
    return "#p:" + base64.b64encode(payload.encode("utf-8")).decode("ascii")


def _start(dash_duo, enable_share_links: bool):
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(
        id="home", name="Home", allow_multiple=True, layout=html.Div("Home", id="home-content")
    )
    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                enableShareLinks=enable_share_links,
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
    return dash_duo


def _open_home(duo) -> None:
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)
    duo.find_element(SEARCHBAR_INPUT).send_keys("home")
    duo.wait_for_element("[data-testid='prism-layout-item-home']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-home']").click()
    duo.wait_for_element("[id*='home-content']", timeout=10)


def test_share_links_enabled_by_default(dash_duo):
    duo = _start(dash_duo, True)
    _open_home(duo)

    open_context_menu(duo, duo.find_element(TAB_SELECTOR))
    duo.wait_for_element(SHARE_ITEM, timeout=3)
    duo.find_element("body").send_keys("\ue00c")  # Escape closes the menu

    # A share hash opens the layout in a new tab
    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "Shared"))
    wait_for_tab_count(duo, 2, timeout=10)
    assert check_browser_errors(duo) == []


def test_share_links_disabled(dash_duo):
    duo = _start(dash_duo, False)
    _open_home(duo)

    open_context_menu(duo, duo.find_element(TAB_SELECTOR))
    assert duo.find_elements(SHARE_ITEM) == []
    duo.find_element("body").send_keys("\ue00c")

    # A share hash is ignored
    duo.driver.get(duo.driver.current_url.split("#")[0] + _share_hash("home", "Shared"))
    with pytest.raises(TimeoutException):
        wait_for_tab_count(duo, 2, timeout=2.0)
    assert len(duo.find_elements(TAB_SELECTOR)) == 1
    # ...and left in the URL rather than consumed
    assert "#p:" in duo.driver.current_url
    assert check_browser_errors(duo) == []


def _load_with_hash(duo, share_hash: str) -> None:
    """Load the page afresh with the hash already in the URL.

    Changing only the fragment is a same-document navigation: the page is not
    reloaded, so only the hashchange listener runs. A different query string
    forces a real load, which is the path a user takes when they paste a share
    link into a new browser tab, and it is handled by the mount timer instead.
    """
    base = duo.driver.current_url.split("#")[0].split("?")[0]
    duo.driver.get(f"{base}?reload=1{share_hash}")
    duo.wait_for_element(PRISM_ROOT, timeout=10)


def test_share_link_opens_on_a_cold_load(dash_duo):
    """Pasting a share link into a fresh browser tab opens the layout."""
    duo = _start(dash_duo, True)
    _load_with_hash(duo, _share_hash("home", "Shared"))

    # A fresh workspace starts with one empty tab; the shared one is the second.
    wait_for_tab_count(duo, 2, timeout=10)
    assert "Shared" in duo.find_element(PRISM_ROOT).text
    assert check_browser_errors(duo) == []


def test_share_link_is_ignored_on_a_cold_load_when_disabled(dash_duo):
    """The same paste does nothing when the prop is off."""
    duo = _start(dash_duo, False)
    _load_with_hash(duo, _share_hash("home", "Shared"))

    with pytest.raises(TimeoutException):
        wait_for_tab_count(duo, 2, timeout=2.0)
    assert len(duo.find_elements(TAB_SELECTOR)) == 1
    assert "#p:" in duo.driver.current_url
    assert check_browser_errors(duo) == []
