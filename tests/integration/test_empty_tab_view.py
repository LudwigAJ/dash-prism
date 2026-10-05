"""Integration tests for the emptyTabView prop and the layout cards of the empty tab."""

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
NO_LAYOUTS = "[data-testid='prism-empty-tab-no-layouts']"


def test_empty_tab_view_none_renders_blank_pane(dash_duo):
    duo = testutils.start_prism(dash_duo, emptyTabView="none")
    duo.wait_for_element(BLANK, timeout=10)

    assert duo.find_elements(HINT) == []
    # The layout grid is what 'none' replaces; asserting on the blank pane's own
    # text would pass whatever the grid does, since that div has no children.
    assert duo.find_elements(LAYOUTS) == []
    # The search bar is still the way in
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=5)


def test_empty_tab_view_hint_renders_hint(dash_duo):
    duo = testutils.start_prism(dash_duo, emptyTabView="hint")
    duo.wait_for_element(HINT, timeout=10)

    assert "search bar" in duo.find_element(HINT).text.lower()
    assert duo.find_elements(BLANK) == []
    assert duo.find_elements(LAYOUTS) == []


def test_empty_tab_view_layouts_keeps_the_layout_grid(dash_duo):
    duo = testutils.start_prism(dash_duo, emptyTabView="layouts")
    # Assert on the grid itself: the layout name alone also appears in the
    # search dropdown, which opens on a fresh tab whatever emptyTabView says.
    duo.wait_for_element(LAYOUTS, timeout=10)

    assert duo.find_elements(HINT) == []
    assert duo.find_elements(BLANK) == []
    assert "Home" in duo.find_element(LAYOUTS).text


def test_empty_tab_view_layouts_without_layouts_shows_the_no_layouts_card(dash_duo):
    with pytest.warns(UserWarning, match="No layouts registered"):
        duo = testutils.start_prism(dash_duo, layouts={}, emptyTabView="layouts")
    duo.wait_for_element(NO_LAYOUTS, timeout=10)

    assert "No Layouts Available" in duo.find_element(NO_LAYOUTS).text
    assert duo.find_elements(LAYOUTS) == []


CARD = "[data-testid='prism-layout-card-home']"
CARD_OPEN = "[data-testid='prism-layout-card-open-home']"
CARD_STAR = "[data-testid='prism-layout-card-favorite-home']"

KEYS = pytest.mark.parametrize("key", [Keys.ENTER, Keys.SPACE], ids=["enter", "space"])


def _start_layout_grid(dash_duo):
    duo = testutils.start_prism(dash_duo, emptyTabView="layouts")
    duo.wait_for_element(CARD, timeout=10)
    return duo


def _wait_for_grid_to_close(duo) -> None:
    WebDriverWait(duo.driver, 10).until(
        lambda driver: driver.find_elements(By.CSS_SELECTOR, LAYOUTS) == [],
        message="The layout grid should give way to the layout",
    )


def test_layout_card_title_is_a_heading_inside_an_article(dash_duo):
    duo = _start_layout_grid(dash_duo)

    # The grid has h2 section headings, so the card titles are the next level.
    heading = duo.find_element(f"{CARD} h3")
    assert heading.text == "Home"
    assert heading.find_element(By.CSS_SELECTOR, CARD_OPEN)


@KEYS
def test_layout_card_opens_its_layout_from_the_keyboard(dash_duo, key):
    duo = _start_layout_grid(dash_duo)
    assert duo.find_element(CARD_OPEN).tag_name == "button"

    testutils.tab_to(duo, CARD_OPEN)
    testutils.press_key(duo, key)

    _wait_for_grid_to_close(duo)


def test_a_click_anywhere_on_a_layout_card_opens_its_layout(dash_duo):
    duo = _start_layout_grid(dash_duo)

    # The centre of the card is the description, not the title button.
    duo.find_element(CARD).click()

    _wait_for_grid_to_close(duo)


def test_the_favourite_star_of_a_card_does_not_open_the_layout(dash_duo):
    duo = _start_layout_grid(dash_duo)
    assert duo.find_element(CARD_STAR).get_attribute("aria-label") == "Add Home to favorites"

    # The click fails if the stretched title button covers the star.
    duo.find_element(CARD_STAR).click()

    WebDriverWait(duo.driver, 5).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, CARD_STAR).get_attribute("aria-label")
        == "Remove Home from favorites",
        message="The star should mark the layout as a favourite",
    )
    assert len(duo.find_elements(LAYOUTS)) == 1


def test_the_star_follows_the_title_in_the_tab_order(dash_duo):
    duo = _start_layout_grid(dash_duo)

    testutils.tab_to(duo, CARD_OPEN)
    testutils.press_key(duo, Keys.TAB)

    assert duo.driver.switch_to.active_element.get_attribute("data-testid") == (
        "prism-layout-card-favorite-home"
    )


@KEYS
def test_the_favourite_star_of_a_card_toggles_from_the_keyboard(dash_duo, key):
    duo = _start_layout_grid(dash_duo)

    testutils.tab_to(duo, CARD_STAR)
    testutils.press_key(duo, key)

    WebDriverWait(duo.driver, 5).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, CARD_STAR).get_attribute("aria-label")
        == "Remove Home from favorites",
        message="Enter or Space should mark the layout as a favourite",
    )
    assert len(duo.find_elements(LAYOUTS)) == 1

    # The card moved to the Favorites section and mounted again. The focus must follow it,
    # or the next key press would go to the page.
    WebDriverWait(duo.driver, 5).until(
        lambda driver: driver.switch_to.active_element.get_attribute("data-testid")
        == "prism-layout-card-favorite-home",
        message="The star should keep the focus after its card moved",
    )
    testutils.press_key(duo, key)
    WebDriverWait(duo.driver, 5).until(
        lambda driver: driver.find_element(By.CSS_SELECTOR, CARD_STAR).get_attribute("aria-label")
        == "Add Home to favorites",
        message="A second press should remove the favourite again",
    )
