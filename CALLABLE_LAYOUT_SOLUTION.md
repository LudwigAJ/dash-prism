# Callable Layout Support Solutions

## Problem Statement

When `app.layout` is defined as a callable function (e.g., `app.layout = lambda: html.Div([...])`), `dash_prism.init()` fails to properly inject metadata into the Prism component.

**Root Cause**:
- During `init()`, we resolve the callable layout once, find the Prism component, and inject `registeredLayouts` metadata
- When Dash renders the page, it calls the layout function again, creating a **new component instance** without the injected metadata
- The React frontend receives an empty `registeredLayouts={}` prop, making the workspace non-functional

**Scope**:
- Must support both static layouts (`app.layout = html.Div(...)`) and callable layouts (`app.layout = function`)
- Must handle sync and async layout functions
- Must support layout functions that accept parameters (Dash 2.0+ request context)
- Should not break existing functionality

---

## Solution 1: Layout Function Wrapping

### Overview

Replace `app.layout` with a wrapper function that automatically injects metadata into the Prism component on every render.

### Implementation Strategy

```python
def init(prism_id: str, app: "Dash") -> None:
    """Initialize Prism with support for callable layouts."""
    from functools import wraps
    import asyncio

    # ... existing validation ...

    # Capture metadata at init time (registry is frozen after this)
    layouts_metadata = get_registered_layouts_metadata()
    session_id = SERVER_SESSION_ID

    def _inject_metadata_into_layout(layout_tree: Any) -> Any:
        """Find Prism component and inject metadata."""
        prism = _find_component_by_id(layout_tree, prism_id)
        if prism is not None:
            prism.registeredLayouts = layouts_metadata
            if getattr(prism, "serverSessionId", None) is None:
                prism.serverSessionId = session_id
        return layout_tree

    original_layout = app.layout

    # Check if layout is callable
    if callable(original_layout):
        # Detect if async or sync
        if asyncio.iscoroutinefunction(original_layout):
            # Async layout function
            @wraps(original_layout)
            async def wrapped_async_layout(*args, **kwargs):
                layout_tree = await original_layout(*args, **kwargs)
                return _inject_metadata_into_layout(layout_tree)

            app.layout = wrapped_async_layout
        else:
            # Sync layout function
            @wraps(original_layout)
            def wrapped_sync_layout(*args, **kwargs):
                layout_tree = original_layout(*args, **kwargs)
                return _inject_metadata_into_layout(layout_tree)

            app.layout = wrapped_sync_layout
    else:
        # Static layout - inject once (existing behavior)
        _inject_metadata_into_layout(original_layout)

    # ... rest of init (callback registration) ...
```

### Edge Cases Handled

1. **Async layout functions**: Uses `asyncio.iscoroutinefunction()` to detect and wrap appropriately
2. **Layout functions with parameters**: Uses `*args, **kwargs` to forward Dash's request context
3. **Multiple init() calls**: Each call re-wraps the layout (acceptable for hot reload scenarios)
4. **Prism component not found**: Gracefully continues without error (consistent with current behavior)

### Pros

- ✅ **Complete solution**: Works for all layout types (static, sync callable, async callable)
- ✅ **Minimal changes**: Contained entirely in `init.py`, no frontend changes
- ✅ **Transparent to users**: No API changes, existing code works unchanged
- ✅ **Follows Dash patterns**: Similar to how other extensions initialize (e.g., Dash Bootstrap Components)
- ✅ **Preserves function metadata**: Uses `functools.wraps` for debugging
- ✅ **Type-safe**: Maintains all type hints and signatures

### Cons

- ⚠️ **Performance overhead**: Tree traversal on every page render for callable layouts
  - Impact: O(n) where n = number of components (typically <100, negligible)
  - Optimization: Could cache the path to Prism component after first find
- ⚠️ **Mutates app state**: Replaces `app.layout` with wrapper
  - Mitigated by: This happens during initialization, not at runtime
- ⚠️ **Debugging complexity**: Call stack includes wrapper function
  - Mitigated by: `functools.wraps` preserves function name

### Risk Assessment

**Risk Level**: **Low**

- No breaking changes to public API
- Isolated to initialization logic
- Easily reversible if issues arise
- Well-understood pattern in Python ecosystem

### Testing Strategy

```python
# Unit tests
def test_callable_layout_sync():
    app = Dash(__name__)
    app.layout = lambda: html.Div([dash_prism.Prism(id='p')])
    dash_prism.init('p', app)

    # Call layout function and verify metadata
    layout = app.layout()
    prism = _find_component_by_id(layout, 'p')
    assert prism.registeredLayouts == expected_metadata

def test_callable_layout_async():
    app = Dash(__name__, use_async=True)
    async def layout():
        return html.Div([dash_prism.Prism(id='p')])
    app.layout = layout
    dash_prism.init('p', app)

    # Verify wrapper is async
    layout_result = asyncio.run(app.layout())
    prism = _find_component_by_id(layout_result, 'p')
    assert prism.registeredLayouts == expected_metadata

def test_callable_layout_with_params():
    app = Dash(__name__)
    def layout(request=None):
        return html.Div([dash_prism.Prism(id='p')])
    app.layout = layout
    dash_prism.init('p', app)

    # Verify parameters are forwarded
    from unittest.mock import MagicMock
    mock_request = MagicMock()
    layout_result = app.layout(request=mock_request)
    assert layout_result is not None
```

---

## Solution 2: Server-Side Metadata Store with Clientside Injection

### Overview

Store `registeredLayouts` metadata in a server-side store (e.g., Flask session or hidden Dash Store component) and use a clientside callback to inject it into the Prism component after mount.

### Implementation Strategy

**Python Side** (`dash_prism/init.py`):

```python
def init(prism_id: str, app: "Dash") -> None:
    """Initialize Prism with metadata store."""
    from dash import dcc, html, Input, Output, clientside_callback

    # ... existing validation ...

    # Store metadata globally accessible
    metadata = get_registered_layouts_metadata()
    session_id = SERVER_SESSION_ID

    # Option A: Use Flask session (requires Flask app)
    # app.server.config['PRISM_METADATA'] = metadata

    # Option B: Inject a hidden Store component
    # This requires modifying the layout, which is complex for callable layouts

    # Create a server callback that provides metadata
    @app.callback(
        Output(f'{prism_id}-metadata-store', 'data'),
        Input(f'{prism_id}-metadata-store', 'id'),
    )
    def provide_metadata(_):
        return {
            'registeredLayouts': metadata,
            'serverSessionId': session_id
        }

    # Clientside callback to inject into component
    # (Would require frontend changes to trigger this)
    clientside_callback(
        """
        function(metadata) {
            if (metadata) {
                // Somehow inject into Prism component props
                // This is complex because React props are immutable
            }
        }
        """,
        Output(prism_id, 'data-injected'),  # Dummy output
        Input(f'{prism_id}-metadata-store', 'data')
    )
```

**TypeScript Side** (`src/ts/components/Prism.tsx`):

```typescript
// Would need to add effect to wait for metadata
useEffect(() => {
  if (!props.registeredLayouts || props.registeredLayouts.length === 0) {
    // Wait for metadata from callback
    setLoadingMetadata(true);
  }
}, [props.registeredLayouts]);
```

### Pros

- ✅ **No layout mutation**: Doesn't modify `app.layout`
- ✅ **Separation of concerns**: Metadata is data, not props
- ✅ **Potentially more scalable**: Metadata could be fetched dynamically

### Cons

- ❌ **Major architectural change**: Requires coordinated Python + TypeScript refactoring
- ❌ **Frontend complexity**: Must handle loading states, race conditions, async initialization
- ❌ **Breaking change**: Prism component behavior changes (might flash empty state)
- ❌ **Performance**: Additional callback round-trip on page load
- ❌ **Complexity**: Two sources of truth (prop vs callback data)
- ❌ **Difficult with callable layouts**: Still need to inject the Store component somewhere

### Risk Assessment

**Risk Level**: **High**

- Requires extensive changes across codebase
- Introduces loading states and race conditions
- May break existing user code expectations
- Significantly delays time-to-interactive

### Recommendation

**Not Recommended**: The complexity and breaking changes outweigh the benefits. This would be appropriate for a major version bump with substantial other improvements, but not for fixing this specific issue.

---

## Solution 3: Hybrid Approach - Static Metadata Component

### Overview

Create a separate, hidden component that holds metadata and is always statically injected into the layout. The Prism component reads from this metadata component rather than receiving data as props.

### Implementation Strategy

**New Component** (`dash_prism/PrismMetadata.py`):

```python
class PrismMetadata(Component):
    """Hidden component that stores Prism metadata."""

    def __init__(self, prism_id: str, **kwargs):
        """
        Args:
            prism_id: The ID of the associated Prism component
        """
        super().__init__(**kwargs)
        # ID is deterministic based on prism_id
        self.id = f'__prism_metadata_{prism_id}'
        self.registeredLayouts = []
        self.serverSessionId = None
```

**Modified Init** (`dash_prism/init.py`):

```python
def init(prism_id: str, app: "Dash") -> None:
    """Initialize Prism with static metadata component."""
    from .PrismMetadata import PrismMetadata

    # ... existing validation ...

    metadata = get_registered_layouts_metadata()
    session_id = SERVER_SESSION_ID

    # Create metadata component
    metadata_component = PrismMetadata(
        prism_id=prism_id,
        registeredLayouts=metadata,
        serverSessionId=session_id
    )

    # Inject into layout
    original_layout = app.layout

    if callable(original_layout):
        from functools import wraps

        @wraps(original_layout)
        def wrapped_layout(*args, **kwargs):
            layout_tree = original_layout(*args, **kwargs)

            # Find root container and inject metadata component as hidden sibling
            if hasattr(layout_tree, 'children'):
                if isinstance(layout_tree.children, list):
                    # Inject at beginning of children list
                    layout_tree.children = [metadata_component] + layout_tree.children
                else:
                    # Wrap single child
                    layout_tree.children = [metadata_component, layout_tree.children]
            else:
                # Wrap entire layout
                from dash import html
                return html.Div([metadata_component, layout_tree])

            return layout_tree

        app.layout = wrapped_layout
    else:
        # Static layout - inject once
        if hasattr(original_layout, 'children'):
            if isinstance(original_layout.children, list):
                original_layout.children.insert(0, metadata_component)
            else:
                original_layout.children = [metadata_component, original_layout.children]

    # ... callback registration ...
```

**Frontend** (`src/ts/components/Prism.tsx`):

```typescript
// Use effect to find and read from PrismMetadata component
useEffect(() => {
  // Query DOM for metadata component
  const metadataEl = document.getElementById(`__prism_metadata_${id}`);
  if (metadataEl && metadataEl.dataset.registeredLayouts) {
    const metadata = JSON.parse(metadataEl.dataset.registeredLayouts);
    // Use metadata
  }
}, [id]);
```

### Pros

- ✅ **Hybrid benefits**: Combines layout wrapping with component-based architecture
- ✅ **Explicit metadata storage**: Clear separation between Prism UI and metadata
- ✅ **Testable**: Metadata component can be tested independently
- ✅ **Extensible**: Could add more metadata types in the future

### Cons

- ⚠️ **Still requires layout mutation**: Injects metadata component into layout tree
- ⚠️ **Frontend changes required**: Must read from metadata component
- ⚠️ **DOM querying**: Relies on DOM queries, which is non-idiomatic for React
- ⚠️ **Additional component**: Adds hidden component to user's layout (could affect styling/selectors)
- ⚠️ **Complexity**: More moving parts than Solution 1

### Risk Assessment

**Risk Level**: **Medium**

- Requires coordinated Python + TypeScript changes
- Adds complexity without clear benefit over Solution 1
- DOM querying is fragile and non-React-like

### Recommendation

**Not Recommended**: This solution adds complexity without significant advantages over Solution 1. The hybrid nature makes it harder to maintain and reason about.

---

## Comparison Matrix

| Criterion | Solution 1 (Wrapping) | Solution 2 (Callback) | Solution 3 (Hybrid) |
|-----------|----------------------|----------------------|-------------------|
| **Complexity** | Low | High | Medium |
| **Breaking Changes** | None | Major | Minor |
| **Performance** | Minimal overhead | Additional callback latency | Minimal overhead |
| **Frontend Changes** | None | Major refactor | Moderate changes |
| **Maintainability** | High | Low | Medium |
| **Type Safety** | Preserved | Complex async types | Preserved |
| **Testing Effort** | Low | High | Medium |
| **User Experience** | Seamless | Potential flash/delay | Seamless |
| **Risk** | Low | High | Medium |

---

## Final Recommendation

**Implement Solution 1: Layout Function Wrapping**

### Rationale

1. **Minimal Impact**: Solves the problem with the smallest change surface
2. **No Breaking Changes**: Existing code continues to work
3. **Well-Understood Pattern**: Similar to how other Dash extensions operate
4. **Easy to Test**: Clear input/output behavior
5. **Easy to Revert**: If issues arise, can document as unsupported instead

### Implementation Checklist

- [ ] Refactor metadata injection into `_inject_metadata_into_layout()` helper
- [ ] Implement wrapper for sync callable layouts
- [ ] Implement wrapper for async callable layouts
- [ ] Handle layout functions with parameters (`*args, **kwargs`)
- [ ] Add guard against infinite wrapping (mark wrapper or check if already wrapped)
- [ ] Write unit tests for sync callable layout
- [ ] Write unit tests for async callable layout
- [ ] Write unit tests for layout with parameters
- [ ] Write integration test with full Dash app
- [ ] Test with Dash 2.x and 3.x
- [ ] Update documentation (getting-started.rst, user-guide.rst)
- [ ] Add example to `usage.py` demonstrating callable layout

### Documentation Updates

Add to `docs/user-guide.rst`:

```rst
Callable Layouts
----------------

Dash Prism supports both static and callable layouts. Callable layouts are useful
for creating user-specific workspaces or dynamic content.

**Example**::

    app = Dash(__name__)

    def layout():
        # Layout is generated fresh on each page load
        return html.Div([
            dash_prism.Prism(
                id='workspace',
                persistence=True,
                persistence_type='local'
            )
        ])

    app.layout = layout  # Assign function, not function call
    dash_prism.init('workspace', app)

.. note::
   Callable layouts are called on every page load. For best performance, avoid
   expensive computations in layout functions. Use callbacks for dynamic content
   instead.

Async Layout Functions
~~~~~~~~~~~~~~~~~~~~~~~

Dash Prism also supports async layout functions when using ``use_async=True``::

    app = Dash(__name__, use_async=True)

    async def layout():
        data = await fetch_user_data()
        return html.Div([
            dash_prism.Prism(id='workspace', initialLayout=data['default_layout'])
        ])

    app.layout = layout
    dash_prism.init('workspace', app)
```

### Next Steps

1. Create feature branch: `feature/callable-layout-support`
2. Implement Solution 1 following the checklist
3. Run full test suite (unit + integration)
4. Create PR with before/after examples
5. Merge to `dev` branch

---

## Appendix: Alternative Considered - No Solution

### Option: Document as Unsupported

We could explicitly document that callable layouts are not supported and require users to use static layouts only.

**Pros**:
- No code changes required
- Clear boundary of what's supported

**Cons**:
- Limits legitimate use cases (multi-user apps, conditional layouts)
- Other Dash components support callable layouts
- Poor user experience (confusing error when it doesn't work)

**Verdict**: Not recommended. The problem is solvable with minimal effort, and supporting callable layouts aligns with Dash's design philosophy.
