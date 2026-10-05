"""Integration tests for the text that a tab shows when its layout function fails."""

from __future__ import annotations

from typing import Any

import pytest
from dash import Dash, html

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

ERROR_TAB = ".prism-error-tab pre"


def _start_failing_app(dash_duo: Any, **server_options: Any) -> None:
    app = Dash(__name__, suppress_callback_exceptions=True)

    @dash_prism.register_layout(id="failing", name="Failing")
    def failing():
        raise RuntimeError("detail-7c1e")

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="prism",
                initialLayout="failing",
                persistence=False,
                persistence_type="memory",
                style={"height": "100vh", "width": "100%"},
            )
        ]
    )
    dash_prism.init("prism", app)
    testutils.start_app(dash_duo, app, **server_options)


def test_failed_layout_hides_the_message_without_debug(dash_duo):
    _start_failing_app(dash_duo)

    dash_duo.wait_for_text_to_equal(
        ERROR_TAB, "Error rendering layout 'failing'.\nThe server log has the details.", timeout=10
    )


def test_failed_layout_shows_the_message_with_debug(dash_duo):
    _start_failing_app(dash_duo, debug=True, use_reloader=False, dev_tools_hot_reload=False)

    dash_duo.wait_for_text_to_equal(
        ERROR_TAB, "Error rendering layout 'failing': detail-7c1e", timeout=10
    )
