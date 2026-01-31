"""
Integration tests for Prism size variants.

Validates that size='sm' | 'md' | 'lg' produces different UI dimensions for:
- tab bar (tabs list height)
- tabs in the tab bar (tab trigger font size)
- search bar
- status bar
- NewLayout cards (card title font size)
"""

from __future__ import annotations

import pytest

from conftest import (
    wait_for_panel_layout_stable,
    check_browser_errors,
)

pytestmark = pytest.mark.integration

SIZE_EXPECTATIONS: dict[str, dict[str, float]] = {
    "sm": {
        "tabs_list_height": 26.0,
        "tab_trigger_font_size": 10.0,
        "searchbar_height": 30.0,
        "statusbar_height": 18.0,
        "newlayout_card_title_font_size": 13.0,
    },
    "md": {
        "tabs_list_height": 32.0,
        "tab_trigger_font_size": 12.0,
        "searchbar_height": 36.0,
        "statusbar_height": 22.0,
        "newlayout_card_title_font_size": 16.0,
    },
    "lg": {
        "tabs_list_height": 40.0,
        "tab_trigger_font_size": 14.0,
        "searchbar_height": 44.0,
        "statusbar_height": 26.0,
        "newlayout_card_title_font_size": 18.0,
    },
}


def _get_prism_size_metrics(dash_duo) -> dict[str, float]:
    """Return computed size metrics for key Prism UI elements."""
    script = """
    const tabsList = document.querySelector("[data-slot='tabs-list']");
    const tabsTrigger = document.querySelector("[data-slot='tabs-trigger']");
    const searchbar = document.querySelector(".prism-searchbar");
    const statusbar = document.querySelector(".prism-status-bar");
    const newlayoutTitle = document.querySelector(".prism-newlayout-card-title");

    if (!tabsList || !tabsTrigger || !searchbar || !statusbar || !newlayoutTitle) {
      return null;
    }

    return {
      tabs_list_height: tabsList.getBoundingClientRect().height,
      tab_trigger_font_size: parseFloat(getComputedStyle(tabsTrigger).fontSize),
      searchbar_height: searchbar.getBoundingClientRect().height,
      statusbar_height: statusbar.getBoundingClientRect().height,
      newlayout_card_title_font_size: parseFloat(getComputedStyle(newlayoutTitle).fontSize),
    };
    """
    metrics = dash_duo.driver.execute_script(script)
    if metrics is None:
        raise AssertionError("Expected Prism elements to be present for size metrics")
    return metrics

@pytest.mark.skip(reason="Changed to use CVA + em based scaling")
@pytest.mark.parametrize("size", ["sm", "md", "lg"])
def test_prism_size_variant_dimensions(prism_app_factory, size: str) -> None:
    """Ensure sm/md/lg sizes produce expected UI dimensions."""
    duo = prism_app_factory(size=size)

    assert wait_for_panel_layout_stable(duo), "Panel layout did not stabilize"

    duo.wait_for_element("[data-slot='tabs-list']", timeout=5)
    duo.wait_for_element("[data-slot='tabs-trigger']", timeout=5)
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.wait_for_element(".prism-status-bar", timeout=5)
    duo.wait_for_element(".prism-newlayout-card-title", timeout=5)

    metrics = _get_prism_size_metrics(duo)
    expected = SIZE_EXPECTATIONS[size]

    tolerance = 0.75
    assert metrics["tabs_list_height"] == pytest.approx(expected["tabs_list_height"], abs=tolerance)
    assert metrics["tab_trigger_font_size"] == pytest.approx(
        expected["tab_trigger_font_size"], abs=tolerance
    )
    assert metrics["searchbar_height"] == pytest.approx(expected["searchbar_height"], abs=tolerance)
    assert metrics["statusbar_height"] == pytest.approx(expected["statusbar_height"], abs=tolerance)
    assert metrics["newlayout_card_title_font_size"] == pytest.approx(
        expected["newlayout_card_title_font_size"], abs=tolerance
    )

    errors = check_browser_errors(duo)
    assert len(errors) == 0, f"Browser console should have no errors: {errors}"
