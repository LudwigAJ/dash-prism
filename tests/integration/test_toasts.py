"""
Integration tests for toasts.

Each Prism instance has its own Toaster. A toast that one instance raises must
show in that instance only.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid and attributes)
"""

from __future__ import annotations

import pytest
from dash import Dash, html
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

TOAST = "[data-sonner-toast]"
LIMIT_MESSAGE = "Maximum tabs limit reached (1)"


def _prism(prism_id: str) -> dash_prism.Prism:
    return dash_prism.Prism(
        id=prism_id,
        maxTabs=1,
        persistence=False,
        style={"height": "320px", "width": "100%"},
    )


def _toast_count(driver, prism_id: str, text: str) -> int:
    return driver.execute_script(
        "return Array.from(document.querySelectorAll(arguments[0] + ' ' + arguments[1]))"
        ".filter((el) => el.textContent.includes(arguments[2])).length;",
        f"#{prism_id}",
        TOAST,
        text,
    )


def test_a_toast_shows_only_in_the_instance_that_raised_it(dash_duo):
    """A refused new tab shows its toast once, in the instance that has the focus."""
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    app.layout = html.Div([_prism("prism-first"), _prism("prism-second")])
    dash_prism.init("prism-first", app)
    dash_duo.driver.set_window_size(1280, 900)
    testutils.start_app(dash_duo, app)
    for prism_id in ("prism-first", "prism-second"):
        dash_duo.wait_for_element(f"#{prism_id} {testutils.TAB_SELECTOR}", timeout=10)

    # The shortcuts belong to the instance that the user touched last.
    dash_duo.find_element(f"#prism-second {testutils.TAB_SELECTOR}").click()
    dash_duo.find_element("body").send_keys(testutils.get_modifier_key(), Keys.ALT, "n")

    WebDriverWait(dash_duo.driver, 10).until(
        lambda driver: _toast_count(driver, "prism-second", LIMIT_MESSAGE) >= 1,
        message="The instance that raised the toast should show it",
    )
    assert _toast_count(dash_duo.driver, "prism-second", LIMIT_MESSAGE) == 1
    assert _toast_count(dash_duo.driver, "prism-first", LIMIT_MESSAGE) == 0
