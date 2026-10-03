# Changelog

All notable changes to Dash Prism are recorded here. The project follows
[Semantic Versioning](https://semver.org/) from 1.0.0 on.

## Unreleased

### Breaking changes

- **Python 3.10 is no longer supported.** It reaches end of life in October
  2026. The minimum is now Python 3.11.
- **Prism no longer styles the host page outside its root element.** The
  stylesheet imports the Tailwind theme layer only and no longer ships the
  preflight reset to the whole document. The reset, the theme tokens, the
  utility classes and the print rules apply inside the Prism root element. A host
  page keeps its own headings, lists, buttons, fonts and body background, and
  two instances on one page can have different themes. A host that relied on the
  old reset must style those elements itself. A `dark` class on a host element
  no longer switches Prism to the dark theme. Set the `theme` prop.
- **Prism no longer sets `data-prism-theme` on `<html>` or defines the theme
  tokens on `:root`.** The tokens are custom properties of the Prism root
  element, and the dark theme adds the `dark` class to that element.
- **The `prism-container` class is removed.** The root element has the class
  `prism-root`. Replace `prism-container` with `prism-root` in host CSS that
  used the old name. Nine other `prism-*` class names that no rule used are
  removed too (`prism-content-loading`, `prism-content-loaded`,
  `prism-content-container`, `prism-panel-active`,
  `prism-panel-drop-zone-left`, `-right`, `-top`, `-bottom` and
  `prism-command`).

### Changed

- Context menus, dialogs, popovers and tooltips render inside the Prism root
  element and use the theme of their own instance. A host ancestor of the Prism
  component that has a `transform`, `filter` or `contain` property, or its own
  stacking context, can now confine or cover them.
- Inactive tabs keep their real size, so a Plotly graph in a background tab lays
  out correctly when the tab becomes active. Before, Prism hid inactive tabs
  with `display: none`.

### Fixed

- The tab rename input keeps its natural height instead of stretching to the
  bottom of the tab.

## 1.0.0

First stable release. Supports Python 3.10+ and Dash 3.1.1 – 4.4.x.

### Breaking changes

- **pydantic v2 is now a dependency.** It backs layout parameter validation.
  Dash 4.3 and later already depend on it, so only apps pinned to an older
  Dash gain a new transitive dependency.
- **`persistence=False` now really disables storage.** Previously only
  `persistence_type` decided; `persistence` was ignored. `persistence=True`
  with the default `persistence_type='memory'` persists nothing and emits a
  `UserWarning`; set `persistence_type='local'` or `'session'` as well.
- **New-tab shortcut is `Ctrl/Cmd+Alt+N`** (Chrome never delivers `Ctrl+N` to
  the page). The help dialog and docs list the new chord.
- **Shortcuts act on one workspace at a time.** With several Prism components
  on a page, a keystroke now reaches only the workspace the user last clicked
  in; previously every instance responded to every shortcut.
- **`dash_prism.SERVER_SESSION_ID` is removed.** `dash_prism.init()` now
  derives the `serverSessionId` prop from the registered layout IDs; it is the
  same on every worker and across restarts.
- **`dash_prism.render_layout_for_tab` is removed** (it duplicated the render
  path in `init()` but could not await an async layout, and it had neither the
  timeout nor the field-level parameter errors the real path applies).
  `dash_prism.__all__` is trimmed to the documented API; `docs/api.rst` lists
  exactly that set.
- **`setup.py` and `MANIFEST.in` are gone**; the package is built with
  `poetry-core >= 2.1` only. `pip install dash-prism` is unaffected.
- **Typed layout parameters are validated and coerced.** If your layout
  callback is annotated (`n: int`, `flag: bool`, `kind: Literal[...]`,
  `x: float | None`), it now receives real Python values instead of strings.
  Remove any manual `int(...)` / `== "true"` conversions (harmless if left in
  place for `int`/`float`; `bool("false")`-style bugs disappear). Unannotated
  parameters are passed through unchanged.
- **`param_options` presets are validated at registration.** A preset whose
  values do not match the callback's annotations raises `ValueError` at import
  time with the field and reason.
- **Persisted workspace format is version 2.** Existing 0.9.x workspaces are
  migrated on first load; nothing to do.

### Added

- New `Prism` props: `emptyTabView` (`'layouts'` | `'hint'` | `'none'`),
  `showStatusBar`, `statusBarItems`, `enableKeyboardShortcuts`,
  `enableShareLinks`, `maxPanels`.
- `layoutTimeout` is honoured end to end: the client timeout card and the
  server-side render timeout both use it (default 30 s, floats allowed).
- `serverSessionId` is implemented: tabs whose layout is no longer registered
  are closed on load (with a toast) instead of showing an error, and the
  fingerprint is stored with the persisted workspace.
- Parameter validation: `dash_prism.Param`, `dash_prism.ParamValidationError`,
  `dash_prism.FieldError`. Invalid parameters
  render an "Invalid parameters" panel listing each field; share links and
  `updateWorkspace` payloads with bad values are rejected the same way.
  `LayoutParameter.to_dict()` gained `type`, `required`, `nullable`, `choices`,
  `items`, `constraints`, `description`, `title`, `examples`, `placeholder`;
  layout metadata gained `schema`; nothing was removed or renamed.
- pydantic v2 is now a dependency, so `pydantic.Field` metadata, `BaseModel`
  parameters and JSON Schema export are always available. Dash >= 4.3 already
  depends on it.
- Search bar: leaving a parameter empty uses the callback's default;
  parameters with a fixed set of values show a pick list; invalid input is
  flagged inline before the tab is created.
- `maxTabs` can be changed from a callback at any time without losing the
  workspace or the undo history.
- `Typing :: Typed` classifier; `py.typed` ships in the wheel.

### Fixed

- Undo (`Ctrl+U`) right after a page load no longer wipes the restored
  workspace; the persist lifecycle is excluded from the undo history.
- Undo/redo results are written to storage immediately (a reload straight
  after an undo used to lose it).
- `updateWorkspace` keeps the tab order inside each panel.
- Tab IDs use `crypto.randomUUID` with a fallback for insecure contexts, and
  every Prism instance gets its own initial IDs.
- Search-bar state of a panel is cleared whenever that panel disappears
  (closing the last tab, moving it away), not only on an explicit collapse.
- Share-link URL handling is registered once per workspace instead of once per
  panel.
- `dash_prism.init()` accepted a timeout only on the async path; the sync path
  now uses it too.
- Keyboard shortcuts stand down while a context menu or dialog is open.
  Right-clicking a tab and pressing `Ctrl+D` used to close the tab behind the
  menu.
- ESLint runs again (`pnpm run lint`) and TypeScript is compiled with
  `strict`; the three `react-hooks/exhaustive-deps` violations it found are
  fixed, including a real bug: a fresh tab's auto-opened layout dropdown could
  not be dismissed by clicking outside it. CI runs lint and type checks.
- Docs: `app.run_server` -> `app.run`, `allow_multiple` semantics, component-ID
  rewriting inside tabs, `readWorkspace` -> `updateWorkspace` loop warning.

## 0.9.11 and earlier

See the [GitHub releases](https://github.com/LudwigAJ/dash-prism/releases).
