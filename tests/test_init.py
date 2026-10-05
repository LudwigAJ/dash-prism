"""Tests for dash_prism initialization functionality."""

from __future__ import annotations

import asyncio
import inspect
import logging
import sys
import warnings
from typing import Any
from unittest import mock

import pytest
from dash import Dash, html

import dash_prism
from dash_prism import app_init, layout_registry, layout_tree


def test_init_no_layouts_warning(prism_app: Dash) -> None:
    """Test that init warns when no layouts are registered."""
    with pytest.warns(UserWarning, match="No layouts registered"):
        dash_prism.init("test-prism", prism_app)


def test_init_missing_layout_error() -> None:
    """Test that init fails if app.layout is not set."""
    app = Dash(__name__)
    # app.layout is None

    with pytest.raises(dash_prism.InitializationError, match="app.layout must be set"):
        dash_prism.init("test-prism", app)


def test_init_invalid_prism_id(prism_app: Dash) -> None:
    """Test that init validates prism_id."""
    with pytest.raises(dash_prism.InitializationError):
        dash_prism.init("", prism_app)  # Empty ID


def test_init_component_not_found_warning(dash_app: Dash) -> None:
    """Test warning when Prism component not found in layout."""
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    dash_app.layout = html.Div("No Prism here")

    with pytest.warns(UserWarning, match="Could not find Prism component"):
        dash_prism.init("nonexistent", dash_app)


def test_init_warns_and_continues_when_the_layout_function_raises(dash_app: Dash) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))

    def broken_layout() -> html.Div:
        raise RuntimeError("the layout is broken")

    dash_app.layout = broken_layout

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        dash_prism.init("test-prism", dash_app)

    assert any("Failed to call app.layout()" in str(w.message) for w in caught)
    assert app_init._is_connected(dash_app, "test-prism")


def _register_static_layouts() -> None:
    dash_prism.register_layout(id="layout1", name="Layout 1", layout=html.Div("Layout 1"))
    dash_prism.register_layout(id="layout2", name="Layout 2", layout=html.Div("Layout 2"))


def _register_callback_layout() -> None:
    @dash_prism.register_layout(id="callback-layout", name="Callback Layout")
    def my_layout() -> html.Div:
        return html.Div("From callback")


def _register_async_layout() -> None:
    @dash_prism.register_layout(id="async-layout", name="Async Layout")
    async def async_layout() -> html.Div:
        return html.Div("Async content")


def _register_parameterized_layout() -> None:
    @dash_prism.register_layout(id="multi-param", name="Multi Param")
    def layout_multi_param(x: int = 1, y: str = "default", z: bool = True) -> html.Div:
        return html.Div(f"x={x}, y={y}, z={z}")


def _register_layout_with_options() -> None:
    @dash_prism.register_layout(
        id="param-layout",
        name="Parameterized",
        param_options={
            "opt1": ("Option 1", {"value": "1"}),
            "opt2": ("Option 2", {"value": "2"}),
        },
    )
    def param_layout(value: str = "1") -> html.Div:
        return html.Div(f"Value: {value}")


@pytest.mark.parametrize(
    "register",
    [
        _register_static_layouts,
        _register_callback_layout,
        _register_async_layout,
        _register_parameterized_layout,
        _register_layout_with_options,
    ],
    ids=["static", "callback", "async", "parameterized", "options"],
)
def test_init_registers_the_render_callback(prism_app: Dash, register: Any) -> None:
    register()

    # An async layout in a sync app runs through asyncio.run(), and init() warns.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        dash_prism.init("test-prism", prism_app)

    assert prism_app.callback_map


def _deeply_nested(prism: Any) -> Any:
    for _ in range(10):
        prism = html.Div(prism)
    return prism


@pytest.mark.parametrize(
    "wrap",
    [
        lambda prism: html.Div([html.Div([html.Div([prism])])]),
        lambda prism: html.Div(html.Div(prism)),
        _deeply_nested,
        lambda prism: html.Div(
            [
                html.Div(children=None),
                html.Div(["text node", html.Span("span"), html.Div([prism])]),
            ]
        ),
        lambda prism: html.Div(
            ["String content", 123, None, html.Div([html.Span("Nested list")]), prism]
        ),
    ],
    ids=["nested", "single-child", "deeply-nested", "none-children", "mixed-content"],
)
def test_init_finds_the_prism_component_in_any_layout_shape(dash_app: Dash, wrap: Any) -> None:
    dash_app.layout = wrap(dash_prism.Prism(id="found-prism", style={}))
    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test"))

    dash_prism.init("found-prism", dash_app)

    prism = layout_tree.find_component_by_id(dash_app.layout, "found-prism")
    assert "test" in prism.registeredLayouts


def test_init_with_description_and_keywords(prism_app: Dash) -> None:
    """Test layout with description and keywords."""
    dash_prism.register_layout(
        id="documented",
        name="Documented Layout",
        description="This is a well-documented layout",
        keywords=["test", "example", "demo"],
        layout=html.Div("Content"),
    )

    # Get metadata before init (returns dict of layout_id -> metadata)
    metadata = dash_prism.get_registered_layouts_metadata()
    assert len(metadata) == 1
    assert "documented" in metadata
    assert metadata["documented"]["description"] == "This is a well-documented layout"
    assert metadata["documented"]["keywords"] == ["test", "example", "demo"]

    dash_prism.init("test-prism", prism_app)


def test_init_with_allow_multiple(prism_app: Dash) -> None:
    """Test layout with allow_multiple flag."""
    dash_prism.register_layout(
        id="multi",
        name="Multi Layout",
        allow_multiple=True,
        layout=html.Div("Can open multiple"),
    )

    # Get metadata before init (returns dict of layout_id -> metadata)
    metadata = dash_prism.get_registered_layouts_metadata()
    assert len(metadata) == 1
    assert "multi" in metadata
    assert metadata["multi"]["allowMultiple"] is True

    dash_prism.init("test-prism", prism_app)


def test_init_error_on_none_prism_id(prism_app: Dash) -> None:
    """Test that None prism_id raises InitializationError."""
    invalid_prism_id: Any = None
    with pytest.raises(dash_prism.InitializationError):
        dash_prism.init(invalid_prism_id, prism_app)


def test_init_with_async_app() -> None:
    """Test initialization with async Dash app."""
    try:
        app = Dash(__name__, use_async=True, suppress_callback_exceptions=True)
    # Dash can raise any exception type when the async extra is missing.
    except Exception as exc:  # noqa: BLE001
        pytest.fail(f"Dash app does not support use_async: {exc}")

    app.layout = html.Div([dash_prism.Prism(id="async-prism", style={})])

    @dash_prism.register_layout(id="async-layout", name="Async")
    async def async_layout():
        return html.Div("Async")

    # Should not warn about async mismatch
    dash_prism.init("async-prism", app)
    assert app.callback_map


def test_init_registers_metadata_in_component(prism_app: Dash) -> None:
    """Test that init properly injects metadata into Prism component."""
    dash_prism.register_layout(
        id="metadata-test",
        name="Metadata Test",
        description="Testing metadata injection",
        layout=html.Div("Test"),
    )

    # Get the Prism component before init
    prism_component = prism_app.layout.children[0]
    assert prism_component.id == "test-prism"

    # Initialize - this injects metadata
    dash_prism.init("test-prism", prism_app)

    assert isinstance(prism_component.registeredLayouts, dict)
    assert "metadata-test" in prism_component.registeredLayouts


# =============================================================================
# Callable app.layout
# =============================================================================


def test_callable_layout_sync(dash_app: Dash) -> None:
    """Test sync callable app.layout with metadata injection."""

    @dash_prism.register_layout(id="test-layout", name="Test Layout")
    def test_layout():
        return html.Div("Test content")

    # Set app.layout as a callable function
    def layout():
        return html.Div([dash_prism.Prism(id="prism-callable", style={})])

    dash_app.layout = layout
    dash_prism.init("prism-callable", dash_app)

    # Call layout function and verify metadata is injected
    layout_result = dash_app.layout()
    assert layout_result is not None

    # Find the Prism component in the result
    prism = layout_tree.find_component_by_id(layout_result, "prism-callable")
    assert prism is not None

    # Verify metadata was injected
    assert hasattr(prism, "registeredLayouts")
    assert prism.registeredLayouts is not None
    assert isinstance(prism.registeredLayouts, dict)
    assert "test-layout" in prism.registeredLayouts
    assert prism.registeredLayouts["test-layout"]["name"] == "Test Layout"

    # Verify the derived serverSessionId fingerprint was injected
    assert prism.serverSessionId == app_init._compute_server_session_id(dash_prism.registry)


def test_callable_layout_async(dash_app: Dash) -> None:
    """Test async callable app.layout with metadata injection."""

    @dash_prism.register_layout(id="async-test-layout", name="Async Test Layout")
    async def async_test_layout():
        return html.Div("Async test content")

    # Set app.layout as an async callable function
    async def async_layout():
        return html.Div([dash_prism.Prism(id="prism-async-callable", style={})])

    dash_app.layout = async_layout
    # init cannot call an async layout, so it must not claim that Prism is missing.
    with warnings.catch_warnings():
        warnings.filterwarnings("error", message="Could not find Prism component")
        dash_prism.init("prism-async-callable", dash_app)

    # Verify wrapper is async
    assert inspect.iscoroutinefunction(dash_app.layout)

    # Call layout function and verify metadata is injected
    layout_result = asyncio.run(dash_app.layout())
    assert layout_result is not None

    # Find the Prism component in the result
    prism = layout_tree.find_component_by_id(layout_result, "prism-async-callable")
    assert prism is not None

    # Verify metadata was injected
    assert hasattr(prism, "registeredLayouts")
    assert prism.registeredLayouts is not None
    assert isinstance(prism.registeredLayouts, dict)
    assert "async-test-layout" in prism.registeredLayouts

    # Verify the derived serverSessionId fingerprint was injected
    assert prism.serverSessionId == app_init._compute_server_session_id(dash_prism.registry)


def test_callable_layout_with_params(dash_app: Dash) -> None:
    """Test callable layout with parameters (Dash 2.0+ request context)."""

    @dash_prism.register_layout(id="param-test", name="Param Test")
    def param_test():
        return html.Div("Param test")

    # Set app.layout as a callable that accepts parameters
    def layout(request=None):
        # In real Dash apps, request would contain query params, etc.
        return html.Div([dash_prism.Prism(id="prism-with-params", style={})])

    dash_app.layout = layout
    dash_prism.init("prism-with-params", dash_app)

    # Verify parameters are forwarded
    mock_request = mock.MagicMock()
    layout_result = dash_app.layout(request=mock_request)
    assert layout_result is not None

    # Find the Prism component
    prism = layout_tree.find_component_by_id(layout_result, "prism-with-params")
    assert prism is not None
    assert hasattr(prism, "registeredLayouts")


def test_callable_layout_multiple_calls(dash_app: Dash) -> None:
    """Test that callable layout injection works on every call."""

    @dash_prism.register_layout(id="multi-call", name="Multi Call")
    def multi_call():
        return html.Div("Multi call")

    call_count = [0]

    def layout():
        call_count[0] += 1
        return html.Div(
            [
                html.Div(f"Call {call_count[0]}"),
                dash_prism.Prism(id="prism-multi-call", style={}),
            ]
        )

    dash_app.layout = layout

    # Layout is called once during validation, before wrapping
    initial_count = call_count[0]

    dash_prism.init("prism-multi-call", dash_app)

    # After init, layout has been called once during validation
    validation_count = call_count[0]
    assert validation_count == initial_count + 1

    # Call layout multiple times
    for i in range(3):
        layout_result = dash_app.layout()
        prism = layout_tree.find_component_by_id(layout_result, "prism-multi-call")
        assert prism is not None
        assert hasattr(prism, "registeredLayouts")
        assert "multi-call" in prism.registeredLayouts

    # Verify it was called 3 more times after validation
    assert call_count[0] == validation_count + 3


def test_callable_layout_preserves_function_metadata(dash_app: Dash) -> None:
    """Test that functools.wraps preserves function metadata."""

    def layout():
        """This is my layout function."""
        return html.Div([dash_prism.Prism(id="prism-metadata", style={})])

    dash_prism.register_layout(id="home", name="Home", layout=html.Div("Home"))
    dash_app.layout = layout
    dash_prism.init("prism-metadata", dash_app)

    # Verify function metadata is preserved
    assert dash_app.layout.__name__ == "layout"
    assert dash_app.layout.__doc__ == "This is my layout function."


def test_static_layout_unchanged(dash_app: Dash) -> None:
    """Test that static layouts still work as before (no regression)."""

    @dash_prism.register_layout(id="static-test", name="Static Test")
    def static_test():
        return html.Div("Static test")

    # Set app.layout as static (non-callable)
    dash_app.layout = html.Div([dash_prism.Prism(id="prism-static", style={})])

    # Get the Prism component before init
    prism_before = layout_tree.find_component_by_id(dash_app.layout, "prism-static")

    dash_prism.init("prism-static", dash_app)

    # Verify metadata was injected into the static component
    assert prism_before.registeredLayouts is not None
    assert "static-test" in prism_before.registeredLayouts

    # Verify app.layout is still not callable
    assert not callable(dash_app.layout)


def test_callable_layout_multiple_init_no_infinite_wrapping(dash_app: Dash) -> None:
    """Test that calling init() multiple times doesn't create infinite wrapping."""

    @dash_prism.register_layout(id="init-test", name="Init Test")
    def init_test():
        return html.Div("Init test")

    def layout():
        return html.Div([dash_prism.Prism(id="prism-multi-init", style={})])

    dash_app.layout = layout

    # Call init multiple times. callback_map is keyed by output, so it hides a
    # duplicate. _callback_list does not.
    dash_prism.init("prism-multi-init", dash_app)
    first_wrapper = dash_app.layout
    assert len(dash_app._callback_list) == 1

    dash_prism.init("prism-multi-init", dash_app)
    second_wrapper = dash_app.layout
    assert len(dash_app._callback_list) == 1

    dash_prism.init("prism-multi-init", dash_app)
    third_wrapper = dash_app.layout
    assert len(dash_app._callback_list) == 1

    # Verify it's the same wrapper (not re-wrapped)
    assert first_wrapper is second_wrapper
    assert second_wrapper is third_wrapper

    # Verify the wrapper still works correctly
    layout_result = dash_app.layout()
    prism = layout_tree.find_component_by_id(layout_result, "prism-multi-init")
    assert prism is not None
    assert hasattr(prism, "registeredLayouts")


def test_callable_layout_exception_handling(dash_app: Dash) -> None:
    """Test that exceptions in callable layout are propagated correctly."""

    def failing_layout():
        raise ValueError("Layout generation failed")

    dash_app.layout = failing_layout

    # Init should succeed (wrapping doesn't call the layout)
    # But we need to suppress the warning about not finding Prism
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        dash_prism.init("prism-test", dash_app)

    # Calling the layout should raise the original exception
    with pytest.raises(ValueError, match="Layout generation failed"):
        dash_app.layout()


# =============================================================================
# serverSessionId
# =============================================================================


def test_compute_server_session_id_is_stable_and_order_independent() -> None:
    a = app_init._compute_server_session_id(["home", "about"])
    assert a == app_init._compute_server_session_id(["about", "home"])
    assert a == app_init._compute_server_session_id(iter(["home", "about"]))
    assert len(a) == 12 and all(c in "0123456789abcdef" for c in a)
    assert a != app_init._compute_server_session_id(["home"])
    assert a != app_init._compute_server_session_id(["home", "about", "extra"])
    assert app_init._compute_server_session_id([]) == app_init._compute_server_session_id(())


def test_init_injects_layout_fingerprint_as_server_session_id(prism_app: Dash) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("h"))
    dash_prism.register_layout(id="about", name="About", layout=html.Div("a"))
    dash_prism.init("test-prism", prism_app)

    prism = layout_tree.find_component_by_id(prism_app.layout, "test-prism")
    assert prism.serverSessionId == app_init._compute_server_session_id(["about", "home"])


def test_init_keeps_an_explicit_server_session_id() -> None:
    app = Dash(__name__, suppress_callback_exceptions=True)
    app.layout = html.Div([dash_prism.Prism(id="p", serverSessionId="release-42", style={})])
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("h"))
    dash_prism.init("p", app)

    assert layout_tree.find_component_by_id(app.layout, "p").serverSessionId == "release-42"


def test_callable_layout_keeps_an_explicit_server_session_id(dash_app: Dash) -> None:
    """The override must survive the per-render injection of the callable path too."""
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("h"))

    def layout():
        return html.Div([dash_prism.Prism(id="p", serverSessionId="release-42", style={})])

    dash_app.layout = layout
    dash_prism.init("p", dash_app)

    prism = layout_tree.find_component_by_id(dash_app.layout(), "p")
    assert prism.serverSessionId == "release-42"
    assert "home" in prism.registeredLayouts


def test_per_process_server_session_id_constant_is_gone() -> None:
    """The per-process UUID could never match across gunicorn workers or restarts."""
    assert "SERVER_SESSION_ID" not in dash_prism.__all__
    assert not hasattr(dash_prism, "SERVER_SESSION_ID")


# =============================================================================
# Metadata injection into app.layout
# =============================================================================


def test_inject_metadata_into_none_returns_none_and_warns(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.WARNING, logger="dash_prism"):
        result = app_init._inject_metadata_into_layout(None, "test-prism", {}, "fingerprint")

    assert result is None
    assert "Prism component 'test-prism' may not be available" in caplog.text


@pytest.mark.parametrize("is_async", [False, True], ids=["sync", "async"])
def test_callable_layout_returning_none_stays_none(
    dash_app: Dash, caplog: pytest.LogCaptureFixture, is_async: bool
) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))

    if is_async:

        async def layout():
            return None

    else:

        def layout():
            return None

    dash_app.layout = layout
    if is_async:
        # init cannot call an async layout, so it has no tree to warn about.
        dash_prism.init("test-prism", dash_app)
    else:
        with pytest.warns(UserWarning, match="Could not find Prism component"):
            dash_prism.init("test-prism", dash_app)

    with caplog.at_level(logging.WARNING, logger="dash_prism"):
        result = asyncio.run(dash_app.layout()) if is_async else dash_app.layout()

    assert result is None
    assert "Layout function returned None" in caplog.text


# =============================================================================
# A second init() call for the same app
# =============================================================================


def test_second_init_for_static_layout_registers_no_second_callback(
    prism_app: Dash, caplog: pytest.LogCaptureFixture
) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))

    dash_prism.init("test-prism", prism_app)
    with caplog.at_level(logging.INFO, logger="dash_prism"):
        dash_prism.init("test-prism", prism_app)

    assert len(prism_app._callback_list) == 1
    assert "already connected" in caplog.text


def test_second_init_still_rejects_invalid_arguments(prism_app: Dash) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_prism.init("test-prism", prism_app)

    with pytest.raises(dash_prism.InitializationError, match="prism_id"):
        dash_prism.init("", prism_app)


def test_init_for_another_app_registers_its_own_callback() -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    apps = [Dash(__name__, suppress_callback_exceptions=True) for _ in range(2)]
    for app in apps:
        app.layout = html.Div([dash_prism.Prism(id="test-prism", style={})])
        dash_prism.init("test-prism", app)

    assert [len(app._callback_list) for app in apps] == [1, 1]


def _two_prisms() -> html.Div:
    return html.Div([dash_prism.Prism(id="left", style={}), dash_prism.Prism(id="right", style={})])


def test_init_for_each_prism_id_fills_its_component_and_registers_one_callback(
    dash_app: Dash,
) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_app.layout = _two_prisms()

    dash_prism.init("left", dash_app)
    dash_prism.init("right", dash_app)
    dash_prism.init("left", dash_app)

    for prism_id in ("left", "right"):
        prism = layout_tree.find_component_by_id(dash_app.layout, prism_id)
        assert "home" in prism.registeredLayouts
    assert len(dash_app._callback_list) == 1


def test_init_for_each_prism_id_wraps_a_callable_layout_for_each_id(dash_app: Dash) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_app.layout = _two_prisms

    dash_prism.init("left", dash_app)
    left_wrapper = dash_app.layout
    dash_prism.init("right", dash_app)
    both_wrapper = dash_app.layout
    dash_prism.init("left", dash_app)
    dash_prism.init("right", dash_app)

    assert both_wrapper is not left_wrapper
    assert dash_app.layout is both_wrapper
    layout = dash_app.layout()
    for prism_id in ("left", "right"):
        assert "home" in layout_tree.find_component_by_id(layout, prism_id).registeredLayouts
    assert len(dash_app._callback_list) == 1


def test_init_after_setting_a_static_layout_again_fills_the_new_layout(dash_app: Dash) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_app.layout = html.Div([dash_prism.Prism(id="test-prism", style={})])
    dash_prism.init("test-prism", dash_app)

    new_layout = html.Div([dash_prism.Prism(id="test-prism", style={})])
    dash_app.layout = new_layout
    dash_prism.init("test-prism", dash_app)

    assert "home" in layout_tree.find_component_by_id(new_layout, "test-prism").registeredLayouts
    assert len(dash_app._callback_list) == 1


def test_init_after_setting_a_callable_layout_again_wraps_the_new_layout(dash_app: Dash) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))

    def first_layout():
        return html.Div([dash_prism.Prism(id="test-prism", style={})])

    def second_layout():
        return html.Div([dash_prism.Prism(id="test-prism", style={})])

    dash_app.layout = first_layout
    dash_prism.init("test-prism", dash_app)
    dash_app.layout = second_layout
    dash_prism.init("test-prism", dash_app)

    prism = layout_tree.find_component_by_id(dash_app.layout(), "test-prism")
    assert "home" in prism.registeredLayouts
    assert len(dash_app._callback_list) == 1


def test_init_replaces_a_registered_layouts_value_that_the_application_set(
    dash_app: Dash,
) -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_app.layout = html.Div([dash_prism.Prism(id="test-prism", registeredLayouts={}, style={})])

    dash_prism.init("test-prism", dash_app)

    prism = layout_tree.find_component_by_id(dash_app.layout, "test-prism")
    assert "home" in prism.registeredLayouts
    assert len(dash_app._callback_list) == 1


def test_init_registers_a_callback_for_each_app_that_shares_a_prism_component() -> None:
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    prism = dash_prism.Prism(id="test-prism", style={})
    apps = [Dash(__name__, suppress_callback_exceptions=True) for _ in range(2)]
    for app in apps:
        app.layout = html.Div([prism])
        dash_prism.init("test-prism", app)

    assert "home" in prism.registeredLayouts
    assert [len(app._callback_list) for app in apps] == [1, 1]


def test_init_accepts_a_callable_layout_that_has_no_weak_reference(dash_app: Dash) -> None:
    class SlottedLayout:
        __slots__ = ()

        def __call__(self) -> html.Div:
            return html.Div([dash_prism.Prism(id="test-prism", style={})])

    dash_prism.register_layout(id="home", name="Home", layout=html.Div("home"))
    dash_app.layout = SlottedLayout()

    dash_prism.init("test-prism", dash_app)
    wrapper = dash_app.layout
    dash_prism.init("test-prism", dash_app)

    assert dash_app.layout is wrapper
    prism = layout_tree.find_component_by_id(dash_app.layout(), "test-prism")
    assert "home" in prism.registeredLayouts
    assert len(dash_app._callback_list) == 1


def test_registry_is_the_singleton_and_app_init_uses_the_module() -> None:
    # The public name dash_prism.registry is the singleton object. The module
    # has another name, so the order of the imports in __init__.py cannot hide it.
    assert isinstance(dash_prism.registry, dash_prism.LayoutRegistry)
    assert dash_prism.registry is layout_registry.registry
    assert app_init.layout_registry is sys.modules["dash_prism.layout_registry"]
