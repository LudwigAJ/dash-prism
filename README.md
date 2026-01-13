# Dash Prism

[![CI](https://github.com/LudwigAJ/dash-prism/actions/workflows/ci.yml/badge.svg)](https://github.com/LudwigAJ/dash-prism/actions/workflows/ci.yml)
[![Docs](https://github.com/LudwigAJ/dash-prism/actions/workflows/docs.yml/badge.svg)](https://ludwigaj.github.io/dash-prism/)

A multi-panel workspace manager for Plotly Dash applications.

**Documentation:** https://ludwigaj.github.io/dash-prism/

## What is Dash Prism?

Dash Prism provides a unified workspace where multiple Dash layouts coexist as
tabs within resizable, splittable panels. Users arrange their workspace via
drag-and-drop while developers focus on building content.

## The Problem

Building dashboards with Plotly Dash typically means:

- **Fragmented applications** - Each dashboard lives in isolation, requiring
  users to switch between browser tabs or navigate complex menus.
- **Repetitive UI work** - Developers spend time on layout scaffolding, tab
  systems, and panel management instead of business logic.
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

## Installation

```bash
pip install dash-prism
```

## Quick Start

```python
import dash
from dash import html
import dash_prism

app = dash.Dash(__name__)

@dash_prism.register_layout(id='home', name='Home', icon='Home')
def home():
    return html.Div('Welcome to Dash Prism')

@dash_prism.register_layout(id='analytics', name='Analytics', icon='BarChart3')
def analytics():
    return html.Div('Analytics content here')

app.layout = html.Div([
    dash_prism.Prism(id='workspace', persistence=True)
])

dash_prism.init('workspace', app)

if __name__ == '__main__':
    app.run(debug=True)
```

## Development

### Setup

```bash
# Clone and enter the project
git clone https://github.com/LudwigAJ/dash-prism.git
cd dash-prism

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
npm install

# Build
npm run build
```

### Using Just

If you have [just](https://github.com/casey/just) installed:

```bash
just install   # Install Python and npm dependencies
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
