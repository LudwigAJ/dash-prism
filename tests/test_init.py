"""
Tests for dash_prism initialization functionality.
"""

from __future__ import annotations

import pytest
from dash import Dash, html

import dash_prism


def test_init_basic(prism_app: Dash) -> None:
    """Test basic initialization."""
    # Register a simple layout
    dash_prism.register_layout(
        id="test-layout",
        name="Test Layout",
        layout=html.Div("Test"),
    )

    # Initialize should not raise
    dash_prism.init("test-prism", prism_app)

    # Check that callback was registered
    assert len(prism_app.callback_map) > 0


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
    dash_app.layout = html.Div("No Prism here")

    with pytest.warns(UserWarning, match="Could not find Prism component"):
        dash_prism.init("nonexistent", dash_app)


def test_init_with_callback_layout(prism_app: Dash) -> None:
    """Test initialization with callback-based layout."""

    @dash_prism.register_layout(id="callback-layout", name="Callback Layout")
    def my_layout():
        return html.Div("From callback")

    dash_prism.init("test-prism", prism_app)

    # Check callback was created
    assert len(prism_app.callback_map) > 0


def test_init_with_async_layout(prism_app: Dash) -> None:
    """Test initialization with async layout callback."""

    @dash_prism.register_layout(id="async-layout", name="Async Layout")
    async def async_layout():
        return html.Div("Async content")

    # Should work even if app is not async (will use asyncio.run internally)
    dash_prism.init("test-prism", prism_app)

    assert len(prism_app.callback_map) > 0


def test_init_with_parameterized_layout(prism_app: Dash) -> None:
    """Test initialization with parameterized layout."""

    @dash_prism.register_layout(
        id="param-layout",
        name="Parameterized",
        param_options={
            "opt1": ("Option 1", {"value": "1"}),
            "opt2": ("Option 2", {"value": "2"}),
        },
    )
    def param_layout(value: str = "1"):
        return html.Div(f"Value: {value}")

    dash_prism.init("test-prism", prism_app)

    assert len(prism_app.callback_map) > 0


def test_init_multiple_static_layouts(prism_app: Dash) -> None:
    """Test initialization with multiple static layouts."""
    dash_prism.register_layout(
        id="layout1",
        name="Layout 1",
        layout=html.Div("Layout 1"),
    )
    dash_prism.register_layout(
        id="layout2",
        name="Layout 2",
        layout=html.Div("Layout 2"),
    )
    dash_prism.register_layout(
        id="layout3",
        name="Layout 3",
        layout=html.Div("Layout 3"),
    )

    dash_prism.init("test-prism", prism_app)

    # Should have created callback
    assert len(prism_app.callback_map) > 0


def test_init_nested_prism_component(dash_app: Dash) -> None:
    """Test finding Prism component nested in layout."""
    dash_app.layout = html.Div(
        [html.Div([html.Div([dash_prism.Prism(id="nested-prism", style={})])])]
    )

    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test"))

    # Should find the nested component
    dash_prism.init("nested-prism", dash_app)

    assert len(dash_app.callback_map) > 0


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
    with pytest.raises(dash_prism.InitializationError):
        dash_prism.init(None, prism_app)  # type: ignore


# ============================================================================
# Additional tests for better coverage
# ============================================================================


def test_init_with_complex_nested_layout(dash_app: Dash) -> None:
    """Test finding Prism in deeply nested layout with None children."""
    dash_app.layout = html.Div(
        [
            html.Div(children=None),  # None children
            html.Div(
                [
                    "text node",  # Text node
                    html.Span("span"),  # Non-container
                    html.Div([dash_prism.Prism(id="deep-prism", style={})]),
                ]
            ),
        ]
    )

    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test"))
    dash_prism.init("deep-prism", dash_app)
    assert len(dash_app.callback_map) > 0


def test_init_with_single_child_not_list(dash_app: Dash) -> None:
    """Test finding Prism when children is not a list."""
    dash_app.layout = html.Div(
        html.Div(  # Single child, not wrapped in list
            dash_prism.Prism(id="single-child-prism", style={})
        )
    )

    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test"))
    dash_prism.init("single-child-prism", dash_app)
    assert len(dash_app.callback_map) > 0


def test_init_with_callback_with_no_params(prism_app: Dash) -> None:
    """Test callback layout with no parameters."""

    @dash_prism.register_layout(id="no-params", name="No Params")
    def layout_no_params():
        return html.Div("No parameters")

    dash_prism.init("test-prism", prism_app)
    assert len(prism_app.callback_map) > 0


def test_init_with_callback_with_multiple_params(prism_app: Dash) -> None:
    """Test callback layout with multiple parameters."""

    @dash_prism.register_layout(id="multi-param", name="Multi Param")
    def layout_multi_param(x: int = 1, y: str = "default", z: bool = True):
        return html.Div(f"x={x}, y={y}, z={z}")

    metadata = dash_prism.get_registered_layouts_metadata()
    assert "multi-param" in metadata
    # Layout with callback should be registered
    assert metadata["multi-param"]["name"] == "Multi Param"

    dash_prism.init("test-prism", prism_app)
    assert len(prism_app.callback_map) > 0


def test_init_with_async_app() -> None:
    """Test initialization with async Dash app."""
    try:
        app = Dash(__name__, use_async=True, suppress_callback_exceptions=True)
    except Exception as exc:
        pytest.fail(f"Dash app does not support use_async: {exc}")

    app.layout = html.Div([dash_prism.Prism(id="async-prism", style={})])

    @dash_prism.register_layout(id="async-layout", name="Async")
    async def async_layout():
        return html.Div("Async")

    # Should not warn about async mismatch
    dash_prism.init("async-prism", app)
    assert len(app.callback_map) > 0


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

    # After init, the component should have registeredLayouts (if supported)
    # Some versions may not support this property
    if hasattr(prism_component, "registeredLayouts"):
        assert prism_component.registeredLayouts is not None
        assert isinstance(prism_component.registeredLayouts, dict)
        assert "metadata-test" in prism_component.registeredLayouts


def test_init_with_layout_returning_none(prism_app: Dash) -> None:
    """Test callback that returns None."""

    @dash_prism.register_layout(id="none-layout", name="None Layout")
    def layout_returns_none():
        return None

    dash_prism.init("test-prism", prism_app)
    assert len(prism_app.callback_map) > 0


def test_init_with_layout_returning_string(prism_app: Dash) -> None:
    """Test callback that returns a string."""

    @dash_prism.register_layout(id="string-layout", name="String Layout")
    def layout_returns_string():
        return "Just a string"

    dash_prism.init("test-prism", prism_app)
    assert len(prism_app.callback_map) > 0


def test_init_with_layout_returning_list(prism_app: Dash) -> None:
    """Test callback that returns a list of components."""

    @dash_prism.register_layout(id="list-layout", name="List Layout")
    def layout_returns_list():
        return [html.Div("First"), html.Div("Second")]

    dash_prism.init("test-prism", prism_app)
    assert len(prism_app.callback_map) > 0


def test_init_with_deeply_nested_components(dash_app: Dash) -> None:
    """Test finding component in very deeply nested structure."""
    # Create a deeply nested structure
    nested = dash_prism.Prism(id="deeply-nested", style={})
    for _ in range(10):  # 10 levels deep
        nested = html.Div(nested)

    dash_app.layout = nested

    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test"))
    dash_prism.init("deeply-nested", dash_app)
    assert len(dash_app.callback_map) > 0


def test_init_with_mixed_content(dash_app: Dash) -> None:
    """Test finding component among mixed content types."""
    dash_app.layout = html.Div(
        [
            "String content",
            123,  # Number
            None,  # None
            html.Div("Div"),
            html.Div([html.Span("Nested list")]),  # Nested content
            dash_prism.Prism(id="mixed-prism", style={}),
        ]
    )

    dash_prism.register_layout(id="test", name="Test", layout=html.Div("Test"))
    dash_prism.init("mixed-prism", dash_app)
    assert len(dash_app.callback_map) > 0


# =============================================================================
# layoutParams Null-Handling Tests
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
    from dash_prism.init import _render_tab_layout

    result = _render_tab_layout("tab-1", "zero-arg", None)

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

    from dash_prism.init import _render_tab_layout

    result = _render_tab_layout("tab-1", "empty-params", {})

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

    from dash_prism.init import _render_tab_layout

    result = _render_tab_layout("tab-1", "with-params", {"user_id": "abc123", "count": "5"})

    assert result is not None
    assert received_params["user_id"] == "abc123"
    assert received_params["count"] == "5"


# =============================================================================
# Callable Layout Support Tests (Solution 1)
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
    from dash_prism.init import _find_component_by_id

    prism = _find_component_by_id(layout_result, "prism-callable")
    assert prism is not None

    # Verify metadata was injected
    assert hasattr(prism, "registeredLayouts")
    assert prism.registeredLayouts is not None
    assert isinstance(prism.registeredLayouts, dict)
    assert "test-layout" in prism.registeredLayouts
    assert prism.registeredLayouts["test-layout"]["name"] == "Test Layout"

    # Verify the derived serverSessionId fingerprint was injected
    from dash_prism.init import _compute_server_session_id

    assert prism.serverSessionId == _compute_server_session_id(dash_prism.registry)


def test_callable_layout_async(dash_app: Dash) -> None:
    """Test async callable app.layout with metadata injection."""
    import asyncio

    @dash_prism.register_layout(id="async-test-layout", name="Async Test Layout")
    async def async_test_layout():
        return html.Div("Async test content")

    # Set app.layout as an async callable function
    async def async_layout():
        return html.Div([dash_prism.Prism(id="prism-async-callable", style={})])

    dash_app.layout = async_layout
    dash_prism.init("prism-async-callable", dash_app)

    # Verify wrapper is async
    assert asyncio.iscoroutinefunction(dash_app.layout)

    # Call layout function and verify metadata is injected
    layout_result = asyncio.run(dash_app.layout())
    assert layout_result is not None

    # Find the Prism component in the result
    from dash_prism.init import _find_component_by_id

    prism = _find_component_by_id(layout_result, "prism-async-callable")
    assert prism is not None

    # Verify metadata was injected
    assert hasattr(prism, "registeredLayouts")
    assert prism.registeredLayouts is not None
    assert isinstance(prism.registeredLayouts, dict)
    assert "async-test-layout" in prism.registeredLayouts

    # Verify the derived serverSessionId fingerprint was injected
    from dash_prism.init import _compute_server_session_id

    assert prism.serverSessionId == _compute_server_session_id(dash_prism.registry)


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
    from unittest.mock import MagicMock

    mock_request = MagicMock()
    layout_result = dash_app.layout(request=mock_request)
    assert layout_result is not None

    # Find the Prism component
    from dash_prism.init import _find_component_by_id

    prism = _find_component_by_id(layout_result, "prism-with-params")
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
    from dash_prism.init import _find_component_by_id

    for i in range(3):
        layout_result = dash_app.layout()
        prism = _find_component_by_id(layout_result, "prism-multi-call")
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
    from dash_prism.init import _find_component_by_id

    prism_before = _find_component_by_id(dash_app.layout, "prism-static")

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

    # Call init multiple times
    dash_prism.init("prism-multi-init", dash_app)
    first_wrapper = dash_app.layout

    dash_prism.init("prism-multi-init", dash_app)
    second_wrapper = dash_app.layout

    dash_prism.init("prism-multi-init", dash_app)
    third_wrapper = dash_app.layout

    # Verify it's the same wrapper (not re-wrapped)
    assert first_wrapper is second_wrapper
    assert second_wrapper is third_wrapper

    # Verify the wrapper still works correctly
    layout_result = dash_app.layout()
    from dash_prism.init import _find_component_by_id

    prism = _find_component_by_id(layout_result, "prism-multi-init")
    assert prism is not None
    assert hasattr(prism, "registeredLayouts")


def test_callable_layout_exception_handling(dash_app: Dash) -> None:
    """Test that exceptions in callable layout are propagated correctly."""

    def failing_layout():
        raise ValueError("Layout generation failed")

    dash_app.layout = failing_layout

    # Init should succeed (wrapping doesn't call the layout)
    # But we need to suppress the warning about not finding Prism
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        dash_prism.init("prism-test", dash_app)

    # Calling the layout should raise the original exception
    with pytest.raises(ValueError, match="Layout generation failed"):
        dash_app.layout()


# =============================================================================
# Async Layout Rendering Regression Tests
# =============================================================================


def test_async_render_tab_layout_returns_component_not_coroutine(prism_app: Dash) -> None:
    """Regression test: _render_tab_layout_async must await the callback runner.

    Previously, _render_tab_layout_async delegated to the synchronous
    _render_tab_layout_impl which called _run_callback_async without awaiting
    the returned coroutine. The result was a coroutine object passed to
    inject_tab_id instead of a Dash component tree.
    """
    import asyncio

    @dash_prism.register_layout(id="async-render-test", name="Async Render Test")
    async def async_layout():
        return html.Div("Async rendered content", id="async-rendered")

    dash_prism.init("test-prism", prism_app)

    from dash_prism.init import _render_tab_layout_async

    result = asyncio.run(_render_tab_layout_async("tab-1", "async-render-test", None))

    # The result must be a Dash component, NOT a coroutine
    assert result is not None
    assert not asyncio.iscoroutine(result), (
        "_render_tab_layout_async returned a coroutine instead of a component. "
        "The callback runner's coroutine was not awaited."
    )
    assert hasattr(result, "children"), "Result should be a Dash component with children"


def test_async_render_sync_callback_in_async_context(prism_app: Dash) -> None:
    """Test that sync callbacks work correctly when rendered via async path."""
    import asyncio

    invoked = []

    @dash_prism.register_layout(id="sync-in-async", name="Sync In Async")
    def sync_layout():
        invoked.append(True)
        return html.Div("Sync content in async context")

    dash_prism.init("test-prism", prism_app)

    from dash_prism.init import _render_tab_layout_async

    result = asyncio.run(_render_tab_layout_async("tab-1", "sync-in-async", None))

    assert result is not None
    assert len(invoked) == 1, "Sync callback should have been invoked once"
    assert not asyncio.iscoroutine(result)


def test_async_render_with_params(prism_app: Dash) -> None:
    """Test async layout rendering with parameters."""
    import asyncio

    received = {}

    @dash_prism.register_layout(id="async-params", name="Async Params")
    async def async_param_layout(mode: str = "default"):
        received["mode"] = mode
        return html.Div(f"Mode: {mode}")

    dash_prism.init("test-prism", prism_app)

    from dash_prism.init import _render_tab_layout_async

    result = asyncio.run(_render_tab_layout_async("tab-1", "async-params", {"mode": "advanced"}))

    assert result is not None
    assert not asyncio.iscoroutine(result)
    assert received["mode"] == "advanced"


def test_async_render_static_layout(prism_app: Dash) -> None:
    """Test that static layouts (no callback) work via async path."""
    import asyncio

    dash_prism.register_layout(
        id="async-static",
        name="Async Static",
        layout=html.Div("Static in async", id="async-static-content"),
    )

    dash_prism.init("test-prism", prism_app)

    from dash_prism.init import _render_tab_layout_async

    result = asyncio.run(_render_tab_layout_async("tab-1", "async-static", None))

    assert result is not None
    assert not asyncio.iscoroutine(result)


# =============================================================================
# layoutTimeout plumbing (01 §1.1 / 02 B-3)
# =============================================================================


def test_coerce_timeout_accepts_positive_numbers_and_numeric_strings() -> None:
    from dash_prism.init import _coerce_timeout

    assert _coerce_timeout(12) == 12.0
    assert _coerce_timeout(2.5) == 2.5
    assert _coerce_timeout("7") == 7.0
    assert _coerce_timeout("0.25") == 0.25


@pytest.mark.parametrize(
    "bad",
    [None, "abc", "", 0, -1, 0.0, float("inf"), float("nan"), True, False, [], {}, 10**400],
)
def test_coerce_timeout_falls_back_to_default(bad: object) -> None:
    from dash_prism.init import DEFAULT_LAYOUT_TIMEOUT, _coerce_timeout

    assert _coerce_timeout(bad) == DEFAULT_LAYOUT_TIMEOUT
    assert _coerce_timeout(bad, default=5.0) == 5.0


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
    from dash.exceptions import PreventUpdate

    from dash_prism.init import _parse_content_request

    with pytest.raises(PreventUpdate):
        _parse_content_request(content_id, data)


def test_parse_content_request_extracts_fields_and_timeout() -> None:
    from dash_prism.init import DEFAULT_LAYOUT_TIMEOUT, _parse_content_request

    content_id = {"type": "prism-content", "index": "t1"}

    assert _parse_content_request(
        content_id,
        {"layoutId": "home", "layoutParams": {"a": "1"}, "layoutOption": "", "timeout": 12},
    ) == ("t1", "home", {"a": "1"}, None, 12.0)

    assert _parse_content_request(content_id, {"layoutId": "home"}) == (
        "t1",
        "home",
        None,
        None,
        DEFAULT_LAYOUT_TIMEOUT,
    )

    assert _parse_content_request(
        content_id, {"layoutId": "chart", "layoutOption": "bar", "timeout": None}
    ) == ("t1", "chart", None, "bar", DEFAULT_LAYOUT_TIMEOUT)


def _error_message(component: object) -> str:
    """Text of the ``html.Pre`` inside an error component from ``_create_error_component``."""
    return str(component.children[1].children)  # type: ignore[attr-defined]


def _sync_prism_app() -> Dash:
    """A Dash app forced into sync mode.

    On every supported Dash (>= 3.1.1) use_async defaults to True when the async
    extras are installed, so the sync render callback must be requested explicitly.
    """
    app = Dash(__name__, use_async=False, suppress_callback_exceptions=True)
    app.layout = html.Div([dash_prism.Prism(id="test-prism", style={})])
    return app


def test_sync_callback_honours_client_timeout_for_async_layouts() -> None:
    """Regression for 01 §1.1: the sync callback used to ignore data["timeout"]."""
    import asyncio

    app = _sync_prism_app()

    @dash_prism.register_layout(id="slow-async", name="Slow Async")
    async def slow_layout():
        await asyncio.sleep(0.3)
        return html.Div("done", id="slow-done")

    # Sync mode with an async layout: init() warns, and the callback runs the
    # layout through asyncio.run(wait_for(...)) with the client's timeout.
    with pytest.warns(UserWarning, match="async"):
        dash_prism.init("test-prism", app)

    from dash_prism.init import _render_content_request

    content_id = {"type": "prism-content", "index": "tab-1"}

    timed_out = _render_content_request(content_id, {"layoutId": "slow-async", "timeout": 0.05})
    assert timed_out.className == "prism-error-tab"
    assert "timed out after 0.05s" in _error_message(timed_out)

    rendered = _render_content_request(content_id, {"layoutId": "slow-async", "timeout": 5})
    assert rendered.id == {"type": "slow-done", "index": "tab-1"}


def test_sync_callback_uses_default_timeout_when_client_sends_garbage() -> None:
    import asyncio

    app = _sync_prism_app()

    @dash_prism.register_layout(id="quick-async", name="Quick Async")
    async def quick_layout():
        await asyncio.sleep(0.01)
        return html.Div("ok", id="quick-done")

    with pytest.warns(UserWarning, match="async"):
        dash_prism.init("test-prism", app)

    from dash_prism.init import _render_content_request

    content_id = {"type": "prism-content", "index": "tab-1"}
    rendered = _render_content_request(content_id, {"layoutId": "quick-async", "timeout": "abc"})
    assert rendered.id == {"type": "quick-done", "index": "tab-1"}


def test_async_callback_honours_client_timeout() -> None:
    import asyncio

    app = Dash(__name__, use_async=True, suppress_callback_exceptions=True)
    app.layout = html.Div([dash_prism.Prism(id="async-prism", style={})])

    @dash_prism.register_layout(id="slow-async", name="Slow Async")
    async def slow_layout():
        await asyncio.sleep(0.3)
        return html.Div("done", id="slow-done")

    @dash_prism.register_layout(id="slow-sync", name="Slow Sync")
    def slow_sync_layout():
        import time

        # The executor branch is asyncio.wait_for(run_in_executor(...)); on Python
        # 3.10/3.11 a finished executor future wins over an expired timer, so keep
        # a wide margin between this sleep and the 0.05 s timeout below.
        time.sleep(1.0)
        return html.Div("done", id="slow-sync-done")

    dash_prism.init("async-prism", app)

    from dash_prism.init import _render_content_request_async

    content_id = {"type": "prism-content", "index": "tab-1"}

    for layout_id in ("slow-async", "slow-sync"):
        timed_out = asyncio.run(
            _render_content_request_async(content_id, {"layoutId": layout_id, "timeout": 0.05})
        )
        assert timed_out.className == "prism-error-tab"
        assert "timed out after 0.05s" in _error_message(timed_out)

    rendered = asyncio.run(
        _render_content_request_async(content_id, {"layoutId": "slow-async", "timeout": 5})
    )
    assert rendered.id == {"type": "slow-done", "index": "tab-1"}


def test_render_content_request_raises_prevent_update_for_bad_input(prism_app: Dash) -> None:
    import asyncio

    from dash.exceptions import PreventUpdate

    from dash_prism.init import _render_content_request, _render_content_request_async

    with pytest.raises(PreventUpdate):
        _render_content_request({"type": "prism-content", "index": "t"}, {})
    with pytest.raises(PreventUpdate):
        asyncio.run(_render_content_request_async(None, {"layoutId": "x"}))


def test_render_callback_is_registered_once(prism_app: Dash) -> None:
    dash_prism.register_layout(id="static", name="Static", layout=html.Div("s"))
    dash_prism.init("test-prism", prism_app)

    keys = [k for k in prism_app.callback_map if "prism-content" in k]
    assert len(keys) == 1


def test_registered_sync_callback_passes_client_timeout() -> None:
    """Regression through the real Dash dispatcher: the registered sync callback
    must forward data["timeout"] (the wrapper is where 01 §1.1 lived)."""
    import asyncio
    import json

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
                "value": {"tabId": "tab-1", "layoutId": "slow-async", "timeout": 0.05},
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
# serverSessionId (01 §1.3 / 02 B-2)
# =============================================================================


def test_compute_server_session_id_is_stable_and_order_independent() -> None:
    from dash_prism.init import _compute_server_session_id

    a = _compute_server_session_id(["home", "about"])
    assert a == _compute_server_session_id(["about", "home"])
    assert a == _compute_server_session_id(iter(["home", "about"]))
    assert len(a) == 12 and all(c in "0123456789abcdef" for c in a)
    assert a != _compute_server_session_id(["home"])
    assert a != _compute_server_session_id(["home", "about", "extra"])
    assert _compute_server_session_id([]) == _compute_server_session_id(())


def test_init_injects_layout_fingerprint_as_server_session_id(prism_app: Dash) -> None:
    from dash_prism.init import _compute_server_session_id, _find_component_by_id

    dash_prism.register_layout(id="home", name="Home", layout=html.Div("h"))
    dash_prism.register_layout(id="about", name="About", layout=html.Div("a"))
    dash_prism.init("test-prism", prism_app)

    prism = _find_component_by_id(prism_app.layout, "test-prism")
    assert prism.serverSessionId == _compute_server_session_id(["about", "home"])


def test_init_keeps_an_explicit_server_session_id() -> None:
    from dash_prism.init import _find_component_by_id

    app = Dash(__name__, suppress_callback_exceptions=True)
    app.layout = html.Div([dash_prism.Prism(id="p", serverSessionId="release-42", style={})])
    dash_prism.register_layout(id="home", name="Home", layout=html.Div("h"))
    dash_prism.init("p", app)

    assert _find_component_by_id(app.layout, "p").serverSessionId == "release-42"


def test_callable_layout_keeps_an_explicit_server_session_id(dash_app: Dash) -> None:
    """The override must survive the per-render injection of the callable path too."""
    from dash_prism.init import _find_component_by_id

    dash_prism.register_layout(id="home", name="Home", layout=html.Div("h"))

    def layout():
        return html.Div([dash_prism.Prism(id="p", serverSessionId="release-42", style={})])

    dash_app.layout = layout
    dash_prism.init("p", dash_app)

    prism = _find_component_by_id(dash_app.layout(), "p")
    assert prism.serverSessionId == "release-42"
    assert "home" in prism.registeredLayouts


def test_per_process_server_session_id_constant_is_gone() -> None:
    """The per-process UUID could never match across gunicorn workers or restarts."""
    assert "SERVER_SESSION_ID" not in dash_prism.__all__
    assert not hasattr(dash_prism, "SERVER_SESSION_ID")


# =============================================================================
# Parameter validation in the render paths (doc 04 §3.3)
# =============================================================================


def test_render_invalid_params_returns_validation_component(prism_app: Dash) -> None:
    @dash_prism.register_layout(id="typed", name="Typed")
    def layout(n: int = 1):
        return html.Div(f"n={n}")

    dash_prism.init("test-prism", prism_app)
    from dash_prism.init import _render_tab_layout

    result = _render_tab_layout("tab-1", "typed", {"n": "abc"})
    assert "prism-error-validation" in result.className
    assert "n" in str(result.children[2].children[0].children[0].children)


def test_render_coerces_params_before_callback(prism_app: Dash) -> None:
    received: dict[str, object] = {}

    @dash_prism.register_layout(id="typed", name="Typed")
    def layout(n: int = 1, flag: bool = False):
        received.update(n=n, flag=flag)
        return html.Div()

    dash_prism.init("test-prism", prism_app)
    from dash_prism.init import _render_tab_layout

    _render_tab_layout("tab-1", "typed", {"n": "5", "flag": "false"})
    assert received == {"n": 5, "flag": False}


def test_async_render_validation_error(prism_app: Dash) -> None:
    import asyncio

    @dash_prism.register_layout(id="typed-async", name="Typed async")
    async def layout(n: int = 1):
        return html.Div()

    dash_prism.init("test-prism", prism_app)
    from dash_prism.init import _render_tab_layout_async

    result = asyncio.run(_render_tab_layout_async("tab-1", "typed-async", {"n": "x"}))
    assert "prism-error-validation" in result.className
