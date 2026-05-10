"""
Dash Prism
==========

A powerful tabbed workspace component for building dynamic, lazy-loaded, multi-panel
Dash applications with drag-and-drop functionality.

Features
--------

- **Dynamic tab management**: Create, close, rename, and reorder tabs
- **Multi-panel layouts**: Split workspace into multiple panels with drag-and-drop
- **Persistent state**: Save workspace configuration across sessions
- **Layout registry**: Register static or dynamic layouts with parameters
- **Async support**: Full support for async layout callbacks
- **Type-safe**: Complete type hints for Python 3.10+

Quick Start
-----------

Basic usage with static layouts::

    import dash_prism
    from dash import Dash, html

    app = Dash(__name__)

    # Register layouts (decorator style)
    @dash_prism.register_layout(id='home', name='Home')
    def home_layout():
        return html.Div('Welcome!')

    # Or register static layouts
    dash_prism.register_layout(
        id='about',
        name='About',
        layout=html.Div('About page'),
    )

    # Create app layout with Prism
    app.layout = html.Div([
        dash_prism.Prism(id='prism', theme='light', maxTabs=10)
    ])

    # Initialize (injects layouts & creates render callback)
    dash_prism.init('prism', app)

    if __name__ == '__main__':
        app.run_server(debug=True)

Advanced Usage
--------------

Parameterized layouts with options::

    @dash_prism.register_layout(
        id='chart',
        name='Chart View',
        param_options={
            'bar': ('Bar Chart', {'chart_type': 'bar'}),
            'line': ('Line Chart', {'chart_type': 'line'}),
        }
    )
    def chart_layout(chart_type: str = 'bar'):
        return dcc.Graph(figure=create_figure(chart_type))

Async layouts::

    @dash_prism.register_layout(id='data', name='Data View')
    async def data_layout():
        data = await fetch_data()
        return html.Div(data)

API Reference
-------------

Core Components
~~~~~~~~~~~~~~~

- :class:`dash_prism.Prism`: Main workspace component
- :class:`dash_prism.Action`: Action buttons for status bar (alias: ``PrismAction``)
- :class:`dash_prism.PrismContent`: Content wrapper for layouts

Registration API
~~~~~~~~~~~~~~~~

- :func:`dash_prism.register_layout`: Register a layout (decorator or direct)
- :func:`dash_prism.get_layout`: Retrieve registered layout by ID
- :func:`dash_prism.get_registered_layouts_metadata`: Get all layout metadata
- :func:`dash_prism.clear_registry`: Clear all registered layouts
- :data:`dash_prism.registry`: Global layout registry instance

Initialization
~~~~~~~~~~~~~~

- :func:`dash_prism.init`: Initialize Prism with Dash app
- :exc:`dash_prism.InitializationError`: Raised when initialization fails

Utilities
~~~~~~~~~

- :func:`dash_prism.walk_layout`: Traverse component tree
- :func:`dash_prism.inject_tab_id`: Add tab IDs for isolation
- :func:`dash_prism.render_layout_for_tab`: Render layout for specific tab
- :func:`dash_prism.find_component_by_id`: Find component in tree
- :func:`dash_prism.update_component_props`: Update component properties
- :func:`dash_prism.validate_workspace`: Validate workspace structure
- :exc:`dash_prism.InvalidWorkspace`: Raised on invalid workspace

Classes
~~~~~~~

- :class:`dash_prism.LayoutRegistration`: Represents a registered layout
- :class:`dash_prism.LayoutParameter`: Describes a layout parameter
- :class:`dash_prism.LayoutRegistry`: Registry for managing layouts

Notes
-----

The public component classes wrap Dash-generated component classes so the
Python API can keep stable documentation and type annotations.
"""

from __future__ import print_function as _

import json as _json
import os as _os
import sys as _sys
import uuid as _uuid

import dash as _dash

# Auto-generated component imports (from dash-generate-components).
# These are kept private here so the public package API points users at the
# documented wrappers below. The generated files remain importable from their
# modules for Dash internals and debugging, but are not top-level exports.
from .PrismActionComponent import PrismActionComponent as _GeneratedPrismActionComponent
from .PrismComponent import PrismComponent as _GeneratedPrismComponent
from .PrismContentComponent import PrismContentComponent as _GeneratedPrismContentComponent

# User-facing wrapper classes (override auto-generated with our documented versions)
from .Action import Action, PrismAction
from .Prism import Prism
from .PrismContent import PrismContent

if not hasattr(_dash, "__plotly_dash") and not hasattr(_dash, "development"):
    print(
        "Dash was not successfully imported. "
        "Make sure you don't have a file "
        'named \n"dash.py" in your current directory.',
        file=_sys.stderr,
    )
    _sys.exit(1)

# Package metadata - use importlib.metadata for robust version detection

from importlib.metadata import PackageNotFoundError

try:
    from importlib.metadata import version as _get_version

    __version__ = _get_version("dash_prism")
except PackageNotFoundError:
    # Fallback for editable installs or when metadata is unavailable
    _basepath = _os.path.dirname(__file__)
    _filepath = _os.path.abspath(_os.path.join(_basepath, "package-info.json"))
    with open(_filepath) as _f:
        _package_info = _json.load(_f)
    __version__ = _package_info["version"]

package_name = "dash_prism"

# Stable per-process session identifier (used for persistence invalidation)
SERVER_SESSION_ID = str(_uuid.uuid4())

_js_dist = [
    {
        "relative_package_path": "dash_prism.js",
        "namespace": package_name,
    },
    {
        "relative_package_path": "dash_prism.js.map",
        "namespace": package_name,
        "dynamic": True,
    },
    # {
    #     'dev_package_path': 'proptypes.js',
    #     'dev_only': True,
    #     'namespace': package_name,
    # },
]

_css_dist: list[dict[str, str]] = []


for _component in (
    _GeneratedPrismActionComponent,
    _GeneratedPrismComponent,
    _GeneratedPrismContentComponent,
    Action,
    Prism,
    PrismContent,
):
    setattr(_component, "_js_dist", _js_dist)
    setattr(_component, "_css_dist", _css_dist)


# =============================================================================
# PUBLIC API
# =============================================================================

# Layout Registration
from .registry import (
    # Main API
    register_layout,
    registry,
    get_layout,
    get_registered_layouts_metadata,
    clear_registry,
    # Classes
    LayoutRegistration,
    LayoutParameter,
    LayoutRegistry,
)

# Utilities
from .utils import (
    walk_layout,
    inject_tab_id,
    render_layout_for_tab,
    find_component_by_id,
    update_component_props,
    validate_workspace,
    InvalidWorkspace,
)

# Initialization
from .init import init, InitializationError

# Icons
from .icons import AVAILABLE_ICONS, get_available_icons

# Export all public symbols
__all__ = [
    # Components (from _imports_)
    "Action",
    "Prism",
    "PrismAction",  # Backwards compatibility alias
    "PrismContent",
    # Registration API
    "register_layout",
    "registry",
    "get_layout",
    "get_registered_layouts_metadata",
    "clear_registry",
    # Classes
    "LayoutRegistration",
    "LayoutParameter",
    "LayoutRegistry",
    # Utilities
    "walk_layout",
    "inject_tab_id",
    "render_layout_for_tab",
    "find_component_by_id",
    "update_component_props",
    "validate_workspace",
    "InvalidWorkspace",
    # Initialization
    "init",
    "InitializationError",
    "SERVER_SESSION_ID",
    # Icons
    "AVAILABLE_ICONS",
    "get_available_icons",
]
