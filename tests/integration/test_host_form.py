"""Integration tests for Prism inside a form of the host page."""

from __future__ import annotations

import pytest
from dash import Dash, html

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

DIALOG = "[role='dialog']"


def test_prism_buttons_do_not_submit_the_form_around_them(dash_duo):
    app = Dash(__name__, suppress_callback_exceptions=True)
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    app.layout = html.Form(
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
    duo = testutils.start_app(dash_duo, app)
    duo.wait_for_element(testutils.HELP_BUTTON, timeout=10)

    # A shared Button that closes its dialog unmounts before the submit, so only buttons that
    # stay mounted can show a submit. Button itself is covered by a unit test.
    # Dash may stop the submit afterwards, so the test records the event itself. The listener
    # runs in the capture phase, before any handler of the page.
    duo.driver.execute_script(
        "window.__submitted = false;"
        "document.addEventListener('submit', () => { window.__submitted = true; }, true);"
    )

    duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(duo, 2)
    duo.find_element(testutils.HELP_BUTTON).click()
    duo.wait_for_element(DIALOG, timeout=5)

    assert duo.driver.execute_script("return window.__submitted;") is False
    assert duo.find_elements(testutils.PRISM_ROOT)
