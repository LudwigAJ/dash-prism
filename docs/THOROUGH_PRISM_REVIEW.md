# Thorough Prism Review Plan

Date: 2026-01-18

## Purpose
Create a structured plan to address review feedback across architecture, code quality, UX, validation, and documentation, with a focus on low-risk, high-impact fixes first.

## Goals
- Improve robustness in layout resolution, persistence validation, and async handling.
- Align comments, docs, and runtime behavior.
- Reduce regression risk in the reducer and panel/tab operations.
- Address UX friction points and clarify user-facing states.
- Simplify core code paths to improve maintainability.

## Key Findings (Grouped)
### Architecture & Validation
- Global registry singleton can cause cross-test and reload coupling (dash_prism/registry.py).
- Async layout execution in sync mode can break if an event loop is running (dash_prism/init.py).
- Persisted workspace may drift from registered layouts after deploys; validation is partial (dash_prism/utils.py, src/ts/context/PrismContext.tsx).

### Python Runtime
- init() looks at app.layout directly; callable layouts can be skipped when searching for Prism (dash_prism/init.py).
- render_layout() assumes params/options structures are dicts and can raise before returning a friendly error (dash_prism/init.py).
- registry metadata accepts unvalidated param types; client expects strings (dash_prism/registry.py).
- validate_workspace() assumes dict shapes; falsy IDs may skip validation (dash_prism/utils.py).

### TypeScript Runtime
- validateState() comment says dev-only but it runs on every action (src/ts/context/prismReducer.ts).
- Undo stack assumptions can misplace tabs when state desyncs (src/ts/context/prismReducer.ts).
- Default tab IDs are generated at module load; multiple Prism instances may collide (src/ts/context/prismReducer.ts).
- Theme persistence is read but not written in autosave (src/ts/context/PrismContext.tsx).
- Max-tab gating in UI is panel-local, while reducer enforces global limit (src/ts/components/TabBar.tsx, src/ts/context/prismReducer.ts).
- StatusBar “Updated” time resets on re-render when prop omitted (src/ts/components/StatusBar.tsx).

### UX
- Layout chooser search affordance and card metadata are weak (src/ts/components/layouts/NewLayout.tsx).
- Single-instance layout selection only logs; needs user feedback (src/ts/components/layouts/NewLayout.tsx).
- Param/options flows hide navigation and can drop values on blur (src/ts/components/layouts/NewLayout.tsx).
- Add-tab button can be lost in scroll; discoverability is low (src/ts/components/TabBar.tsx).
- Loading tooltip says “Cancel” but closes the tab; misleading (src/ts/components/TabBar.tsx).
- Rename discoverability is low (src/ts/components/TabBar.tsx).
- Status bar exposes raw IDs; lacks friendly labels and aligned shortcuts (src/ts/components/StatusBar.tsx).
- Error recovery could be more prominent (src/ts/components/layouts/NewLayout.tsx).
- Icons grid lacks search in large sets (src/ts/components/PrismIconPicker.tsx).

### Simplification Opportunities
- Large reducer switch can be broken into domain handlers and shared helpers (src/ts/context/prismReducer.ts).
- Centralize tab creation/cloning and active-tab cleanup helpers (src/ts/context/prismReducer.ts).
- Consolidate workspace parsing and normalization (src/ts/context/PrismContext.tsx).
- Factor shared layout render/param parsing for sync/async (dash_prism/init.py).
- Consider a metadata factory for registry actions (dash_prism/registry.py).

## Implementation Plan

### Phase 0 — Agreement & Baselines (short)
- Confirm priorities and acceptance criteria.
- Identify target version for changes.
- Add a lightweight checklist for regression coverage.

### Phase 1 — Safety & Correctness (highest priority)
1. **Python safety guards**
   - Validate tab params/options types before access.
   - Harden validate_workspace() against non-dict inputs and falsy IDs.
   - Handle callable app.layout when searching for Prism.
   - Clarify async layout behavior in sync mode (docs + runtime errors).

2. **Client/server consistency**
   - Enforce or document string-only param values on the client; align registry validation.
   - Add a server-side validation for layout IDs/options in persisted workspaces where feasible.

3. **Reducer invariants**
   - Align validateState() behavior with comment (dev-only or update comment).
   - Guard undo restore placement if stack desyncs.
   - Generate default tab IDs per instance to avoid collisions.

### Phase 2 — Persistence & UX Reliability
1. **Persistence fixes**
   - Persist theme changes consistently (read/write).
   - Align max-tab gating between UI and reducer (global count).

2. **UX friction improvements**
   - Add clear search affordance in layout chooser.
   - Improve card metadata (params/options/allow_multiple status).
   - Provide user feedback on single-instance selection.
   - Improve param/options navigation and persistence of values.
   - Make add-tab button sticky or more discoverable.
   - Clarify “Cancel” tooltip behavior and status bar labels.
   - Add error recovery affordances (primary actions and copy-details).
   - Add icon search/filter.

### Phase 3 — Simplification & Maintainability
- Refactor reducer into domain handlers and shared helpers.
- Centralize tab creation/cloning logic.
- Extract workspace normalization/storage parsing into dedicated module/hook.
- Consolidate sync/async layout render parsing in Python.
- Add/expand tests around panel move/split/collapse and render failures.

### Phase 4 — Docs & Examples
- Align docs version to package metadata (if still mismatched).
- Add a “Workspace UI” section: tabs, search modes, status bar actions, context menu.
- Add notes on async layout behavior and persistence caveats.

## Testing Strategy
- Expand unit tests for reducer edge cases (tab moves, undo, panel split/collapse).
- Add integration tests for:
  - Async layout execution in sync mode (expected errors/behavior).
  - Invalid params/options in persisted state.
  - Max-tab gating behavior in UI vs reducer.
- Validate persistence across reloads with updated storage format.

## Acceptance Criteria
- No uncaught exceptions from invalid params/options or workspace shape.
- Async layouts either execute safely or fail with clear, actionable messaging.
- State persistence is consistent for theme, active panel, and tabs.
- UI feedback is clear for single-instance selection, max-tabs, and errors.
- Reducer invariants are documented and enforced in development.

## Out of Scope (for this plan)
- Large-scale redesign of panel layout logic.
- New features unrelated to the reported issues.
- Breaking API changes without a migration path.

## Next Step
Review this plan, select Phase 1 items to implement first, and confirm scope for Phase 2 UX changes.