"""The old module of the component tree helpers and of the workspace validation.

The helpers moved to :mod:`dash_prism.layout_tree` and
:mod:`dash_prism.workspace`. This module gives the same names, so that an
import from ``dash_prism.utils`` continues to work through the 1.x releases.
New code imports the names from ``dash_prism``.
"""

from dash_prism.layout_tree import (
    find_component_by_id,
    inject_tab_id,
    update_component_props,
    walk_layout,
)
from dash_prism.workspace import InvalidWorkspace, InvalidWorkspaceError, validate_workspace

__all__ = [
    "InvalidWorkspace",
    "InvalidWorkspaceError",
    "find_component_by_id",
    "inject_tab_id",
    "update_component_props",
    "validate_workspace",
    "walk_layout",
]
