"""Smoke tests for the demo app in ``examples/``."""

from __future__ import annotations

import flask

import dash_prism


def test_demo_app_registers_every_layout(demo_app) -> None:
    assert sorted(dash_prism.get_registered_layouts_metadata()) == [
        "continent",
        "country",
        "delayed",
        "embed",
        "iris",
        "live",
        "ohlc",
        "scatter",
        "settings",
        "typed-chart",
    ]


def test_demo_app_exposes_the_flask_server(demo_app) -> None:
    """A WSGI server such as gunicorn serves ``examples.app:server``."""
    assert isinstance(demo_app.server, flask.Flask)
    assert demo_app.server is demo_app.app.server
