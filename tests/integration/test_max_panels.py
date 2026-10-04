"""Integration tests for the maxPanels prop."""

from __future__ import annotations

import pytest

from tests.integration import testutils

pytestmark = pytest.mark.integration


def _start(dash_duo, max_panels: int):
    testutils.start_prism(dash_duo, maxPanels=max_panels)
    # A second tab makes the panel splittable
    dash_duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(dash_duo, 2)
    return dash_duo


def test_max_panels_one_disables_splitting(dash_duo):
    duo = _start(dash_duo, 1)
    assert duo.find_elements(testutils.SPLIT_PANEL_BUTTON) == []


def test_split_button_disappears_at_the_limit(dash_duo):
    duo = _start(dash_duo, 2)
    duo.wait_for_element(testutils.SPLIT_PANEL_BUTTON, timeout=5)
    duo.find_element(testutils.SPLIT_PANEL_BUTTON).click()
    testutils.wait_for_panel_count(duo, 2)

    # Both panels are at the limit now: no split button anywhere
    assert duo.find_elements(testutils.SPLIT_PANEL_BUTTON) == []
