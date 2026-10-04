"""Integration tests for typed layout parameters in the search bar (doc 04 §3.8)."""

from __future__ import annotations

import base64
import json
from typing import Annotated, Literal, Optional

import pytest
from dash import html
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

PARAM_INPUT = "[data-testid='prism-searchbar-param-input']"
PARAM_ERROR = "[data-testid='prism-searchbar-param-error']"
CHOICE = "[data-testid='prism-searchbar-param-choice-{}']"


def _start(dash_duo):
    @dash_prism.register_layout(id="typed", name="Typed", allow_multiple=True)
    def typed_layout(n: int = 1, kind: Literal["bar", "line"] = "bar"):
        return html.Div(f"n={n!r} kind={kind!r}", id="typed-content")

    return testutils.start_prism(dash_duo, layouts={})


def _enter_params_mode(duo, search: str = "Typed", layout_id: str = "typed") -> None:
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys(search)
    duo.wait_for_element(f"[data-testid='prism-layout-item-{layout_id}']", timeout=5)
    duo.find_element(f"[data-testid='prism-layout-item-{layout_id}']").click()
    duo.wait_for_element(PARAM_INPUT, timeout=5)


def _share_hash(params: dict) -> str:
    payload = json.dumps({"layoutId": "typed", "name": "Shared", "layoutParams": params})
    return "#p:" + base64.b64encode(payload.encode("utf-8")).decode("ascii")


def test_invalid_input_is_flagged_inline_and_valid_input_advances(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    # n: int -> "abc" is rejected before the tab is created
    testutils.set_input_value_react(duo, PARAM_INPUT, "abc")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)
    duo.wait_for_element(PARAM_ERROR, timeout=5)
    assert "whole number" in duo.find_element(PARAM_ERROR).text
    assert duo.find_elements("[id*='typed-content']") == []

    # A valid value advances to the enum parameter, which offers a choice list
    testutils.set_input_value_react(duo, PARAM_INPUT, "5")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)
    duo.wait_for_element(CHOICE.format("line"), timeout=5)
    duo.find_element(CHOICE.format("line")).click()

    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=5 kind='line'" in duo.find_element("[id*='typed-content']").text
    assert testutils.check_browser_errors(duo) == []


def test_empty_input_uses_the_callback_default(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)  # n omitted -> default 1
    duo.wait_for_element(CHOICE.format("bar"), timeout=5)
    duo.find_element(PARAM_INPUT).send_keys("li", Keys.ENTER)  # unique prefix -> 'line'

    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=1 kind='line'" in duo.find_element("[id*='typed-content']").text
    assert testutils.check_browser_errors(duo) == []


def test_share_link_parameters_are_validated(dash_duo):
    duo = _start(dash_duo)
    base = duo.driver.current_url.split("#")[0]

    duo.driver.get(base + _share_hash({"n": "x"}))
    with pytest.raises(TimeoutException):
        testutils.wait_for_tab_count(duo, 2, timeout=2.0)
    assert "Invalid parameters" in duo.find_element("body").text

    duo.driver.get(base + _share_hash({"n": "5", "kind": "bar"}))
    testutils.wait_for_tab_count(duo, 2, timeout=10)
    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=5 kind='bar'" in duo.find_element("[id*='typed-content']").text


def _start_optional(dash_duo):
    """Serve a layout whose only parameter is Optional *and* carries choices."""

    @dash_prism.register_layout(id="optional", name="Optional", allow_multiple=True)
    def optional_layout(
        ticker: Annotated[Optional[str], dash_prism.Param(choices=["BTPS", "FRTR"])],
    ):
        return html.Div(f"ticker={ticker!r}", id="optional-content")

    return testutils.start_prism(dash_duo, layouts={})


def test_blank_is_accepted_for_an_optional_parameter_with_choices(dash_duo):
    """The blank the search bar offers must reach the callback as ``None``.

    The parameter has no default, so an empty input is submitted as "" rather
    than omitted, and the metadata marks it nullable so the search bar accepts
    it. The server built a bare ``Literal`` from the choices and lost the
    ``Optional``, so the submission landed on the invalid-parameters panel and
    no input could succeed except picking a choice.
    """
    duo = _start_optional(dash_duo)
    _enter_params_mode(duo, search="Optional", layout_id="optional")
    duo.wait_for_element(CHOICE.format("BTPS"), timeout=5)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)

    duo.wait_for_element("[id*='optional-content']", timeout=10)
    assert duo.find_element("[id*='optional-content']").text == "ticker=None"
    assert "Invalid parameters" not in duo.find_element("body").text
    assert testutils.check_browser_errors(duo) == []


def test_a_choice_still_reaches_an_optional_parameter_with_choices(dash_duo):
    """A picked choice arrives as itself, not as the blank.

    This does not catch widening -- a parameter relaxed to ``Any`` passes it
    too. ``test_optional_param_choices_still_reject_a_value_outside_the_list``
    is what guards that.
    """
    duo = _start_optional(dash_duo)
    _enter_params_mode(duo, search="Optional", layout_id="optional")
    duo.wait_for_element(CHOICE.format("FRTR"), timeout=5)

    duo.find_element(CHOICE.format("FRTR")).click()

    duo.wait_for_element("[id*='optional-content']", timeout=10)
    assert duo.find_element("[id*='optional-content']").text == "ticker='FRTR'"
    assert testutils.check_browser_errors(duo) == []


def _start_items(dash_duo):
    """Serve a layout that restricts its list's *items*, not the whole list."""

    @dash_prism.register_layout(id="items", name="Items", allow_multiple=True)
    def items_layout(tags: list[Literal["a", "b"]]):
        return html.Div(f"tags={tags!r}", id="items-content")

    return testutils.start_prism(dash_duo, layouts={})


def test_list_of_literal_items_accepts_a_valid_comma_separated_value(dash_duo):
    """``list[Literal['a', 'b']]`` is what the collection-choices error advises.

    Its metadata says ``items='enum'`` but carries no item-level choices, and
    the client checked each item against the *parameter's* choices -- which are
    empty -- so every value, including this one, was refused with "Must be one
    of: " before it could ever reach the server.
    """
    duo = _start_items(dash_duo)
    _enter_params_mode(duo, search="Items", layout_id="items")

    testutils.set_input_value_react(duo, PARAM_INPUT, "a,b")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)

    duo.wait_for_element("[id*='items-content']", timeout=10)
    assert duo.find_element("[id*='items-content']").text == "tags=['a', 'b']"
    assert testutils.check_browser_errors(duo) == []


def test_an_off_list_item_is_still_refused_by_the_server(dash_duo):
    """Handing the check to the server must not mean nothing checks it."""
    duo = _start_items(dash_duo)
    _enter_params_mode(duo, search="Items", layout_id="items")

    testutils.set_input_value_react(duo, PARAM_INPUT, "a,zzz")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)

    duo.wait_for_element("[data-testid='prism-validation-error']", timeout=10)
    panel = duo.find_element("[data-testid='prism-validation-error']").text
    assert "tags.1" in panel
    assert "Input should be 'a' or 'b'" in panel
    assert duo.find_elements("[id*='items-content']") == []


# =============================================================================
# Combobox pattern for the choice list
# =============================================================================
CHOICE_LIST = "[data-testid='prism-searchbar-param-choices']"
# Module level, because the annotations are strings that the registry resolves in the module.
MANY_CHOICES = [f"choice-{index:02d}" for index in range(40)]


def _active_option_id(duo) -> str | None:
    return duo.find_element(PARAM_INPUT).get_attribute("aria-activedescendant")


def _wait_for_active_choice(duo, choice: str) -> None:
    """Wait until the input points at the option of ``choice`` and that option is marked."""

    def points_at_choice(driver) -> bool:
        option = driver.find_element("css selector", CHOICE.format(choice))
        return (
            _active_option_id(duo) == option.get_attribute("id")
            and option.get_attribute("aria-selected") == "true"
        )

    WebDriverWait(duo.driver, 5).until(
        points_at_choice, message=f"The input should point at the option {choice!r}"
    )


def _to_the_choice_list(duo) -> None:
    """Answer the integer parameter so that the input offers the choices of the enum one."""
    _enter_params_mode(duo)
    testutils.set_input_value_react(duo, PARAM_INPUT, "5")
    duo.find_element(PARAM_INPUT).send_keys(Keys.ENTER)
    duo.wait_for_element(CHOICE.format("line"), timeout=5)


def test_choice_input_is_a_combobox_that_controls_the_list(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    # The integer parameter has no list, so its input stays a plain text box.
    number_input = duo.find_element(PARAM_INPUT)
    assert number_input.aria_role == "textbox"
    assert number_input.get_attribute("aria-expanded") is None

    testutils.set_input_value_react(duo, PARAM_INPUT, "5")
    number_input.send_keys(Keys.ENTER)
    duo.wait_for_element(CHOICE_LIST, timeout=5)

    combobox = duo.find_element(PARAM_INPUT)
    assert combobox.aria_role == "combobox"
    assert combobox.accessible_name == "kind"
    assert combobox.get_attribute("aria-expanded") == "true"
    assert combobox.get_attribute("aria-controls") == duo.find_element(CHOICE_LIST).get_attribute(
        "id"
    )
    assert _active_option_id(duo) is None
    assert duo.find_element(CHOICE_LIST).get_attribute("role") == "listbox"
    options = duo.find_elements(f"{CHOICE_LIST} [role='option']")
    assert [option.text for option in options] == ["bar", "line"]
    assert all(option.get_attribute("aria-selected") == "false" for option in options)


def test_arrow_keys_move_the_active_choice_and_enter_selects_it(dash_duo):
    duo = _start(dash_duo)
    _to_the_choice_list(duo)
    field = duo.find_element(PARAM_INPUT)

    field.send_keys(Keys.ARROW_DOWN)
    _wait_for_active_choice(duo, "bar")
    field.send_keys(Keys.ARROW_DOWN)
    _wait_for_active_choice(duo, "line")
    field.send_keys(Keys.ARROW_DOWN)  # wraps to the first choice
    _wait_for_active_choice(duo, "bar")
    field.send_keys(Keys.ARROW_UP)  # wraps to the last choice
    _wait_for_active_choice(duo, "line")
    assert duo.find_element(CHOICE.format("bar")).get_attribute("aria-selected") == "false"

    # Focus stays in the input the whole time, as the pattern requires.
    assert duo.driver.switch_to.active_element == field

    field.send_keys(Keys.ENTER)

    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=5 kind='line'" in duo.find_element("[id*='typed-content']").text
    assert testutils.check_browser_errors(duo) == []


def test_arrow_up_starts_at_the_last_choice(dash_duo):
    duo = _start(dash_duo)
    _to_the_choice_list(duo)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ARROW_UP)

    _wait_for_active_choice(duo, "line")


def test_typing_drops_the_active_choice_and_enter_submits_the_text(dash_duo):
    duo = _start(dash_duo)
    _to_the_choice_list(duo)
    field = duo.find_element(PARAM_INPUT)
    field.send_keys(Keys.ARROW_DOWN)
    _wait_for_active_choice(duo, "bar")

    field.send_keys("li")
    WebDriverWait(duo.driver, 5).until(
        lambda driver: _active_option_id(duo) is None,
        message="Typing should drop the active choice",
    )
    field.send_keys(Keys.ENTER)  # the unique prefix "li" means 'line', not the marked 'bar'

    duo.wait_for_element("[id*='typed-content']", timeout=10)
    assert "n=5 kind='line'" in duo.find_element("[id*='typed-content']").text


def test_escape_clears_the_marked_choice_before_it_leaves_the_prompt(dash_duo):
    duo = _start(dash_duo)
    _to_the_choice_list(duo)
    field = duo.find_element(PARAM_INPUT)
    field.send_keys(Keys.ARROW_DOWN)
    _wait_for_active_choice(duo, "bar")

    field.send_keys(Keys.ESCAPE)

    WebDriverWait(duo.driver, 5).until(
        lambda driver: _active_option_id(duo) is None,
        message="The first Escape should clear the marked choice",
    )
    assert duo.find_elements(PARAM_INPUT), "The first Escape should keep the prompt open"
    assert duo.find_elements(CHOICE_LIST)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ESCAPE)

    WebDriverWait(duo.driver, 5).until(
        lambda driver: driver.find_elements("css selector", PARAM_INPUT) == [],
        message="The second Escape should leave the prompt",
    )
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)


def test_hovering_a_choice_marks_it_and_the_arrow_keys_continue_from_there(dash_duo):
    duo = _start(dash_duo)
    _to_the_choice_list(duo)
    field = duo.find_element(PARAM_INPUT)
    field.send_keys(Keys.ARROW_DOWN)
    _wait_for_active_choice(duo, "bar")

    ActionChains(duo.driver).move_to_element(duo.find_element(CHOICE.format("line"))).perform()
    _wait_for_active_choice(duo, "line")
    marked = duo.find_elements(f"{CHOICE_LIST} [aria-selected='true']")
    assert [option.text for option in marked] == ["line"], "Only one option may look marked"

    field.send_keys(Keys.ARROW_DOWN)  # continues from the hovered option and wraps
    _wait_for_active_choice(duo, "bar")


def test_the_cancel_button_has_a_label_and_returns_to_the_layouts(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    cancel = duo.find_element("button[aria-label='Cancel']")
    cancel.click()

    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    assert duo.find_elements(PARAM_INPUT) == []


def test_arrow_keys_leave_a_parameter_without_choices_alone(dash_duo):
    duo = _start(dash_duo)
    _enter_params_mode(duo)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ARROW_DOWN)

    assert duo.find_elements(CHOICE_LIST) == []
    assert _active_option_id(duo) is None
    assert duo.find_elements(PARAM_INPUT), "The parameter prompt should stay open"


def _start_many(dash_duo):
    """Serve a layout whose only parameter has 40 choices, more than the list shows."""

    @dash_prism.register_layout(id="many", name="Many", allow_multiple=True)
    def many_layout(pick: Annotated[str, dash_prism.Param(choices=MANY_CHOICES)]):
        return html.Div(f"pick={pick!r}", id="many-content")

    return testutils.start_prism(dash_duo, layouts={})


def test_the_active_choice_is_scrolled_into_view_in_the_list_only(dash_duo):
    # A short window makes the list taller than the panel around it. The marked choice
    # must scroll the list and nothing else: the input stays in view and no ancestor moves.
    duo = _start_many(dash_duo)
    duo.driver.set_window_size(900, 300)
    _enter_params_mode(duo, search="Many", layout_id="many")
    duo.wait_for_element(CHOICE_LIST, timeout=5)

    duo.find_element(PARAM_INPUT).send_keys(Keys.ARROW_UP)  # the last of 40 choices
    _wait_for_active_choice(duo, MANY_CHOICES[-1])

    def option_is_inside_the_list(driver) -> bool:
        return driver.execute_script(
            """
            const list = document.querySelector(arguments[0]).getBoundingClientRect();
            const option = document.querySelector(arguments[1]).getBoundingClientRect();
            return option.top >= list.top && option.bottom <= list.bottom;
            """,
            CHOICE_LIST,
            CHOICE.format(MANY_CHOICES[-1]),
        )

    WebDriverWait(duo.driver, 5).until(
        option_is_inside_the_list, message="The list should scroll to the active choice"
    )

    scrolled_ancestors = duo.driver.execute_script(
        """
        const scrolled = [];
        for (let el = document.querySelector(arguments[0]).parentElement; el; el = el.parentElement) {
            if (el.scrollTop !== 0) scrolled.push(el.className || el.tagName);
        }
        return scrolled;
        """,
        CHOICE_LIST,
    )
    assert scrolled_ancestors == [], "Only the list may scroll"
    assert duo.driver.execute_script(
        """
        const input = document.querySelector(arguments[0]).getBoundingClientRect();
        return input.top >= 0 && input.bottom <= window.innerHeight;
        """,
        PARAM_INPUT,
    ), "The input must stay in view"
    assert duo.driver.execute_script(
        "return document.querySelector(arguments[0]).scrollTop > 0;", CHOICE_LIST
    ), "The list itself should have scrolled"
