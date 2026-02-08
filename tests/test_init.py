"""
Tests for dash_prism initialization functionality.
"""

from __future__ import annotations

import pytest
from dash import Dash, html, dcc
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

    # Verify serverSessionId was injected
    assert hasattr(prism, "serverSessionId")
    assert prism.serverSessionId is not None


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

    # Verify serverSessionId was injected
    assert hasattr(prism, "serverSessionId")
    assert prism.serverSessionId is not None


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
