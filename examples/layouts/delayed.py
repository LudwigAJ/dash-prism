"""The delayed layout, which is slow on purpose to show the loading spinner of a tab."""

from __future__ import annotations

import time
from typing import Annotated

from dash import html

import dash_prism


@dash_prism.register_layout(
    id="delayed",
    name="Delayed Layout",
    description="A layout that takes time to load (simulates heavy computation)",
    keywords=["delay", "loading", "slow", "test", "spinner"],
    allow_multiple=False,
)
def delayed_layout(
    delay: Annotated[
        int, dash_prism.Param(ge=0, le=30, description="Seconds to wait before rendering")
    ] = 3,
) -> html.Div:
    """Wait, and then return a message.

    The search bar accepts only whole numbers from 0 to 30 for ``delay``. Prism gives the
    function a real ``int``.

    :param delay: The number of seconds to wait.
    """
    time.sleep(delay)
    return html.Div(
        [
            html.H2("[DELAYED LAYOUT]"),
            html.P(f"This layout took {delay} seconds to load.", className="demo-muted"),
            html.Div(
                [
                    html.H3("[OK] Successfully Loaded", className="demo-success"),
                    html.P(f"The layout finished loading after {delay}s delay."),
                ],
                className="demo-card",
            ),
        ],
        className="demo-page demo-centered",
    )
