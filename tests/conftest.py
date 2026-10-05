"""Pytest configuration and fixtures for dash_prism tests."""

from __future__ import annotations

import importlib
import sys
from collections.abc import Iterator
from types import ModuleType

import pytest
from dash import Dash, _callback, html

import dash_prism


@pytest.fixture
def dash_app() -> Dash:
    """Create a minimal Dash app for testing.

    Returns
    -------
    Dash
        A Dash application instance.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)
    return app


@pytest.fixture
def prism_app() -> Dash:
    """Create a Dash app with a Prism component.

    Returns
    -------
    Dash
        A Dash application with Prism component in layout.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)

    app.layout = html.Div(
        [
            dash_prism.Prism(
                id="test-prism",
                theme="light",
                size="md",
                style={},
            )
        ]
    )

    return app


@pytest.fixture(autouse=True)
def clear_registry():
    """Clear the layout registry before and after each test.

    Ensures tests don't interfere with each other.
    """
    dash_prism.clear_registry()
    yield
    dash_prism.clear_registry()


@pytest.fixture
def sample_layout():
    """Create a simple layout for testing.

    Returns
    -------
    dash component
        A simple Dash component tree.
    """
    return html.Div(
        [
            html.H1("Test Layout"),
            html.P("This is a test layout", id="test-paragraph"),
        ]
    )


@pytest.fixture
def demo_app() -> Iterator[ModuleType]:
    """Import the demo app module ``examples.app`` again, into the empty registry.

    The demo registers its layouts and its ``dash.callback`` callbacks when Python
    imports it. The fixture removes the earlier import, so each test gets a new app
    and new registrations. Dash keeps a ``dash.callback`` in a global list until an
    app starts a server. Thus the fixture restores that list after the test, so the
    callbacks of the demo cannot reach the app of a later test.

    :returns: The module ``examples.app``.
    """
    for name in [name for name in sys.modules if name.split(".")[0] == "examples"]:
        del sys.modules[name]
    callback_list = list(_callback.GLOBAL_CALLBACK_LIST)
    callback_map = dict(_callback.GLOBAL_CALLBACK_MAP)
    inline_scripts = list(_callback.GLOBAL_INLINE_SCRIPTS)
    yield importlib.import_module("examples.app")
    _callback.GLOBAL_CALLBACK_LIST[:] = callback_list
    _callback.GLOBAL_CALLBACK_MAP.clear()
    _callback.GLOBAL_CALLBACK_MAP.update(callback_map)
    _callback.GLOBAL_INLINE_SCRIPTS[:] = inline_scripts
