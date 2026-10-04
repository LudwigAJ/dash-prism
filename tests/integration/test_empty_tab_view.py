"""Integration tests for the emptyTabView prop (doc 03 §2)."""

from __future__ import annotations

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from tests.integration import testutils

pytestmark = pytest.mark.integration

HINT = "[data-testid='prism-empty-tab-hint']"
BLANK = "[data-testid='prism-empty-tab-blank']"
LAYOUTS = "[data-testid='prism-empty-tab-layouts']"


def test_empty_tab_view_none_renders_blank_pane(dash_duo):
    testutils.start_prism(dash_duo, emptyTabView="none")
    dash_duo.wait_for_element(BLANK, timeout=10)

    assert dash_duo.find_elements(HINT) == []
    # The layout grid is what 'none' replaces; asserting on the blank pane's own
    # text would pass whatever the grid does, since that div has no children.
    assert dash_duo.find_elements(LAYOUTS) == []
    # The search bar is still the way in
    dash_duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=5)
    assert testutils.check_browser_errors(dash_duo) == []


def test_empty_tab_view_hint_renders_hint(dash_duo):
    testutils.start_prism(dash_duo, emptyTabView="hint")
    dash_duo.wait_for_element(HINT, timeout=10)

    assert "search bar" in dash_duo.find_element(HINT).text.lower()
    assert dash_duo.find_elements(BLANK) == []
    assert dash_duo.find_elements(LAYOUTS) == []
    assert testutils.check_browser_errors(dash_duo) == []


def test_empty_tab_view_layouts_keeps_the_layout_grid(dash_duo):
    testutils.start_prism(dash_duo, emptyTabView="layouts")
    # Assert on the grid itself: the layout name alone also appears in the
    # search dropdown, which opens on a fresh tab whatever emptyTabView says.
    dash_duo.wait_for_element(LAYOUTS, timeout=10)

    assert dash_duo.find_elements(HINT) == []
    assert dash_duo.find_elements(BLANK) == []
    assert "Home" in dash_duo.find_element(LAYOUTS).text
    assert testutils.check_browser_errors(dash_duo) == []


CARD = "[data-testid='prism-layout-card-home']"
CARD_OPEN = "[data-testid='prism-layout-card-open-home']"
CARD_STAR = "[data-testid='prism-layout-card-favorite-home']"

KEYS = pytest.mark.parametrize("key", [Keys.ENTER, Keys.SPACE], ids=["enter", "space"])


def _start_layout_grid(dash_duo):
    testutils.start_prism(dash_duo, emptyTabView="layouts")
    dash_duo.wait_for_element(CARD, timeout=10)


def _wait_for_grid_to_close(duo) -> None:
    WebDriverWait(duo.driver, 10).until(
        lambda driver: driver.find_elements(By.CSS_SELECTOR, LAYOUTS) == [],
        message="The layout grid should give way to the layout",
    )


def test_layout_card_title_is_a_heading_inside_an_article(dash_duo):
    _start_layout_grid(dash_duo)

    # The grid has h2 section headings, so the card titles are the next level.
    heading = dash_duo.find_element(f"{CARD} h3")
    assert heading.text == "Home"
    assert heading.find_element(By.CSS_SELECTOR, CARD_OPEN)


@KEYS
def test_layout_card_opens_its_layout_from_the_keyboard(dash_duo, key):
    _start_layout_grid(dash_duo)
    assert dash_duo.find_element(CARD_OPEN).tag_name == "button"

    testutils.tab_to(dash_duo, CARD_OPEN)
    testutils.press_key(dash_duo, key)

    _wait_for_grid_to_close(dash_duo)
    assert testutils.check_browser_errors(dash_duo) == []


def test_a_click_anywhere_on_a_layout_card_opens_its_layout(dash_duo):
    _start_layout_grid(dash_duo)

    # The centre of the card is the description, not the title button.
    dash_duo.find_element(CARD).click()

    _wait_for_grid_to_close(dash_duo)
    assert testutils.check_browser_errors(dash_duo) == []


def test_the_favourite_star_of_a_card_does_not_open_the_layout(dash_duo):
    _start_layout_grid(dash_duo)
    assert dash_duo.find_element(CARD_STAR).get_attribute("aria-label") == "Add Home to favorites"

    # The click fails if the stretched title button covers the star.
    dash_duo.find_element(CARD_STAR).click()

    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, CARD_STAR).get_attribute("aria-label")
        == "Remove Home from favorites",
        message="The star should mark the layout as a favourite",
    )
    assert len(dash_duo.find_elements(LAYOUTS)) == 1
    assert testutils.check_browser_errors(dash_duo) == []


def test_the_star_follows_the_title_in_the_tab_order(dash_duo):
    _start_layout_grid(dash_duo)

    testutils.tab_to(dash_duo, CARD_OPEN)
    testutils.press_key(dash_duo, Keys.TAB)

    assert dash_duo.driver.switch_to.active_element.get_attribute("data-testid") == (
        "prism-layout-card-favorite-home"
    )


@KEYS
def test_the_favourite_star_of_a_card_toggles_from_the_keyboard(dash_duo, key):
    _start_layout_grid(dash_duo)

    testutils.tab_to(dash_duo, CARD_STAR)
    testutils.press_key(dash_duo, key)

    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, CARD_STAR).get_attribute("aria-label")
        == "Remove Home from favorites",
        message="Enter or Space should mark the layout as a favourite",
    )
    assert len(dash_duo.find_elements(LAYOUTS)) == 1

    # The card moved to the Favorites section and mounted again. The focus must follow it,
    # or the next key press would go to the page.
    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.switch_to.active_element.get_attribute("data-testid")
        == "prism-layout-card-favorite-home",
        message="The star should keep the focus after its card moved",
    )
    testutils.press_key(dash_duo, key)
    WebDriverWait(dash_duo.driver, 5).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, CARD_STAR).get_attribute("aria-label")
        == "Add Home to favorites",
        message="A second press should remove the favourite again",
    )
    assert testutils.check_browser_errors(dash_duo) == []
