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
- **The Tailwind utility classes of Prism have the prefix `tw:`.** A Dash layout
  in a tab is inside the Prism root element, so its class names met the utility
  classes of Prism (`flex`, `hidden`, `border`, `collapse`, `container` and
  others). Each utility class now has the form `tw:flex`, and no class name in a
  layout meets a Prism rule. A host that styled the inside of Prism with the old
  Tailwind class names must use the new names. These names were never public
  API. The class `scrollbar-none` is now `prism-scrollbar-none`.
- **Prism no longer builds or sends a JSON Schema for a layout.** The
  `LayoutRegistration.schema` attribute and the `schema` key of
  `get_registered_layouts_metadata()` are removed, so the `registeredLayouts`
  prop has no `schema` key either. The `json_schema()` method of the layout
  validator is removed too. The browser never read the schema. The search bar
  checks input with the `params` list of the layout, and the server checks it
  with pydantic. The metadata of a layout is now smaller, most of all for a
  layout that takes a pydantic model. Code that read the schema must build it
  from its own pydantic model.

### Changed

- Context menus, dialogs, popovers and tooltips render inside the Prism root
  element and use the theme of their own instance. A host ancestor of the Prism
  component that has a `transform`, `filter` or `contain` property, or its own
  stacking context, can now confine or cover them.
- Inactive tabs keep their real size, so a Plotly graph in a background tab lays
  out correctly when the tab becomes active. Before, Prism hid inactive tabs
  with `display: none`.
- The test ids of the error boundary actions have the prefix `prism-`:
  `prism-error-action-retry`, `prism-error-action-refresh` and
  `prism-error-action-clear-storage`. A host test that used the old
  `error-action-*` ids must use the new ones.
- Prism logs a failed tab render once, and no log line holds a parameter value.
  A timeout, a `TypeError`, a `ValueError` and invalid parameters log a warning.
  Any other exception logs an error. The log names the class of the exception,
  and for the error also the stack frames, but never the message of the
  exception, because a message can hold a value that the user typed. The tab
  still shows the message. Each tab render writes one `DEBUG` line with the tab
  ID and the layout ID. Before, every render wrote the full request, with every
  parameter value, at `INFO`. The logger name is now `dash_prism.app_init`, so a
  handler on `dash_prism` still receives the records.
- The module `dash_prism.init` is now `dash_prism.app_init`. The function
  `dash_prism.init` and the other public names are the same. Code that wrote
  `from dash_prism.init import ...` must import the public names from
  `dash_prism`.
- The `data` prop of `PrismContent` no longer has the key `tabId`. The render
  callback always read the tab ID from the `index` of the component `id`, so the
  key was never used.
- Prism no longer listens for the window events `prism:select-layout` and
  `prism:focus-searchbar`. The empty-tab screen and the keyboard shortcut now
  send these requests to the search bar through the store of the Prism
  instance. A clientside callback that dispatched one of these events does
  nothing now.
- A share link that meets the tab limit now shows the message of the tab limit
  (`Maximum tabs limit reached (N)`). Before, it showed `Max tabs (N) reached`.
  A share link or a search bar selection for an open layout that does not allow
  several tabs now shows the same text in both places:
  `Layout "X" is already open. Switching to it.`
- Prism also writes each toast to the browser console, at the level that matches
  the toast. A toast about bad user input, such as an invalid share link, is a
  warning. A production build writes only warnings and errors. Before, only the
  toasts of the store were logged.
- Reset workspace clears the storage of the active `persistence_type` only. A
  stale entry left in the other storage after a `persistence_type` switch is
  never read and stays until cleared by hand.

### Fixed

- `dash_prism.init()` no longer warns that it cannot find the Prism component
  when `app.layout` is an async function. `init` cannot call an async function,
  so it does not check that layout. Before, every app with an async layout
  function got the warning.
- With two Prism components on one page, a toast now shows only in the component
  that raised it. Before, every component showed every toast. Each component has
  its own toaster, and its `id` is the `id` of the component.
- The search bar accepts `none` and `null` for an optional parameter, and a JSON
  array such as `[1, 2]` for a list parameter. The server already accepted both,
  but the search bar showed an error for them. A shared table of inputs now
  fails a test if the search bar and the server disagree.
- A second `dash_prism.init()` with another `prism_id` now gives that Prism
  component its layout metadata, and the app keeps one render callback. Before,
  the second call registered a second callback for the same output, which Dash
  reports as a duplicate callback output in debug mode. A second call with the
  same `prism_id` and the same layout does nothing. A call after `app.layout` is
  set again fills the new layout.
- Keyboard and screen reader users can operate more of the controls of Prism.
  The status bar tab segment, the actions of the error boundary, the search bar
  display bar and the layout cards are real buttons, so Tab reaches them and
  both Enter and Space activate them. Before, the segment did not react to the
  keyboard and the display bar did not react to Enter. The icon-only buttons
  (new tab, split, reset, help and undo), the tab rename input, the search
  input and the parameter input have an accessible name, and the favourite star
  of a layout names the layout. A layout card no longer nests its favourite
  button in another button, and the focus stays on the star when the card moves
  to the other section. The close control of a tab is still inside the tab
  button.
- A click on a button of Prism no longer submits an `html.Form` or `dbc.Form`
  that wraps the component. Every button has `type="button"`.
- The choice list of an enum parameter in the search bar is a combobox. The
  arrow keys and the mouse mark a choice, Enter selects it, the first Escape
  clears the mark, and the input announces the marked option to a screen
  reader.
- The status bar dividers are no longer a `|` character that a screen reader
  reads aloud. The titles of cards and the sections of the help dialog are
  headings in the right order.
- The tab rename input keeps its natural height instead of stretching to the
  bottom of the tab.
- An open Bootstrap collapse (`dbc.Collapse`) in a tab is visible. The Prism
  utility class `collapse` made it invisible. Other class names of CSS
  frameworks such as Bootstrap (`container`, `border`, `rounded` and
  more) no longer get Prism styles in a tab too.

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
