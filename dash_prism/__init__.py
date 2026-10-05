"""Dash Prism: a tabbed workspace component with resizable, splittable panels for Plotly Dash.

One Prism component holds many layouts on one page. A user opens a layout in a
tab, moves the tab to another panel, and splits the workspace into more panels
with drag-and-drop. Prism renders the content of a tab only when the user opens
that tab, through one Dash callback that :func:`dash_prism.init` registers.

Quick start::

    import dash_prism
    from dash import Dash, html

    app = Dash(__name__, suppress_callback_exceptions=True)

    @dash_prism.register_layout(id='home', name='Home')
    def home_layout():
        return html.Div('Welcome!')

    dash_prism.register_layout(id='about', name='About', layout=html.Div('About page'))

    app.layout = html.Div([dash_prism.Prism(id='prism')])
    dash_prism.init('prism', app)

    if __name__ == '__main__':
        app.run(debug=True)

The user guide and the API reference at https://ludwigaj.github.io/dash-prism/
describe the layout parameters, the async layouts, the persistence of the
workspace and each public name in ``__all__``.
"""

import json
import pathlib
from importlib import metadata

import dash

# A file with the name "dash.py" in the working directory is the usual cause of
# a bad Dash import. The check runs before the component imports, which fail
# with a less clear message.
if not hasattr(dash, "__plotly_dash") and not hasattr(dash, "development"):
    raise ImportError(
        "Dash was not successfully imported. "
        "Make sure you don't have a file named 'dash.py' in your current directory."
    )

# The ``dash-generate-components`` tool writes these three component classes.
# The package imports them with a private alias, because the documented wrapper
# classes below are the public API.
from .PrismActionComponent import PrismActionComponent as _GeneratedPrismActionComponent
from .PrismComponent import PrismComponent as _GeneratedPrismComponent
from .PrismContentComponent import PrismContentComponent as _GeneratedPrismContentComponent

# isort: split

# Each wrapper class is a subclass of the related generated class above, and
# adds documentation and type annotations.
from .Action import Action, PrismAction
from .app_init import InitializationError, init
from .icons import AVAILABLE_ICONS, get_available_icons
from .layout_registry import (
    LayoutRegistration,
    LayoutRegistry,
    clear_registry,
    get_layout,
    get_registered_layouts_metadata,
    register_layout,
    registry,
)
from .layout_tree import find_component_by_id, inject_tab_id, update_component_props, walk_layout
from .params import FieldError, LayoutParameter, Param, ParamValidationError
from .Prism import Prism
from .PrismContent import PrismContent
from .workspace import InvalidWorkspace, InvalidWorkspaceError, validate_workspace

_PACKAGE_NAME = "dash_prism"

try:
    __version__ = metadata.version(_PACKAGE_NAME)
except metadata.PackageNotFoundError:
    # An editable install or a source tree can have no distribution metadata.
    # In that condition, read the version from package-info.json, which the
    # component build copies from package.json into this package.
    __version__ = json.loads(
        (pathlib.Path(__file__).parent / "package-info.json").read_text(encoding="utf-8")
    )["version"]

# Dash serves these files on each page that holds a Prism component. The source
# map is dynamic, thus Dash serves it only when the browser asks for it.
_js_dist = [
    {
        "relative_package_path": "dash_prism.js",
        "namespace": _PACKAGE_NAME,
    },
    {
        "relative_package_path": "dash_prism.js.map",
        "namespace": _PACKAGE_NAME,
        "dynamic": True,
    },
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
