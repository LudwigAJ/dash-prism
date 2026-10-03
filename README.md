# Dash Prism

[![CI](https://github.com/LudwigAJ/dash-prism/actions/workflows/ci.yml/badge.svg)](https://github.com/LudwigAJ/dash-prism/actions/workflows/ci.yml)
[![CodeQL](https://github.com/LudwigAJ/dash-prism/actions/workflows/codeql.yml/badge.svg)](https://github.com/LudwigAJ/dash-prism/actions/workflows/codeql.yml)
[![PyPI](https://img.shields.io/pypi/v/dash-prism)](https://pypi.org/project/dash-prism/)
[![PyPI Downloads](https://static.pepy.tech/personalized-badge/dash-prism?period=total&units=ABBREVIATION&left_color=GRAY&right_color=BLUE&left_text=downloads)](https://pepy.tech/projects/dash-prism)
[![Python](https://img.shields.io/pypi/pyversions/dash-prism)](https://pypi.org/project/dash-prism/)
![License](https://img.shields.io/github/license/LudwigAJ/dash-prism.svg?style=flat)

A multi-panel workspace manager for Plotly Dash applications.

**Live Demo:** https://dash-prism-demo.vercel.app/    
**Docs:** https://ludwigaj.github.io/dash-prism/    
**PyPI:** https://pypi.org/project/dash-prism/      
 
## What is Dash Prism?

Dash Prism provides a unified workspace where multiple Dash layouts coexist as
tabs within resizable, splittable panels. Users arrange their workspace via
drag-and-drop while developers focus on building content.

![Demo](https://raw.githubusercontent.com/LudwigAJ/dash-prism/main/assets/prism-demo-0.gif)

## The Problem

Building dashboards with Plotly Dash typically means:

- **Fragmented applications** - Each dashboard lives in isolation, requiring
  users to switch between browser tabs or navigate complex menus.
- **Repetitive UI work** - Developers spend time on layout scaffolding, content
  management, and styling instead of business logic.
- **One-size-fits-all layouts** - Users get a fixed arrangement that may not
  match their workflow.
- **No personalization** - Workspaces reset on every visit; users cannot save
  their preferred view.

## The Solution

Dash Prism addresses these issues by providing:

- **Unified workspace** - Register any number of layouts; users open them as
  tabs in a single interface.
- **User-driven design** - Drag tabs to split panels, resize areas, and
  rearrange freely. Developers define content; users define structure.
- **Persistence** - Workspace state saves to localStorage, sessionStorage, or
  memory so users return to exactly where they left off.
- **Minimal boilerplate** - A decorator-based API keeps layout registration
  concise and readable.

## Features

- **User-Driven Layout** - Users style tabs with colors and icons, reorder them
  freely, and drag to panel edges to split the view. You create the content;
  they make the dashboard.
- **Favorites & Search** - Find layouts instantly with the integrated search
  bar. Mark frequently-used ones as favorites to pin them at the top.
- **On-Demand Loading** - Tab content loads dynamically when selected, keeping
  initial page load fast even with many registered layouts.
- **Parameterized Layouts** - Capture user options before loading a layout,
  minimizing server round-trips and delivering exactly what the user wants.
- **Custom Actions** - Add status bar buttons that trigger Dash callbacks for
  saving workspaces, exporting data, or any custom functionality.
- **Persistence & Workspace State** - State saves to localStorage, sessionStorage,
  or memory. Use `readWorkspace` and `updateWorkspace` for programmatic backup,
  restore, or team sharing.
- **Context Menus** - Right-click tabs to rename, duplicate, lock, style, or
  generate a shareable link to send a specific tab to someone else.
- **Keyboard Shortcuts** - Full keyboard navigation: new tab, close, rename,
  undo close, switch tabs, and more.
- **Error Resilience** - Errors are captured at the tab level, guarding against
  crashes that would otherwise take down the workspace.

## Light and Dark Mode

Dash Prism supports both light and dark themes, so the workspace adapts to your style.

![Dash Prism light mode](https://raw.githubusercontent.com/LudwigAJ/dash-prism/main/assets/prism-light-mode-demo-0.png)

![Dash Prism dark mode](https://raw.githubusercontent.com/LudwigAJ/dash-prism/main/assets/prism-dark-mode-demo-0.png)

## Installation

**Requirements:** Python 3.11+, Dash 3.1.1 – 4.4.x, pydantic 2.10+

```bash
pip install dash-prism
```

## Quick Start

```python
import dash
from dash import html
import dash_prism

app = dash.Dash(__name__)

@dash_prism.register_layout(id='home', name='Home')
def home():
    return html.Div('Welcome to Dash Prism')

@dash_prism.register_layout(id='analytics', name='Analytics')
def analytics():
    return html.Div('Analytics content here')

app.layout = html.Div([
    dash_prism.Prism(id='workspace', persistence=True, persistence_type='local')
])

dash_prism.init('workspace', app)

if __name__ == '__main__':
    app.run(debug=True)
```

## Configuration

Every behavioural knob is a keyword argument of `dash_prism.Prism`; all of them
can also be driven from Dash callbacks (`Output('workspace', '<prop>')`).

| Prop | Default | What it does |
|---|---|---|
| `theme` | `'light'` | `'light'` or `'dark'` colour scheme |
| `size` | `'md'` | Density preset: `'sm'`, `'md'`, `'lg'` |
| `maxTabs` | `16` | Tab limit for the whole workspace; `< 1` = unlimited. Can be changed at any time |
| `maxPanels` | `20` | Split limit; `1` disables splitting, `< 1` = unlimited |
| `persistence` / `persistence_type` | `False` / `'memory'` | Save the workspace to `'local'` or `'session'` storage (set both) |
| `initialLayout` | `None` | Layout to open in the first tab of a fresh workspace |
| `emptyTabView` | `'layouts'` | What an empty tab shows: `'layouts'` (cards), `'hint'` (shortcut hint) or `'none'` |
| `newTabOpensDropdown` | `True` | Open the layout search when a new tab is created |
| `showStatusBar` / `statusBarPosition` | `True` / `'bottom'` | Status bar visibility and side |
| `statusBarItems` | all | Ordered subset of `reset`, `help`, `undo`, `mode`, `panels`, `tab`, `count`, `updated` |
| `searchBarPlaceholder` | `'Search layouts...'` | Placeholder text of the layout search |
| `enableKeyboardShortcuts` | `True` | Keyboard shortcuts and their help section |
| `enableShareLinks` | `True` | `#p:` share links (context menu item and URL listener) |
| `layoutTimeout` | `30` | Seconds a layout may take to render before the tab shows a timeout card |
| `actions` | `[]` | `dash_prism.Action` buttons in the status bar that fire Dash callbacks |

`id`, `persistence` and `persistence_type` are read when the component mounts;
changing them remounts the workspace. Layout parameters can be typed and
validated with `typing.Annotated` + `dash_prism.Param`, or with a pydantic
model. See the
[user guide](https://ludwigaj.github.io/dash-prism/user-guide.html) for every
option and [CHANGELOG.md](https://github.com/LudwigAJ/dash-prism/blob/main/CHANGELOG.md)
for release notes.

## Development

This project uses [Poetry](https://python-poetry.org/) for dependency management and packaging.

### Setup

```bash
# Clone and enter the project
git clone https://github.com/LudwigAJ/dash-prism.git
cd dash-prism

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies (pnpm via Corepack or `brew install pnpm`)
poetry install --with dev,test,docs,demo
pnpm install

# Build
pnpm run build
```

### Using Just

If you have [just](https://github.com/casey/just) installed:

```bash
just install   # Install Python and pnpm dependencies
just build     # Build the package
just test      # Run tests
```

## Contributing

Contributions are welcome. Please:

1. Fork the repository.
2. Create a feature branch.
3. Write tests for new functionality.
4. Ensure all tests pass (`pytest`).
5. Submit a pull request.

See the [Contributing Guide](https://ludwigaj.github.io/dash-prism/contributing.html)
in the documentation for more details.

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
