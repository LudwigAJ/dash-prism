"""Integration tests for typed layout parameters in the search bar (doc 04 §3.8)."""

from __future__ import annotations

import base64
import json
from typing import Literal

import pytest
from dash import Dash, html
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.keys import Keys
import dash_prism

from conftest import (
    PRISM_ROOT,
    SEARCHBAR_INPUT,
    check_browser_errors,
    get_free_port,
    set_input_value_react,
    wait_for_tab_count,
)

pytestmark = pytest.mark.integration

PARAM_INPUT = "[data-testid='prism-searchbar-param-input']"
PARAM_ERROR = "[data-testid='prism-searchbar-param-error']"
CHOICE = "[data-testid='prism-searchbar-param-choice-{}']"


def _start(dash_duo):
    app = Dash(__name__, suppress_callback_exceptions=True)

    @dash_prism.register_layout(id="typed", name="Typed", allow_multiple=True)
    def typed_layout(n: int = 1, kind: Literal["bar", "line"] = "bar"):
        return html.Div(f"n={n!r} kind={kind!r}", id="typed-content")

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
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


def _enter_params_mode(duo) -> None:
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(SEARCHBAR_INPUT, timeout=3)
    duo.find_element(SEARCHBAR_INPUT).send_keys("Typed")
    duo.wait_for_element("[data-testid='prism-layout-item-typed']", timeout=5)
    duo.find_element("[data-testid='prism-layout-item-typed']").click()
    duo.wait_for_element(PARAM_INPUT, timeout=5)


def _share_hash(params: dict) -> str:
    payload = json.dumps({"layoutId": "typed", "name": "Shared", "layoutParams": params})
    return "#p:" + base64.b64encode(payload.encode("utf-8")).decode("ascii")


def test_invalid_input_is_flagged_inline_and_valid_input_advances(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    # n: int -> "abc" is rejected before the tab is created
    set_input_value_react(duo, PARAM_INPUT, "abc")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)
    duo.wait_for_element(PARAM_ERROR, timeout=5)
    assert "whole number" in duo.find_element(PARAM_ERROR).text
    assert duo.find_elements("[id*='typed-content']") == []

    # A valid value advances to the enum parameter, which offers a choice list
    set_input_value_react(duo, PARAM_INPUT, "5")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)
    duo.wait_for_element(CHOICE.format("line"), timeout=5)
    duo.find_element(CHOICE.format("line")).click()

    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=5 kind='line'" in duo.find_element("[id*='typed-content']").text
    assert check_browser_errors(duo) == []


def test_empty_input_uses_the_callback_default(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)  # n omitted -> default 1
    duo.wait_for_element(CHOICE.format("bar"), timeout=5)
    duo.find_element(PARAM_INPUT).send_keys("li", Keys.ENTER)  # unique prefix -> 'line'

    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=1 kind='line'" in duo.find_element("[id*='typed-content']").text
    assert check_browser_errors(duo) == []


def test_share_link_parameters_are_validated(dash_duo):
    duo = _start(dash_duo)
    base = duo.driver.current_url.split("#")[0]

    duo.driver.get(base + _share_hash({"n": "x"}))
    with pytest.raises(TimeoutException):
        wait_for_tab_count(duo, 2, timeout=2.0)
    assert "Invalid parameters" in duo.find_element("body").text

    duo.driver.get(base + _share_hash({"n": "5", "kind": "bar"}))
    wait_for_tab_count(duo, 2, timeout=10)
    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=5 kind='bar'" in duo.find_element("[id*='typed-content']").text
