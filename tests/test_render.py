"""Tests for the render path of a tab: parameters, async layouts, timeouts and errors."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
import traceback
import types
from typing import Annotated, Any, Literal

import pydantic
import pytest
from dash import Dash, html
from dash.exceptions import PreventUpdate

import dash_prism
from dash_prism import app_init

# =============================================================================
# A null or empty layoutParams
# =============================================================================


def test_zero_arg_layout_with_none_params(prism_app: Dash) -> None:
    """Regression test: zero-argument layouts work when layoutParams is None.

    This tests the fix for the critical bug where `data.get("layoutParams", {})`
    returned None (not {}) when layoutParams was explicitly null from JSON,
    causing `callback(**None)` to raise TypeError.
    """
    callback_invoked = []

    @dash_prism.register_layout(id="zero-arg", name="Zero Arg Layout")
    def zero_arg_layout():
        callback_invoked.append(True)
        return html.Div("Zero argument layout")

    dash_prism.init("test-prism", prism_app)

    # Simulate the internal _render_tab_layout call with None params
    # (this is what happens when frontend sends layoutParams: null)
    result = app_init._render_tab_layout("tab-1", "zero-arg", None)

    assert result is not None
    assert len(callback_invoked) == 1


def test_layout_with_empty_dict_params(prism_app: Dash) -> None:
    """Test that layouts work correctly with empty dict params."""
    callback_invoked = []

    @dash_prism.register_layout(id="empty-params", name="Empty Params Layout")
    def empty_params_layout():
        callback_invoked.append(True)
        return html.Div("Empty params layout")

    dash_prism.init("test-prism", prism_app)

    result = app_init._render_tab_layout("tab-1", "empty-params", {})

    assert result is not None
    assert len(callback_invoked) == 1


def test_layout_with_actual_params(prism_app: Dash) -> None:
    """Test that layouts correctly receive actual parameters."""
    received_params = {}

    @dash_prism.register_layout(id="with-params", name="With Params Layout")
    def with_params_layout(user_id: str, count: str = "10"):
        received_params["user_id"] = user_id
        received_params["count"] = count
        return html.Div(f"User: {user_id}, Count: {count}")

    dash_prism.init("test-prism", prism_app)

    result = app_init._render_tab_layout(
        "tab-1", "with-params", {"user_id": "abc123", "count": "5"}
    )

    assert result is not None
    assert received_params["user_id"] == "abc123"
    assert received_params["count"] == "5"


# =============================================================================
# Async layout rendering
# =============================================================================


def test_async_render_tab_layout_returns_component_not_coroutine(prism_app: Dash) -> None:
    """Regression test: _render_tab_layout_async must await the layout callback.

    Previously, _render_tab_layout_async delegated to a sync function that called
    _run_callback_async without awaiting the returned coroutine. The result was a
    coroutine object passed to inject_tab_id instead of a Dash component tree.
    """

    @dash_prism.register_layout(id="async-render-test", name="Async Render Test")
    async def async_layout():
        return html.Div("Async rendered content", id="async-rendered")

    dash_prism.init("test-prism", prism_app)

    result = asyncio.run(app_init._render_tab_layout_async("tab-1", "async-render-test", None))

    # The result must be a Dash component, NOT a coroutine
    assert result is not None
    assert not asyncio.iscoroutine(result), (
        "_render_tab_layout_async returned a coroutine instead of a component. "
        "The coroutine of the layout callback was not awaited."
    )
    assert hasattr(result, "children"), "Result should be a Dash component with children"


def test_async_render_sync_callback_in_async_context(prism_app: Dash) -> None:
    """Test that sync callbacks work correctly when rendered via async path."""

    invoked = []

    @dash_prism.register_layout(id="sync-in-async", name="Sync In Async")
    def sync_layout():
        invoked.append(True)
        return html.Div("Sync content in async context")

    dash_prism.init("test-prism", prism_app)

    result = asyncio.run(app_init._render_tab_layout_async("tab-1", "sync-in-async", None))

    assert result is not None
    assert len(invoked) == 1, "Sync callback should have been invoked once"
    assert not asyncio.iscoroutine(result)


def test_async_render_with_params(prism_app: Dash) -> None:
    """Test async layout rendering with parameters."""

    received = {}

    @dash_prism.register_layout(id="async-params", name="Async Params")
    async def async_param_layout(mode: str = "default"):
        received["mode"] = mode
        return html.Div(f"Mode: {mode}")

    dash_prism.init("test-prism", prism_app)

    result = asyncio.run(
        app_init._render_tab_layout_async("tab-1", "async-params", {"mode": "advanced"})
    )

    assert result is not None
    assert not asyncio.iscoroutine(result)
    assert received["mode"] == "advanced"


def test_async_render_static_layout(prism_app: Dash) -> None:
    """Test that static layouts (no callback) work via async path."""

    dash_prism.register_layout(
        id="async-static",
        name="Async Static",
        layout=html.Div("Static in async", id="async-static-content"),
    )

    dash_prism.init("test-prism", prism_app)

    result = asyncio.run(app_init._render_tab_layout_async("tab-1", "async-static", None))

    assert result is not None
    assert not asyncio.iscoroutine(result)


# =============================================================================
# The layoutTimeout of the browser
# =============================================================================


def test_coerce_timeout_accepts_positive_numbers_and_numeric_strings() -> None:
    assert app_init._coerce_timeout(12) == 12.0
    assert app_init._coerce_timeout(2.5) == 2.5
    assert app_init._coerce_timeout("7") == 7.0
    assert app_init._coerce_timeout("0.25") == 0.25


@pytest.mark.parametrize(
    "bad",
    [None, "abc", "", 0, -1, 0.0, float("inf"), float("nan"), True, False, [], {}, 10**400],
)
def test_coerce_timeout_falls_back_to_default(bad: object) -> None:
    assert app_init._coerce_timeout(bad) == app_init.DEFAULT_LAYOUT_TIMEOUT
    assert app_init._coerce_timeout(bad, default=5.0) == 5.0


@pytest.mark.parametrize(
    "content_id, data",
    [
        (None, {"layoutId": "x"}),
        ("prism-content", {"layoutId": "x"}),
        ({"type": "prism-content", "index": "t1"}, None),
        ({"type": "prism-content", "index": "t1"}, "not-a-dict"),
        ({"type": "prism-content", "index": "t1"}, {}),
        ({"type": "prism-content", "index": "t1"}, {"layoutId": ""}),
        ({"type": "prism-content", "index": "t1"}, {"layoutId": None}),
        ({"type": "prism-content"}, {"layoutId": "x"}),
        ({"type": "prism-content", "index": ""}, {"layoutId": "x"}),
    ],
)
def test_parse_content_request_rejects_malformed_inputs(content_id: object, data: object) -> None:
    with pytest.raises(PreventUpdate):
        app_init._parse_content_request(content_id, data)


def test_parse_content_request_extracts_fields_and_timeout() -> None:
    content_id = {"type": "prism-content", "index": "t1"}

    assert app_init._parse_content_request(
        content_id,
        {"layoutId": "home", "layoutParams": {"a": "1"}, "layoutOption": "", "timeout": 12},
    ) == ("t1", "home", {"a": "1"}, None, 12.0)

    assert app_init._parse_content_request(content_id, {"layoutId": "home"}) == (
        "t1",
        "home",
        None,
        None,
        app_init.DEFAULT_LAYOUT_TIMEOUT,
    )

    assert app_init._parse_content_request(
        content_id, {"layoutId": "chart", "layoutOption": "bar", "timeout": None}
    ) == ("t1", "chart", None, "bar", app_init.DEFAULT_LAYOUT_TIMEOUT)


def _error_message(component: Any) -> str:
    """Text of the ``html.Pre`` inside an error component from ``_create_error_component``."""
    return str(component.children[1].children)


def _sync_prism_app() -> Dash:
    """A Dash app forced into sync mode.

    On every supported Dash (>= 3.1.1) use_async defaults to True when the async
    extras are installed, so the sync render callback must be requested explicitly.
    """
    app = Dash(__name__, use_async=False, suppress_callback_exceptions=True)
    app.layout = html.Div([dash_prism.Prism(id="test-prism", style={})])
    return app


def test_sync_callback_honours_client_timeout_for_async_layouts() -> None:
    """The sync callback applies the data["timeout"] that the client sends."""

    app = _sync_prism_app()

    @dash_prism.register_layout(id="slow-async", name="Slow Async")
    async def slow_layout():
        await asyncio.sleep(0.3)
        return html.Div("done", id="slow-done")

    # Sync mode with an async layout: init() warns, and the callback runs the
    # layout through asyncio.run(wait_for(...)) with the client's timeout.
    with pytest.warns(UserWarning, match="async"):
        dash_prism.init("test-prism", app)

    content_id = {"type": "prism-content", "index": "tab-1"}

    timed_out = app_init._render_content_request(
        content_id, {"layoutId": "slow-async", "timeout": 0.05}
    )
    assert timed_out.className == "prism-error-tab"
    assert "timed out after 0.05s" in _error_message(timed_out)

    rendered = app_init._render_content_request(
        content_id, {"layoutId": "slow-async", "timeout": 5}
    )
    assert rendered.id == {"type": "slow-done", "index": "tab-1"}


def test_sync_callback_uses_default_timeout_when_client_sends_garbage() -> None:
    app = _sync_prism_app()

    @dash_prism.register_layout(id="quick-async", name="Quick Async")
    async def quick_layout():
        await asyncio.sleep(0.01)
        return html.Div("ok", id="quick-done")

    with pytest.warns(UserWarning, match="async"):
        dash_prism.init("test-prism", app)

    content_id = {"type": "prism-content", "index": "tab-1"}
    rendered = app_init._render_content_request(
        content_id, {"layoutId": "quick-async", "timeout": "abc"}
    )
    assert rendered.id == {"type": "quick-done", "index": "tab-1"}


def test_async_callback_honours_client_timeout() -> None:
    app = Dash(__name__, use_async=True, suppress_callback_exceptions=True)
    app.layout = html.Div([dash_prism.Prism(id="async-prism", style={})])

    @dash_prism.register_layout(id="slow-async", name="Slow Async")
    async def slow_layout():
        await asyncio.sleep(0.3)
        return html.Div("done", id="slow-done")

    @dash_prism.register_layout(id="slow-sync", name="Slow Sync")
    def slow_sync_layout():
        # The executor branch awaits run_in_executor(...) inside asyncio.timeout().
        # Keep a wide margin between this sleep and the 0.05 s timeout below.
        time.sleep(1.0)
        return html.Div("done", id="slow-sync-done")

    dash_prism.init("async-prism", app)

    content_id = {"type": "prism-content", "index": "tab-1"}

    for layout_id in ("slow-async", "slow-sync"):
        timed_out = asyncio.run(
            app_init._render_content_request_async(
                content_id, {"layoutId": layout_id, "timeout": 0.05}
            )
        )
        assert timed_out.className == "prism-error-tab"
        assert "timed out after 0.05s" in _error_message(timed_out)

    rendered = asyncio.run(
        app_init._render_content_request_async(content_id, {"layoutId": "slow-async", "timeout": 5})
    )
    assert rendered.id == {"type": "slow-done", "index": "tab-1"}


def test_render_content_request_raises_prevent_update_for_bad_input(prism_app: Dash) -> None:
    with pytest.raises(PreventUpdate):
        app_init._render_content_request({"type": "prism-content", "index": "t"}, {})
    with pytest.raises(PreventUpdate):
        asyncio.run(app_init._render_content_request_async(None, {"layoutId": "x"}))


def test_render_callback_is_registered_once(prism_app: Dash) -> None:
    dash_prism.register_layout(id="static", name="Static", layout=html.Div("s"))
    dash_prism.init("test-prism", prism_app)

    keys = [k for k in prism_app.callback_map if "prism-content" in k]
    assert len(keys) == 1


def test_registered_sync_callback_passes_client_timeout() -> None:
    """The registered sync callback forwards data["timeout"] through the Dash dispatcher.

    The wrapper that Dash calls is where the timeout used to get lost.
    """

    app = _sync_prism_app()

    @dash_prism.register_layout(id="slow-async", name="Slow Async")
    async def slow_layout():
        await asyncio.sleep(0.3)
        return html.Div("done", id="slow-done")

    with pytest.warns(UserWarning, match="async"):
        dash_prism.init("test-prism", app)

    key = next(k for k in app.callback_map if "prism-content" in k)
    cid = {"type": "prism-content", "index": "tab-1"}
    sid = json.dumps(cid, sort_keys=True, separators=(",", ":"))
    body = {
        "output": key,
        "outputs": {"id": cid, "property": "children"},
        "inputs": [
            {"id": cid, "property": "id", "value": cid},
            {
                "id": cid,
                "property": "data",
                "value": {"layoutId": "slow-async", "timeout": 0.05},
            },
        ],
        "changedPropIds": [f"{sid}.data"],
        "state": [],
    }
    resp = app.server.test_client().post("/_dash-update-component", json=body)
    text = resp.get_data(as_text=True)
    assert resp.status_code == 200
    assert "timed out after 0.05s" in text
    assert "slow-done" not in text


# =============================================================================
# Parameter validation in the render paths
# =============================================================================


def test_render_invalid_params_returns_validation_component(prism_app: Dash) -> None:
    @dash_prism.register_layout(id="typed", name="Typed")
    def layout(n: int = 1):
        return html.Div(f"n={n}")

    dash_prism.init("test-prism", prism_app)

    result = app_init._render_tab_layout("tab-1", "typed", {"n": "abc"})
    assert "prism-error-validation" in result.className
    assert "n" in str(result.children[2].children[0].children[0].children)


def test_render_coerces_params_before_callback(prism_app: Dash) -> None:
    received: dict[str, object] = {}

    @dash_prism.register_layout(id="typed", name="Typed")
    def layout(n: int = 1, flag: bool = False):
        received.update(n=n, flag=flag)
        return html.Div()

    dash_prism.init("test-prism", prism_app)

    app_init._render_tab_layout("tab-1", "typed", {"n": "5", "flag": "false"})
    assert received == {"n": 5, "flag": False}


def test_async_render_validation_error(prism_app: Dash) -> None:
    @dash_prism.register_layout(id="typed-async", name="Typed async")
    async def layout(n: int = 1):
        return html.Div()

    dash_prism.init("test-prism", prism_app)

    result = asyncio.run(app_init._render_tab_layout_async("tab-1", "typed-async", {"n": "x"}))
    assert "prism-error-validation" in result.className


# =============================================================================
# Error components for a failed layout (sync and async path)
# =============================================================================


def _render_on_path(
    path: str,
    layout_id: str,
    layout_params: dict[str, Any] | None = None,
    timeout: float = 5.0,
    show_details: bool = False,
) -> Any:
    """Render a tab through the sync path or the async path."""
    options = {"timeout": timeout, "show_details": show_details}
    if path == "sync":
        return app_init._render_tab_layout("tab-1", layout_id, layout_params, **options)
    return asyncio.run(
        app_init._render_tab_layout_async("tab-1", layout_id, layout_params, **options)
    )


@pytest.mark.parametrize("path", ["sync", "async"])
@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (TimeoutError("slow backend"), "Layout 'failing' timed out after 5s."),
        (TypeError("bad type"), "Error rendering layout 'failing': bad type"),
        (ValueError("bad value"), "Error rendering layout 'failing': bad value"),
        (RuntimeError("boom"), "Error rendering layout 'failing': boom"),
    ],
    ids=["timeout", "type-error", "value-error", "other"],
)
def test_failed_layout_shows_error_component(
    prism_app: Dash, path: str, error: Exception, expected: str
) -> None:
    @dash_prism.register_layout(id="failing", name="Failing")
    def failing():
        raise error

    dash_prism.init("test-prism", prism_app)

    result = _render_on_path(path, "failing", show_details=True)

    assert result.className == "prism-error-tab"
    assert expected in _error_message(result)


@pytest.mark.parametrize("path", ["sync", "async"])
def test_missing_layout_shows_error_component(prism_app: Dash, path: str) -> None:
    dash_prism.register_layout(id="other", name="Other", layout=html.Div("o"))
    dash_prism.init("test-prism", prism_app)

    result = _render_on_path(path, "missing")

    assert result.className == "prism-error-tab"
    assert _error_message(result) == "Layout is not registered: layout_id='missing'"


@pytest.mark.parametrize(
    ("layout_id", "layout_params", "layout_option", "expected"),
    [
        (
            "with-options",
            None,
            None,
            "Request field layoutOption is missing, and the layout declares param_options: "
            "layout_id='with-options'",
        ),
        (
            "with-options",
            {"n": "2"},
            "one",
            "Request field layoutParams is not empty, and the layout declares param_options: "
            "layout_id='with-options'. The layout accepts values only through an option.",
        ),
        (
            "with-options",
            None,
            5,
            "Request field layoutOption is not a string: layout_id='with-options', type='int'",
        ),
        (
            "with-options",
            None,
            "two",
            "Request field layoutOption is not a key of param_options: "
            "layout_id='with-options', layoutOption='two'",
        ),
        (
            "without-options",
            None,
            "one",
            "Request field layoutOption is given, and the layout declares no param_options: "
            "layout_id='without-options'",
        ),
        (
            "without-options",
            "n=2",
            None,
            "Request field layoutParams is not an object: layout_id='without-options', "
            "type='str'",
        ),
    ],
    ids=[
        "option-missing",
        "params-with-options",
        "option-not-a-string",
        "option-unknown",
        "option-without-options",
        "params-not-an-object",
    ],
)
def test_request_that_does_not_agree_with_the_registration_names_the_request_field(
    caplog: pytest.LogCaptureFixture,
    layout_id: str,
    layout_params: Any,
    layout_option: Any,
    expected: str,
) -> None:
    @dash_prism.register_layout(id="with-options", param_options={"one": ("One", {"n": "1"})})
    def with_options(n: int = 1):
        return html.Div(n)

    @dash_prism.register_layout(id="without-options")
    def without_options(n: int = 1):
        return html.Div(n)

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        result = app_init._render_tab_layout("tab-1", layout_id, layout_params, layout_option)

    assert _error_message(result) == expected
    [record] = _prism_records(caplog, logging.WARNING)
    assert record.getMessage() == (
        f"Layout {layout_id!r}: the registration rejected the render request"
    )


@pytest.mark.parametrize("path", ["sync", "async"])
def test_invalid_parameters_show_validation_component(prism_app: Dash, path: str) -> None:
    @dash_prism.register_layout(id="typed", name="Typed")
    def typed(n: int = 1):
        return html.Div(f"n={n}")

    dash_prism.init("test-prism", prism_app)

    if path == "sync":
        result = app_init._render_tab_layout("tab-1", "typed", {"n": "abc"})
    else:
        result = asyncio.run(app_init._render_tab_layout_async("tab-1", "typed", {"n": "abc"}))

    assert "prism-error-validation" in result.className


@pytest.mark.parametrize("path", ["sync", "async"])
def test_empty_layout_id_renders_nothing(path: str) -> None:
    assert _render_on_path(path, "") is None


# =============================================================================
# Log lines for a failed layout and for a render request
# =============================================================================


def _prism_records(caplog: pytest.LogCaptureFixture, level: int) -> list[logging.LogRecord]:
    return [
        record
        for record in caplog.records
        if record.name.startswith("dash_prism") and record.levelno >= level
    ]


@pytest.mark.parametrize("path", ["sync", "async"])
@pytest.mark.parametrize(
    ("error", "level"),
    [
        (TimeoutError("slow backend"), logging.WARNING),
        (TypeError("bad type"), logging.ERROR),
        (ValueError("bad value"), logging.ERROR),
        (RuntimeError("boom"), logging.ERROR),
    ],
    ids=["timeout", "type-error", "value-error", "other"],
)
def test_failed_layout_is_logged_once(
    prism_app: Dash,
    caplog: pytest.LogCaptureFixture,
    path: str,
    error: Exception,
    level: int,
) -> None:
    @dash_prism.register_layout(id="failing", name="Failing")
    def failing():
        raise error

    dash_prism.init("test-prism", prism_app)
    caplog.clear()

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        _render_on_path(path, "failing")

    records = _prism_records(caplog, logging.WARNING)
    assert [record.levelno for record in records] == [level]
    assert "failing" in records[0].getMessage()


@pytest.mark.parametrize("path", ["sync", "async"])
def test_missing_layout_is_logged_once(
    prism_app: Dash, caplog: pytest.LogCaptureFixture, path: str
) -> None:
    dash_prism.register_layout(id="other", name="Other", layout=html.Div("o"))
    dash_prism.init("test-prism", prism_app)
    caplog.clear()

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        _render_on_path(path, "missing")

    records = _prism_records(caplog, logging.WARNING)
    assert [record.levelno for record in records] == [logging.WARNING]


def test_render_request_is_logged_once_without_parameter_values(
    prism_app: Dash, caplog: pytest.LogCaptureFixture
) -> None:
    @dash_prism.register_layout(id="typed", name="Typed")
    def typed(n: int = 1):
        return html.Div(f"n={n}")

    dash_prism.init("test-prism", prism_app)
    caplog.clear()

    content_id = {"type": "prism-content", "index": "tab-1"}
    data = {"layoutId": "typed", "layoutParams": {"n": "secret-value"}}
    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        result = app_init._render_content_request(content_id, data)

    assert "prism-error-validation" in result.className
    requests = [r for r in _prism_records(caplog, logging.DEBUG) if "Render request" in r.message]
    assert [(r.levelno, r.getMessage()) for r in requests] == [
        (logging.DEBUG, "Render request: tab_id='tab-1' layout_id='typed'")
    ]
    assert "secret-value" not in caplog.text
    warnings_logged = _prism_records(caplog, logging.WARNING)
    assert [r.getMessage() for r in warnings_logged] == [
        "Layout 'typed' has invalid parameters: n (int_parsing)"
    ]


def test_render_request_log_keeps_a_line_break_in_an_id_out_of_the_log(
    caplog: pytest.LogCaptureFixture,
) -> None:
    content_id = {"type": "prism-content", "index": "tab\nFAKE LOG LINE"}

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        app_init._parse_content_request(content_id, {"layoutId": "home\r\nFORGED"})

    [message] = [r.getMessage() for r in caplog.records if "Render request" in r.getMessage()]
    assert "\n" not in message
    assert "\r" not in message


def _raise_type_error(value: str) -> None:
    raise TypeError(f"cannot use {value}")


def _raise_value_error(value: str) -> None:
    int(value)


def _raise_pydantic_error(value: str) -> None:
    class Settings(pydantic.BaseModel):
        count: int

    Settings.model_validate({"count": value})


def _raise_runtime_error(value: str) -> None:
    raise RuntimeError(f"unexpected {value}")


@pytest.mark.parametrize("path", ["sync", "async"])
@pytest.mark.parametrize(
    "raiser",
    [_raise_type_error, _raise_value_error, _raise_pydantic_error, _raise_runtime_error],
    ids=["type-error", "value-error", "pydantic-error", "unexpected"],
)
def test_failed_layout_shows_the_value_but_logs_only_the_class(
    prism_app: Dash, caplog: pytest.LogCaptureFixture, path: str, raiser: Any
) -> None:
    @dash_prism.register_layout(id="failing", name="Failing")
    def failing(value: str = ""):
        raiser(value)

    dash_prism.init("test-prism", prism_app)
    caplog.clear()

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        result = _render_on_path(path, "failing", {"value": "hunter2"}, show_details=True)

    assert "hunter2" in _error_message(result)
    assert "hunter2" not in caplog.text


@pytest.mark.parametrize("path", ["sync", "async"])
def test_unexpected_exception_log_has_the_class_and_the_frames(
    prism_app: Dash, caplog: pytest.LogCaptureFixture, path: str
) -> None:
    @dash_prism.register_layout(id="failing", name="Failing")
    def failing(value: str = ""):
        _raise_runtime_error(value)

    dash_prism.init("test-prism", prism_app)
    caplog.clear()

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        _render_on_path(path, "failing", {"value": "hunter2"})

    [record] = _prism_records(caplog, logging.WARNING)
    message = record.getMessage()
    assert record.levelno == logging.ERROR
    assert record.exc_info is None
    assert message.startswith("Layout 'failing' failed with RuntimeError")
    assert "in failing" in message
    assert "in _raise_runtime_error" in message


def test_log_keeps_a_line_break_in_a_layout_id_out_of_the_log(
    prism_app: Dash, caplog: pytest.LogCaptureFixture
) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_prism.init("test-prism", prism_app)
    caplog.clear()

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        app_init._render_tab_layout("tab-1", "missing\nFORGED", None)

    [record] = _prism_records(caplog, logging.WARNING)
    assert "\n" not in record.getMessage()


# A value that the user typed. No log record of a failed render can hold it.
_SENTINEL = "sentinel-5f2c"


def _assert_sentinel_not_logged(caplog: pytest.LogCaptureFixture) -> None:
    for record in caplog.records:
        logged = [record.getMessage(), repr(record.args)]
        if record.exc_info:
            logged.append("".join(traceback.format_exception(*record.exc_info)))
        assert not any(_SENTINEL in text for text in logged), record


def _refuse(value: str) -> str:
    raise ValueError(f"refused {value}")


def _crash(value: str) -> str:
    raise RuntimeError(f"crashed on {value}")


class _RefusingBody(pydantic.BaseModel):
    code: str

    @pydantic.field_validator("code")
    @classmethod
    def _refuse_code(cls, value: str) -> str:
        return _refuse(value)


class _ChoiceBody(pydantic.BaseModel):
    code: Annotated[str, dash_prism.Param(choices=["a", "b"])] = "a"


def _register_sentinel_layouts() -> None:
    """Register one layout for each way that a typed value can make a render fail."""

    @dash_prism.register_layout(id="refusing-validator")
    def refusing_validator(code: Annotated[str, pydantic.AfterValidator(_refuse)] = ""):
        return html.Div(code)

    @dash_prism.register_layout(id="refusing-body")
    def refusing_body(params: _RefusingBody):
        return html.Div(params.code)

    @dash_prism.register_layout(id="crashing-validator")
    def crashing_validator(code: Annotated[str, pydantic.AfterValidator(_crash)] = ""):
        return html.Div(code)

    @dash_prism.register_layout(id="choices")
    def choices(mode: Literal["a", "b"] = "a"):
        return html.Div(mode)

    @dash_prism.register_layout(id="choices-body")
    def choices_body(params: _ChoiceBody):
        return html.Div(params.code)

    @dash_prism.register_layout(id="typed")
    def typed(n: int = 1, cfg: dict[str, int] | None = None):
        return html.Div(n)

    @dash_prism.register_layout(id="options", param_options={"one": ("One", {"n": "1"})})
    def options(n: int = 1):
        return html.Div(n)

    @dash_prism.register_layout(id="failing")
    def failing(value: str = ""):
        _crash(value)


@pytest.mark.parametrize("path", ["sync", "async"])
@pytest.mark.parametrize(
    ("layout_id", "layout_params", "layout_option"),
    [
        ("refusing-validator", {"code": _SENTINEL}, None),
        ("refusing-body", {"code": _SENTINEL}, None),
        ("crashing-validator", {"code": _SENTINEL}, None),
        ("choices", {"mode": _SENTINEL}, None),
        ("choices-body", {"code": _SENTINEL}, None),
        ("typed", {"n": _SENTINEL}, None),
        ("typed", {"cfg": {_SENTINEL: "x"}}, None),
        ("typed", {_SENTINEL: "1"}, None),
        ("options", None, _SENTINEL),
        ("failing", {"value": _SENTINEL}, None),
    ],
    ids=[
        "custom-validator",
        "custom-validator-body-model",
        "custom-validator-raises-another-error",
        "choices",
        "choices-body-model",
        "type-error",
        "dict-key",
        "undeclared-parameter",
        "unknown-option",
        "layout-raises",
    ],
)
def test_failed_render_never_logs_a_typed_value(
    caplog: pytest.LogCaptureFixture,
    path: str,
    layout_id: str,
    layout_params: dict[str, Any] | None,
    layout_option: str | None,
) -> None:
    _register_sentinel_layouts()
    content_id = {"type": "prism-content", "index": "tab-1"}
    data = {"layoutId": layout_id, "layoutParams": layout_params, "layoutOption": layout_option}

    with caplog.at_level(logging.DEBUG):
        if path == "sync":
            result = app_init._render_content_request(content_id, data)
        else:
            result = asyncio.run(app_init._render_content_request_async(content_id, data))

    assert "prism-error-tab" in result.className
    assert _prism_records(caplog, logging.WARNING)
    _assert_sentinel_not_logged(caplog)


def test_invalid_parameter_log_names_only_declared_parameters(
    caplog: pytest.LogCaptureFixture,
) -> None:
    _register_sentinel_layouts()
    content_id = {"type": "prism-content", "index": "tab-1"}
    data = {"layoutId": "typed", "layoutParams": {"cfg": {_SENTINEL: "x"}, "extra": "1"}}

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        app_init._render_content_request(content_id, data)

    [record] = _prism_records(caplog, logging.WARNING)
    assert record.getMessage() == (
        "Layout 'typed' has invalid parameters: cfg (int_parsing), <undeclared> (extra_forbidden)"
    )


class _AliasBody(pydantic.BaseModel):
    count: int = pydantic.Field(alias="c")


def test_invalid_parameter_log_gives_the_field_name_for_an_alias(
    caplog: pytest.LogCaptureFixture,
) -> None:
    @dash_prism.register_layout(id="aliased")
    def aliased(params: _AliasBody):
        return html.Div(params.count)

    content_id = {"type": "prism-content", "index": "tab-1"}
    data = {"layoutId": "aliased", "layoutParams": {"c": "x"}}

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        app_init._render_content_request(content_id, data)

    [record] = _prism_records(caplog, logging.WARNING)
    assert record.getMessage() == "Layout 'aliased' has invalid parameters: count (int_parsing)"


def test_app_layout_that_fails_at_init_is_logged_with_its_message(
    dash_app: Dash, caplog: pytest.LogCaptureFixture
) -> None:
    # init() runs with no request, so the message cannot hold a typed value.
    def layout() -> Any:
        _crash("no request")

    dash_prism.register_layout(id="home", layout=html.Div("home"))
    dash_app.layout = layout

    with (
        caplog.at_level(logging.DEBUG),
        pytest.warns(UserWarning, match="Could not find Prism component"),
        pytest.warns(UserWarning, match=re.escape("Failed to call app.layout()")),
    ):
        dash_prism.init("test-prism", dash_app)

    [record] = _prism_records(caplog, logging.ERROR)
    assert record.getMessage() == "Failed to call app.layout() while searching for Prism"
    assert record.exc_info is not None
    assert "crashed on no request" in "".join(traceback.format_exception(*record.exc_info))


@pytest.mark.parametrize("is_async", [False, True], ids=["sync", "async"])
def test_wrapped_app_layout_that_fails_is_logged_without_its_message(
    caplog: pytest.LogCaptureFixture, is_async: bool
) -> None:
    def sync_layout() -> Any:
        _crash(_SENTINEL)

    async def async_layout() -> Any:
        _crash(_SENTINEL)

    layout = async_layout if is_async else sync_layout
    wrapper = app_init._create_layout_wrapper(layout, "test-prism", {}, "session", is_async)

    with caplog.at_level(logging.DEBUG), pytest.raises(RuntimeError, match=_SENTINEL):
        if is_async:
            asyncio.run(wrapper())
        else:
            wrapper()

    [record] = _prism_records(caplog, logging.ERROR)
    assert record.getMessage().startswith("app.layout raised RuntimeError")
    assert "in _crash" in record.getMessage()
    _assert_sentinel_not_logged(caplog)


@pytest.mark.parametrize("path", ["sync", "async"])
@pytest.mark.parametrize("error_class", [TypeError, ValueError])
def test_type_or_value_error_of_a_layout_is_logged_as_unexpected(
    caplog: pytest.LogCaptureFixture, path: str, error_class: type[Exception]
) -> None:
    # A request that the registration rejects raises a ValueError subclass. A
    # plain ValueError of the layout callback must not get its warning without frames.
    @dash_prism.register_layout(id="failing")
    def failing(value: str = ""):
        raise error_class(value)

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        result = _render_on_path(path, "failing", {"value": _SENTINEL}, show_details=True)

    assert _SENTINEL in _error_message(result)
    [record] = _prism_records(caplog, logging.WARNING)
    message = record.getMessage()
    assert record.levelno == logging.ERROR
    assert message.startswith(f"Layout 'failing' failed with {error_class.__name__}")
    assert "in failing" in message
    _assert_sentinel_not_logged(caplog)


@pytest.mark.parametrize("path", ["sync", "async"])
def test_unexpected_error_shows_only_a_generic_text_without_details(path: str) -> None:
    @dash_prism.register_layout(id="failing")
    def failing():
        raise RuntimeError("database password is hunter2")

    result = _render_on_path(path, "failing")

    assert _error_message(result) == (
        "Error rendering layout 'failing'.\nThe server log has the details."
    )


@pytest.mark.parametrize("path", ["sync", "async"])
@pytest.mark.parametrize("details", [False, True], ids=["production", "debug"])
def test_prism_texts_do_not_depend_on_details(path: str, details: bool) -> None:
    @dash_prism.register_layout(id="typed")
    def typed(n: int = 1):
        return html.Div(n)

    rejected = _render_on_path(path, "missing", show_details=details)
    invalid = _render_on_path(path, "typed", {"n": "abc"}, show_details=details)

    assert _error_message(rejected) == "Layout is not registered: layout_id='missing'"
    assert "prism-error-validation" in invalid.className


@pytest.mark.parametrize("debug", [False, True], ids=["production", "debug"])
def test_dev_tools_ui_reads_the_switch_of_the_app(debug: bool) -> None:
    app = Dash(__name__)
    app.enable_dev_tools(
        debug=debug, dev_tools_hot_reload=False, dev_tools_silence_routes_logging=False
    )

    assert app_init._dev_tools_ui(app) is debug


class _FakeApp:
    """Keeps the render callback that init() registers, with the dev tools UI on."""

    def __init__(self) -> None:
        self.config = types.SimpleNamespace(suppress_callback_exceptions=True)
        self._use_async = False
        self._dev_tools = {"ui": True}
        self.callback_options: dict[str, Any] = {}
        self.render: Any = None

    def callback(self, *args: Any, **kwargs: Any) -> Any:
        del args  # Unused.
        self.callback_options = kwargs

        def register(function: Any) -> Any:
            self.render = function
            return function

        return register


@pytest.mark.parametrize(
    ("background", "expected"),
    [
        (False, "Error rendering layout 'failing': detail-3b9d"),
        (True, "Error rendering layout 'failing'.\nThe server log has the details."),
    ],
    ids=["foreground", "background"],
)
def test_background_callback_shows_only_the_generic_text(background: bool, expected: str) -> None:
    @dash_prism.register_layout(id="failing")
    def failing():
        raise RuntimeError("detail-3b9d")

    app = _FakeApp()
    app_init._register_render_callback(app, background)  # type: ignore[arg-type]

    result = app.render({"type": "prism-content", "index": "tab-1"}, {"layoutId": "failing"})

    assert app.callback_options["background"] is background
    assert _error_message(result) == expected


def _post_render(app: Dash, layout_id: str) -> str:
    """Send one render request through the Dash dispatcher of ``app``."""
    key = next(k for k in app.callback_map if "prism-content" in k)
    cid = {"type": "prism-content", "index": "tab-1"}
    sid = json.dumps(cid, sort_keys=True, separators=(",", ":"))
    body = {
        "output": key,
        "outputs": {"id": cid, "property": "children"},
        "inputs": [
            {"id": cid, "property": "id", "value": cid},
            {"id": cid, "property": "data", "value": {"layoutId": layout_id}},
        ],
        "changedPropIds": [f"{sid}.data"],
        "state": [],
    }
    response = app.server.test_client().post("/_dash-update-component", json=body)
    assert response.status_code == 200
    return response.get_data(as_text=True)


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
def test_each_app_follows_its_own_dev_tools_switch(use_async: bool) -> None:
    @dash_prism.register_layout(id="failing")
    def failing():
        raise RuntimeError("detail-3b9d")

    # The app with dev tools on is built last, so dash.get_app() finds it.
    apps = []
    for debug in (False, True):
        app = Dash(__name__, use_async=use_async, suppress_callback_exceptions=True)
        app.layout = html.Div([dash_prism.Prism(id="prism")])
        dash_prism.init("prism", app)
        app.enable_dev_tools(
            debug=debug, dev_tools_hot_reload=False, dev_tools_silence_routes_logging=False
        )
        apps.append(app)
    production, debug_app = apps

    assert "detail-3b9d" not in _post_render(production, "failing")
    assert "The server log has the details." in _post_render(production, "failing")
    assert "detail-3b9d" in _post_render(debug_app, "failing")


def test_event_loop_error_shows_its_message_in_the_tab(
    caplog: pytest.LogCaptureFixture,
) -> None:
    @dash_prism.register_layout(id="async-layout")
    async def async_layout():
        return html.Div()

    async def render_inside_a_running_loop() -> Any:
        return app_init._render_tab_layout("tab-1", "async-layout", None)

    with caplog.at_level(logging.DEBUG, logger="dash_prism"):
        result = asyncio.run(render_inside_a_running_loop())

    message = _error_message(result)
    assert message.startswith(
        "Error rendering layout 'async-layout': An event loop is already running"
    )
    [record] = _prism_records(caplog, logging.WARNING)
    assert record.levelno == logging.ERROR
    assert "An event loop is already running" in record.getMessage()


# =============================================================================
# Layout callbacks that return something other than a component
# =============================================================================


@pytest.mark.parametrize(
    "returned,expected",
    [
        (None, None),
        ("Just a string", "Just a string"),
        ([], []),
    ],
    ids=["none", "string", "empty-list"],
)
def test_render_passes_a_non_component_result_through(returned: Any, expected: Any) -> None:
    @dash_prism.register_layout(id="odd-result", name="Odd Result")
    def layout() -> Any:
        return returned

    assert app_init._render_tab_layout("tab-1", "odd-result", None) == expected


def test_render_injects_the_tab_id_into_a_list_result() -> None:
    @dash_prism.register_layout(id="list-layout", name="List Layout")
    def layout() -> list[html.Div]:
        return [html.Div("First", id="first"), html.Div("Second")]

    result = app_init._render_tab_layout("tab-1", "list-layout", None)

    assert [div.children for div in result] == ["First", "Second"]
    assert result[0].id == {"type": "first", "index": "tab-1"}


def test_render_content_request_raises_prevent_update_for_a_none_result() -> None:
    @dash_prism.register_layout(id="none-layout", name="None Layout")
    def layout() -> None:
        return None

    with pytest.raises(PreventUpdate):
        app_init._render_content_request(
            {"type": "prism-content", "index": "tab-1"}, {"layoutId": "none-layout"}
        )
