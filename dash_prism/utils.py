"""
Utility Functions for Prism
===========================

Provides helpers for layout manipulation, ID injection, component traversal,
and workspace validation.
"""

from __future__ import annotations

import copy
import logging
from typing import Any, Callable, Dict, List, Literal, Optional, Set

logger = logging.getLogger(__name__)


# =============================================================================
# EXCEPTIONS
# =============================================================================


class InvalidWorkspace(Exception):
    """Exception raised when workspace validation fails.

    :ivar errors: List of validation error messages describing what failed.
    :type errors: list[str]
    """

    def __init__(self, errors: List[str]) -> None:
        """Initialize the exception with validation errors.

        :param errors: List of validation error messages.
        :type errors: list[str]
        """
        self.errors = errors
        message = f"Invalid workspace: {'; '.join(errors)}"
        super().__init__(message)


# =============================================================================
# WORKSPACE VALIDATION
# =============================================================================


def _get_leaf_panel_ids(panel: Dict[str, Any], leaves: Optional[List[str]] = None) -> List[str]:
    """Recursively collect all leaf panel IDs from a panel tree.

    A leaf panel is one with no children or an empty children list.

    :param panel: Panel node to search.
    :type panel: dict[str, Any]
    :param leaves: Accumulator list for leaf IDs. Created if ``None``.
    :type leaves: list[str] | None
    :returns: List of leaf panel IDs found in the tree.
    :rtype: list[str]
    """
    if leaves is None:
        leaves = []

    if not isinstance(panel, dict):
        return leaves

    children = panel.get("children", [])
    if not children:
        # This is a leaf panel
        panel_id = panel.get("id")
        if isinstance(panel_id, str) and panel_id:
            leaves.append(panel_id)
    else:
        # Recurse into children
        for child in children:
            if isinstance(child, dict):
                _get_leaf_panel_ids(child, leaves)

    return leaves


def _validate_panel_structure(
    panel: Dict[str, Any],
    errors: List[str],
    path: str = "panel",
) -> None:
    """Recursively validate panel tree structure.

    Leaf panels require: ``id``.
    Container panels require: ``id``, ``direction``, ``children``.

    :param panel: Panel node to validate.
    :type panel: dict[str, Any]
    :param errors: Accumulator list for error messages (mutated in place).
    :type errors: list[str]
    :param path: Current path in the tree for error reporting.
    :type path: str
    """
    if not isinstance(panel, dict):
        errors.append(f"{path}: expected dict, got {type(panel).__name__}")
        return

    panel_id = panel.get("id")
    if not isinstance(panel_id, str) or not panel_id:
        errors.append(f"{path}: missing or invalid 'id' field")

    children = panel.get("children", [])

    if children:
        # Container panel - validate required fields
        direction = panel.get("direction")
        if direction not in ("horizontal", "vertical"):
            errors.append(
                f"{path} (id={panel_id}): container panel missing valid 'direction' "
                f"(got {direction!r}, expected 'horizontal' or 'vertical')"
            )

        if not isinstance(children, list):
            errors.append(f"{path} (id={panel_id}): 'children' must be a list")
        else:
            # Validate each child recursively
            for i, child in enumerate(children):
                _validate_panel_structure(child, errors, path=f"{path}.children[{i}]")


def validate_workspace(
    workspace: Dict[str, Any],
    errors: Literal["raise", "ignore"] = "raise",
) -> Dict[str, Any]:
    """Validate that a dictionary is a valid Prism Workspace.

    Checks cross-key consistency between ``tabs``, ``panel``, ``panelTabs``,
    ``activeTabIds``, and ``activePanelId`` to ensure the workspace state
    is coherent.

    :param workspace: Dictionary to be validated as a Prism workspace.
    :type workspace: dict[str, Any]
    :param errors: Error handling mode. ``'raise'`` raises :exc:`InvalidWorkspace`
        on failure, ``'ignore'`` logs errors and returns anyway. Defaults to ``'raise'``.
    :type errors: Literal['raise', 'ignore']
    :returns: The validated workspace dictionary (unchanged).
    :rtype: dict[str, Any]
    :raises InvalidWorkspace: If ``errors='raise'`` and validation failed.

    **Example**::

        workspace = {
            'tabs': [{'id': 'tab1', 'name': 'Tab 1', 'panelId': 'panel1', 'createdAt': 123}],
            'panel': {'id': 'panel1', 'order': 0, 'direction': 'horizontal', 'children': []},
            'panelTabs': {'panel1': ['tab1']},
            'activeTabIds': {'panel1': 'tab1'},
            'activePanelId': 'panel1',
        }
        validate_workspace(workspace)  # Returns workspace if valid
    """
    validation_errors: List[str] = []

    if not isinstance(workspace, dict):
        validation_errors.append(f"Workspace must be a dict, got {type(workspace).__name__}")
        if errors == "raise":
            raise InvalidWorkspace(validation_errors)
        for err in validation_errors:
            logger.error(f"[Prism] Workspace validation: {err}")
        return workspace

    # -------------------------------------------------------------------------
    # 1. Check required top-level keys exist
    # -------------------------------------------------------------------------
    required_keys = ["tabs", "panel", "panelTabs", "activeTabIds", "activePanelId"]
    for key in required_keys:
        if key not in workspace:
            validation_errors.append(f"Missing required key: '{key}'")

    # If missing critical keys, return early
    if validation_errors:
        if errors == "raise":
            raise InvalidWorkspace(validation_errors)
        for err in validation_errors:
            logger.error(f"[Prism] Workspace validation: {err}")
        return workspace

    tabs = workspace["tabs"]
    panel = workspace["panel"]
    panel_tabs = workspace["panelTabs"]
    active_tab_ids = workspace["activeTabIds"]
    active_panel_id = workspace["activePanelId"]

    type_errors = False
    if not isinstance(tabs, list):
        validation_errors.append(f"tabs: expected list, got {type(tabs).__name__}")
        type_errors = True
    if not isinstance(panel, dict):
        validation_errors.append(f"panel: expected dict, got {type(panel).__name__}")
        type_errors = True
    if not isinstance(panel_tabs, dict):
        validation_errors.append(f"panelTabs: expected dict, got {type(panel_tabs).__name__}")
        type_errors = True
    if not isinstance(active_tab_ids, dict):
        validation_errors.append(
            f"activeTabIds: expected dict, got {type(active_tab_ids).__name__}"
        )
        type_errors = True
    if not isinstance(active_panel_id, str) or not active_panel_id:
        validation_errors.append("activePanelId: expected non-empty string")

    if type_errors:
        if errors == "raise":
            raise InvalidWorkspace(validation_errors)
        for err in validation_errors:
            logger.error(f"[Prism] Workspace validation: {err}")
        return workspace

    # -------------------------------------------------------------------------
    # 2. Validate panel tree structure
    # -------------------------------------------------------------------------
    _validate_panel_structure(panel, validation_errors)

    # -------------------------------------------------------------------------
    # 3. Collect leaf panel IDs and tab IDs
    # -------------------------------------------------------------------------
    leaf_panel_ids = set(_get_leaf_panel_ids(panel))
    tab_ids_in_tabs = {
        tab_id
        for tab in tabs
        if isinstance(tab, dict) and isinstance((tab_id := tab.get("id")), str) and tab_id
    }

    # Build mapping of tab_id -> list of panels it appears in (for duplicate check)
    tab_to_panels: Dict[str, List[str]] = {}
    for panel_id, tab_list in panel_tabs.items():
        if not isinstance(panel_id, str) or not panel_id:
            validation_errors.append("panelTabs: panel IDs must be non-empty strings")
            continue
        if not isinstance(tab_list, list):
            validation_errors.append(
                f"panelTabs['{panel_id}']: expected list, got {type(tab_list).__name__}"
            )
            continue
        for tab_id in tab_list:
            if not isinstance(tab_id, str) or not tab_id:
                validation_errors.append(
                    f"panelTabs['{panel_id}']: tab IDs must be non-empty strings"
                )
                continue
            if tab_id not in tab_to_panels:
                tab_to_panels[tab_id] = []
            tab_to_panels[tab_id].append(panel_id)

    # -------------------------------------------------------------------------
    # 4. Every tab in `tabs` appears in exactly one panelTabs list
    # -------------------------------------------------------------------------
    for tab in tabs:
        if not isinstance(tab, dict):
            validation_errors.append(f"tabs: expected dict items, got {type(tab).__name__}")
            continue
        tab_id = tab.get("id")
        if not isinstance(tab_id, str) or not tab_id:
            validation_errors.append("tabs: found tab without valid 'id' field")
            continue

        panels_containing_tab = tab_to_panels.get(tab_id, [])
        if len(panels_containing_tab) == 0:
            validation_errors.append(f"Tab '{tab_id}' exists in tabs but not in any panelTabs list")
        elif len(panels_containing_tab) > 1:
            validation_errors.append(
                f"Tab '{tab_id}' appears in multiple panels: {panels_containing_tab}"
            )

    # -------------------------------------------------------------------------
    # 5. Every tab in panelTabs exists in tabs
    # -------------------------------------------------------------------------
    for panel_id, tab_list in panel_tabs.items():
        if not isinstance(panel_id, str) or not panel_id:
            continue
        if not isinstance(tab_list, list):
            continue  # Already reported above
        for tab_id in tab_list:
            if not isinstance(tab_id, str) or not tab_id:
                continue
            if tab_id not in tab_ids_in_tabs:
                validation_errors.append(
                    f"Tab '{tab_id}' in panelTabs['{panel_id}'] not found in tabs"
                )

    # -------------------------------------------------------------------------
    # 6. Every panelTabs key is a leaf panel in panel tree
    # -------------------------------------------------------------------------
    for panel_id in panel_tabs.keys():
        if not isinstance(panel_id, str) or not panel_id:
            continue
        if panel_id not in leaf_panel_ids:
            validation_errors.append(
                f"panelTabs key '{panel_id}' is not a leaf panel in the panel tree"
            )

    # -------------------------------------------------------------------------
    # 7. Every leaf panel has a panelTabs entry
    # -------------------------------------------------------------------------
    for leaf_id in leaf_panel_ids:
        if leaf_id not in panel_tabs:
            validation_errors.append(f"Leaf panel '{leaf_id}' missing from panelTabs")

    # -------------------------------------------------------------------------
    # 8. activePanelId is a valid leaf panel
    # -------------------------------------------------------------------------
    if isinstance(active_panel_id, str) and active_panel_id:
        if active_panel_id not in leaf_panel_ids:
            validation_errors.append(f"activePanelId '{active_panel_id}' is not a valid leaf panel")

    # -------------------------------------------------------------------------
    # 9. Each activeTabIds entry references valid panel and tab
    # -------------------------------------------------------------------------
    for panel_id, tab_id in active_tab_ids.items():
        if not isinstance(panel_id, str) or not panel_id:
            validation_errors.append("activeTabIds: panel IDs must be non-empty strings")
            continue
        if panel_id not in panel_tabs:
            validation_errors.append(f"activeTabIds references unknown panel '{panel_id}'")
            continue
        if tab_id is None:
            continue
        if not isinstance(tab_id, str) or not tab_id:
            validation_errors.append(f"activeTabIds['{panel_id}'] must be a non-empty string")
            continue
        if tab_id not in (panel_tabs.get(panel_id) or []):
            validation_errors.append(
                f"activeTabIds['{panel_id}'] = '{tab_id}' but tab not in panelTabs['{panel_id}']"
            )

    # -------------------------------------------------------------------------
    # Handle errors
    # -------------------------------------------------------------------------
    if validation_errors:
        if errors == "raise":
            raise InvalidWorkspace(validation_errors)
        for err in validation_errors:
            logger.error(f"[Prism] Workspace validation: {err}")

    return workspace


# =============================================================================
# LAYOUT TRAVERSAL
# =============================================================================


def walk_layout(
    layout: Any,
    transform: Callable[[Any], Any],
    _visited: Optional[Set[int]] = None,
) -> Any:
    """Recursively walk and transform a Dash component tree.

    :param layout: The root component to transform.
    :type layout: Any
    :param transform: Function called on each component. Receives a component
        and returns the transformed component.
    :type transform: Callable[[Any], Any]
    :returns: The transformed layout.
    :rtype: Any

    **Example**::

        def add_class(component):
            if hasattr(component, 'className'):
                existing = component.className or ''
                component.className = f'{existing} my-class'.strip()
            return component

        transformed = walk_layout(my_layout, add_class)
    """
    if _visited is None:
        _visited = set()

    # Handle None
    if layout is None:
        return None

    # Handle primitive types
    if isinstance(layout, (str, int, float, bool)):
        return layout

    # Handle lists/tuples
    if isinstance(layout, (list, tuple)):
        result = [walk_layout(child, transform, _visited) for child in layout]
        return type(layout)(result)

    # Handle dicts (but not Dash components)
    if isinstance(layout, dict) and not hasattr(layout, "_type"):
        return {k: walk_layout(v, transform, _visited) for k, v in layout.items()}

    # Check for circular references
    layout_id = id(layout)
    if layout_id in _visited:
        return layout
    _visited.add(layout_id)

    # Transform the component
    layout = transform(layout)

    # Recursively transform children
    if hasattr(layout, "children"):
        children = getattr(layout, "children", None)
        if children is not None:
            layout.children = walk_layout(children, transform, _visited)

    return layout


# =============================================================================
# ID INJECTION
# =============================================================================


def inject_tab_id(layout: Any, tab_id: str) -> Any:
    """Convert component IDs to pattern-matching format for tab isolation.

    Transforms string IDs like ``'my-input'`` into pattern-matching dicts::

        {'type': 'my-input', 'index': tab_id}

    Components that already have pattern-matching IDs (dicts) are left unchanged.
    Components without an ID are also left unchanged.

    :param layout: The component tree to transform.
    :type layout: Any
    :param tab_id: The tab ID to inject as the ``'index'`` value.
    :type tab_id: str
    :returns: Layout with transformed IDs (deep copy).
    :rtype: Any

    **Example**::

        layout = html.Div([
            dcc.Input(id='my-input'),
            html.Div(id='my-output'),
            html.Span(id={'type': 'existing', 'index': 'other'}),
        ])
        injected = inject_tab_id(layout, 'tab-abc-123')
        # String IDs become: {'type': 'my-input', 'index': 'tab-abc-123'}
        # Dict IDs are left unchanged
    """
    layout = copy.deepcopy(layout)

    def transform(component: Any) -> Any:
        if hasattr(component, "id"):
            component_id = getattr(component, "id", None)

            # Only transform string IDs (skip None and dict IDs)
            if isinstance(component_id, str):
                component.id = {
                    "type": component_id,
                    "index": tab_id,
                }
        return component

    return walk_layout(layout, transform)


# =============================================================================
# LAYOUT RENDERING
# =============================================================================


def render_layout_for_tab(data: Dict[str, Any]) -> Any:
    """Render a layout for a tab based on its data.

    This is a synchronous helper function for manual rendering.
    For callback-based rendering, see :func:`init.init`.

    :param data: Tab data dict containing ``tabId`` (unique ID), ``layoutId``
        (registered layout ID), ``layoutParams`` (callback parameters), and
        ``layoutOption`` (selected option key).
    :type data: dict[str, Any]
    :returns: The rendered Dash component tree.
    :rtype: Any
    :raises ValueError: If ``tabId`` is not provided.

    .. note:: This function does NOT handle async callbacks. Use the callback
        created by :func:`init.init` for full async support.
    """
    from dash import html

    from .registry import get_layout, resolve_layout_params

    tab_id = data.get("tabId")
    layout_id = data.get("layoutId")
    layout_params = data.get("layoutParams", {})
    layout_option = data.get("layoutOption") or None

    if not layout_id:
        return html.Div(
            "Select a layout from the search bar",
            className="prism-empty-tab",
        )

    registration = get_layout(layout_id)

    if not registration:
        return html.Div(
            f"Layout '{layout_id}' not found",
            className="prism-error-tab",
        )

    try:
        resolved_params = resolve_layout_params(
            registration,
            layout_id,
            layout_params,
            layout_option,
        )

        if registration.is_callable and registration.callback is not None:
            layout = registration.callback(**resolved_params)
        else:
            layout = copy.deepcopy(registration.layout)

        if tab_id is None:
            raise ValueError("tabId is required")

        return inject_tab_id(layout, tab_id)

    except TypeError as e:
        return html.Div(
            [
                html.H3("Layout Error"),
                html.Pre(f"Error rendering layout: {e}\nCheck required parameters."),
            ],
            className="prism-error-tab",
        )
    except ValueError as e:
        return html.Div(
            [
                html.H3("Layout Error"),
                html.Pre(str(e)),
            ],
            className="prism-error-tab",
        )
    except Exception as e:
        return html.Div(
            [
                html.H3("Layout Error"),
                html.Pre(str(e)),
            ],
            className="prism-error-tab",
        )


# =============================================================================
# COMPONENT UTILITIES
# =============================================================================


def find_component_by_id(layout: Any, component_id: str) -> Optional[Any]:
    """Find a component by its ID in a layout tree.

    :param layout: The root component to search.
    :type layout: Any
    :param component_id: The ID to find.
    :type component_id: str
    :returns: The component with matching ID, or ``None`` if not found.
    :rtype: Any | None
    """
    result: Optional[Any] = None

    def search(component: Any) -> Any:
        nonlocal result
        if hasattr(component, "id") and component.id == component_id:
            result = component
        return component

    walk_layout(layout, search)
    return result


def update_component_props(
    layout: Any,
    component_id: str,
    **props: Any,
) -> Any:
    """Update properties of a component by ID.

    :param layout: The root component tree.
    :type layout: Any
    :param component_id: The ID of the component to update.
    :type component_id: str
    :param props: Properties to set on the component.
    :type props: Any
    :returns: The updated layout (deep copy).
    :rtype: Any

    **Example**::

        layout = html.Div([
            dcc.Input(id='my-input', value='old'),
        ])
        updated = update_component_props(layout, 'my-input', value='new')
    """
    layout = copy.deepcopy(layout)

    def transform(component: Any) -> Any:
        if hasattr(component, "id") and component.id == component_id:
            for key, value in props.items():
                setattr(component, key, value)
        return component

    return walk_layout(layout, transform)
