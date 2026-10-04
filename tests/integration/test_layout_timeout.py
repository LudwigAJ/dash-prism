"""Integration tests for the ``layoutTimeout`` prop.

Before 1.0 the prop reached neither the client-side loading timer (it was
always 30 s) nor the synchronous render callback (which ignored
``data["timeout"]``).
"""

from __future__ import annotations

import asyncio
import time

import pytest
from dash import Dash, html
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism
from tests.integration import testutils

# PrismContent writes a "timed out" line to the console when the layout is slow.
pytestmark = [pytest.mark.integration, pytest.mark.allow_console_errors("timed out")]

SLOW_SECONDS = 4.0
TIMEOUT_SECONDS = 1


def _start_app(dash_duo):
    # Force sync mode: on every supported Dash (>= 3.1.1) use_async defaults to True
    # when the async extras are installed, and the bug under test lived in the sync
    # render callback.
    app = Dash(__name__, use_async=False, suppress_callback_exceptions=True)

    @dash_prism.register_layout(id="slow-async", name="Slow Async")
    async def slow_async_layout():
        await asyncio.sleep(SLOW_SECONDS)
        return html.Div("async done", id="slow-async-done")

    @dash_prism.register_layout(id="slow-sync", name="Slow Sync")
    def slow_sync_layout():
        time.sleep(SLOW_SECONDS)
        return html.Div("sync done", id="slow-sync-done")

    with pytest.warns(UserWarning, match="async"):
        return testutils.start_prism(dash_duo, app=app, layouts={}, layoutTimeout=TIMEOUT_SECONDS)


def _select_layout(duo, layout_id: str) -> None:
    duo.wait_for_element(".prism-searchbar", timeout=5)
    duo.find_element(".prism-searchbar").click()
    duo.wait_for_element(testutils.SEARCHBAR_INPUT, timeout=3)
    duo.find_element(testutils.SEARCHBAR_INPUT).send_keys(layout_id)
    duo.wait_for_element(f"[data-testid='prism-layout-item-{layout_id}']", timeout=5)
    duo.find_element(f"[data-testid='prism-layout-item-{layout_id}']").click()


def _root_text(duo) -> str:
    return duo.find_element(testutils.PRISM_ROOT).text


def test_server_enforces_layout_timeout_for_async_layouts_in_sync_app(dash_duo):
    """The sync render callback passes layoutTimeout to asyncio.wait_for."""
    duo = _start_app(dash_duo)
    started = time.monotonic()
    _select_layout(duo, "slow-async")

    # The server error must arrive well before the 4 s layout could have finished.
    WebDriverWait(duo.driver, SLOW_SECONDS - 1).until(
        lambda d: f"timed out after {TIMEOUT_SECONDS}s" in _root_text(duo),
        message="expected the server-side timeout error tab",
    )
    assert time.monotonic() - started < SLOW_SECONDS
    assert duo.find_elements("[id*='slow-async-done']") == []


def test_client_shows_timeout_card_after_layout_timeout_seconds(dash_duo):
    """PrismContent's loading timer uses the layoutTimeout prop (not the 30 s default)."""
    duo = _start_app(dash_duo)
    _select_layout(duo, "slow-sync")

    # Client-side card appears after ~1 s while the uninterruptible sync callback runs.
    WebDriverWait(duo.driver, SLOW_SECONDS - 1).until(
        lambda d: "Layout Loading Timeout" in _root_text(duo),
        message="expected the client-side timeout card",
    )
    # Once the callback finishes the real content replaces the card.
    duo.wait_for_element("[id*='slow-sync-done']", timeout=SLOW_SECONDS + 5)
    assert "Layout Loading Timeout" not in _root_text(duo)
