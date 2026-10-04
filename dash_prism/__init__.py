"""
Dash Prism
==========

Dash Prism is a tabbed workspace component for Plotly Dash. One Prism component
holds many layouts on one page. A user can open a layout in a new tab, move the
tab to another panel, and split the workspace into more panels with
drag-and-drop. Prism renders the content of a tab only when the user opens that
tab. Thus an application with many layouts loads only the layouts that the user
opens.

Features
--------

- **Tabs**: A user can make, close, rename, and reorder tabs.
- **Multi-panel layouts**: A user can split the workspace into more panels and
  move tabs between the panels with drag-and-drop.
- **Persistent workspace**: The browser can store the workspace and restore it
  on the next page load. The workspace persists only when ``persistence=True``
  and ``persistence_type`` is ``'local'`` or ``'session'``. The default
  ``persistence_type`` is ``'memory'``, which stores nothing.
- **Layout registry**: You register each layout one time, with an ID, a name,
  and optional keywords. A layout is a static component tree, or a function
  that returns a component tree.
- **Layout parameters**: A layout function can accept parameters. Prism shows
  the parameters in its search bar, and pydantic validates the values before
  the layout function runs.
- **Async layouts**: A layout function can be an ``async def`` function. See
  :func:`dash_prism.init` for the two callback modes.
- **Type hints**: The package has type annotations for Python 3.11 and later,
  and it includes a ``py.typed`` marker.

Quick Start
-----------

This example registers two layouts, puts a Prism component in the layout of the
application, and connects the two with :func:`dash_prism.init`::

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
        app.run(debug=True)

Advanced Usage
--------------

A layout function can accept parameters. The ``param_options`` argument gives a
label and a set of parameter values to each named option. Prism shows these
options to the user, thus the user does not type the parameter values::

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

A layout function can also be an ``async def`` function. Prism waits for the
result of the function, then it renders the content of the tab::

    @dash_prism.register_layout(id='data', name='Data View')
    async def data_layout():
        data = await fetch_data()
        return html.Div(data)

API Reference
-------------

Core Components
~~~~~~~~~~~~~~~

- :class:`dash_prism.Prism`: The workspace component. An application puts one
  instance of it in the layout.
- :class:`dash_prism.Action`: A button in the status bar of the workspace.
  ``PrismAction`` is an alias of this class, kept for backward compatibility.
- :class:`dash_prism.PrismContent`: The host component for the content of one
  tab. Prism and :func:`dash_prism.init` make these components. An application
  does not usually make one.

Registration API
~~~~~~~~~~~~~~~~

- :func:`dash_prism.register_layout`: Registers one layout. You call it with a
  ``layout=`` component tree, or you use it as a decorator on a layout
  function.
- :func:`dash_prism.get_layout`: Returns the
  :class:`dash_prism.LayoutRegistration` for one layout ID, or ``None`` if no
  layout has that ID.
- :func:`dash_prism.get_registered_layouts_metadata`: Returns the metadata of
  every registered layout, in a dictionary that the layout ID keys. The
  metadata holds no components and no callbacks, because Prism sends it to the
  browser.
- :func:`dash_prism.clear_registry`: Removes every registered layout. Tests use
  this function to reset the registry between test cases.
- :data:`dash_prism.registry`: The process-wide
  :class:`dash_prism.LayoutRegistry` instance that holds the registrations.

Parameter Validation
~~~~~~~~~~~~~~~~~~~~

- :class:`dash_prism.Param`: The metadata for one layout parameter. You put it
  in a :data:`typing.Annotated` annotation, to add a description, a label, a
  limit, or a list of permitted values.
- :exc:`dash_prism.ParamValidationError`: The error that the validator raises
  when the parameters of a layout are not valid. The class is a subclass of
  :class:`ValueError`.
- :class:`dash_prism.FieldError`: One parameter that is not valid, inside a
  :exc:`dash_prism.ParamValidationError`.

Initialization
~~~~~~~~~~~~~~

- :func:`dash_prism.init`: Connects Prism to the Dash application. The function
  injects the layout metadata into the Prism component, and registers the
  callback that renders the content of a tab.
- :exc:`dash_prism.InitializationError`: The error that :func:`dash_prism.init`
  raises when the setup is not valid. An example is a layout of the application
  that holds no Prism component with the given ID.

Utilities
~~~~~~~~~

- :func:`dash_prism.walk_layout`: Applies a transform function to each
  component in a Dash component tree. The function changes the tree in place
  and returns it.
- :func:`dash_prism.inject_tab_id`: Changes each string component ID into a
  pattern-matching ID that holds the tab ID. Two tabs with the same layout thus
  keep independent callbacks.
- :func:`dash_prism.find_component_by_id`: Returns the component that has the
  given ID, or ``None`` if the tree holds no such component.
- :func:`dash_prism.update_component_props`: Returns a deep copy of the tree,
  in which the component with the given ID has the new property values.
- :func:`dash_prism.validate_workspace`: Validates a workspace dictionary. The
  function makes sure that the tabs, the panels, and the active IDs agree.
- :exc:`dash_prism.InvalidWorkspaceError`: The error that
  :func:`dash_prism.validate_workspace` raises for a workspace that is not
  valid. Its ``errors`` attribute lists each problem. ``InvalidWorkspace`` is
  an alias of this class, kept through the 1.x releases.

Icons
~~~~~

- :data:`dash_prism.AVAILABLE_ICONS`: The names of the icons that a tab can
  use. You can test one name with the ``in`` operator.
- :func:`dash_prism.get_available_icons`: Returns the same icon names, as a
  sorted list.

Classes
~~~~~~~

- :class:`dash_prism.LayoutRegistration`: One registered layout, with its
  metadata, its parameters, and its validator.
- :class:`dash_prism.LayoutParameter`: One parameter of a layout function, in
  the form that the search bar of Prism reads.
- :class:`dash_prism.LayoutRegistry`: The class of the registry that holds the
  registrations.

Notes
-----

The public component classes are subclasses of the component classes that the
``dash-generate-components`` tool writes. The subclasses give stable
documentation, keyword arguments, and type annotations. The generated classes
stay in their own modules, but this package does not export them at the top
level.

The package reads ``__version__`` from the metadata of the installed
distribution. If that metadata is absent, for example in an editable install,
the package reads the version from ``package-info.json`` instead.
"""

from __future__ import print_function as _

import json as _json
import os as _os
import sys as _sys

import dash as _dash

# The ``dash-generate-components`` tool writes these three component classes.
# The package imports them with a private alias, because the documented wrapper
# classes below are the public API. Dash internals and troubleshooting code can
# still import the generated classes from their own modules, but this package
# does not export them at the top level.
from .PrismActionComponent import PrismActionComponent as _GeneratedPrismActionComponent
from .PrismComponent import PrismComponent as _GeneratedPrismComponent
from .PrismContentComponent import PrismContentComponent as _GeneratedPrismContentComponent

# isort: split

# These wrapper classes are the public API. Each one is a subclass of the
# related generated class above, and adds documentation and type annotations.
from .Action import Action, PrismAction
from .Prism import Prism
from .PrismContent import PrismContent

# Dash must import correctly before the components can attach their assets to
# it. A file with the name "dash.py" in the working directory is the usual
# cause of a bad import, thus the message names that file.
if not hasattr(_dash, "__plotly_dash") and not hasattr(_dash, "development"):
    print(
        "Dash was not successfully imported. "
        "Make sure you don't have a file "
        'named \n"dash.py" in your current directory.',
        file=_sys.stderr,
    )
    _sys.exit(1)

# The version comes from the metadata of the installed distribution.

from importlib.metadata import PackageNotFoundError

try:
    from importlib.metadata import version as _get_version

    __version__ = _get_version("dash_prism")
except PackageNotFoundError:
    # An editable install or a source tree can have no distribution metadata.
    # In that condition, read the version from package-info.json, which the
    # component build copies from package.json into this package.
    _basepath = _os.path.dirname(__file__)
    _filepath = _os.path.abspath(_os.path.join(_basepath, "package-info.json"))
    with open(_filepath) as _f:
        _package_info = _json.load(_f)
    __version__ = _package_info["version"]

package_name = "dash_prism"

# Dash serves these files on each page that holds a Prism component. The source
# map is dynamic, thus Dash serves it only when the browser asks for it.
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

# The JavaScript bundle holds the styles and adds them to the page, thus the
# package has no separate CSS file for Dash to serve.
_css_dist: list[dict[str, str]] = []


# Dash reads ``_js_dist`` and ``_css_dist`` from the class of each component in
# the layout. The wrapper classes and the generated classes thus each need the
# two lists.
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

# Initialization
from .app_init import InitializationError, init

# Icons
from .icons import AVAILABLE_ICONS, get_available_icons

# Component tree helpers
from .layout_tree import find_component_by_id, inject_tab_id, update_component_props, walk_layout

# Parameter validation
from .params import (
    FieldError,
    LayoutParameter,
    Param,
    ParamValidationError,
)

# Layout Registration
from .registry import (
    LayoutRegistration,
    LayoutRegistry,
    clear_registry,
    get_layout,
    get_registered_layouts_metadata,
    register_layout,
    registry,
)

# Workspace validation
from .workspace import InvalidWorkspace, InvalidWorkspaceError, validate_workspace

# The names that ``from dash_prism import *`` gives, and the documented public
# API of the package.
__all__ = [
    # Components (the documented wrappers, not the generated classes)
    "Action",
    "Prism",
    "PrismAction",  # Alias of Action, kept for backward compatibility
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
    "find_component_by_id",
    "update_component_props",
    "validate_workspace",
    "InvalidWorkspaceError",
    "InvalidWorkspace",  # Alias of InvalidWorkspaceError, kept through the 1.x releases
    # Parameter validation
    "Param",
    "FieldError",
    "ParamValidationError",
    # Initialization
    "init",
    "InitializationError",
    # Icons
    "AVAILABLE_ICONS",
    "get_available_icons",
]
