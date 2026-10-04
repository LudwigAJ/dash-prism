"""Validation of the workspace dictionary that the Prism component sends back.

:func:`validate_workspace` examines the workspace dictionary that the browser
sends back, and it reports the parts that do not agree with each other. Your
code can call it before it writes a workspace to a database.
:exc:`InvalidWorkspaceError` holds the messages from that check.
"""

from __future__ import annotations

import logging
from typing import Any, Literal, TypeVar

logger = logging.getLogger(__name__)

_T = TypeVar("_T")


class InvalidWorkspaceError(Exception):
    """A workspace dictionary whose parts do not agree.

    :func:`validate_workspace` raises this exception when the caller keeps the
    default ``errors='raise'`` and one or more checks fail. The exception
    message starts with ``Invalid workspace:`` and then puts all the error
    messages into one string.

    The :attr:`errors` attribute keeps each message as its own string, thus
    your code can show the messages in a list or a table.

    :ivar errors: The error messages from one call to
        :func:`validate_workspace`. Each message names the key, the tab, or
        the panel that is not correct.
    :type errors: list[str]
    """

    def __init__(self, errors: list[str]) -> None:
        """Make the exception from a list of error messages.

        :param errors: The error messages. The method keeps this list in
            :attr:`errors` and also puts the messages into the exception
            message.
        :type errors: list[str]
        """
        self.errors = errors
        message = f"Invalid workspace: {'; '.join(errors)}"
        super().__init__(message)


#: The old name of :exc:`InvalidWorkspaceError`. Code that catches this name
#: catches the same class. The alias stays through the 1.x releases.
InvalidWorkspace = InvalidWorkspaceError


def _get_leaf_panel_ids(panel: dict[str, Any], leaves: list[str] | None = None) -> list[str]:
    """Collect the IDs of all the leaf panels in a panel tree.

    A leaf panel has no ``children`` key, or it has an empty ``children``
    list. Only a leaf panel holds tabs. A container panel holds other panels
    and divides the space between those panels.

    The function calls itself for each child of a container panel. As a
    result, it finds the leaf panels at any depth. It ignores a node that is
    not a dictionary. It also ignores a leaf panel with no ``id``, or with an
    ``id`` that is not a string with one or more characters.

    :param panel: The panel node to start from. This is usually the value of
        the ``panel`` key of a workspace.
    :type panel: dict[str, Any]
    :param leaves: The list that collects the IDs. The function makes a new
        list if this parameter is ``None``, and it gives the same list to each
        call that it makes for a child panel.
    :type leaves: list[str] | None
    :returns: The leaf panel IDs, in the sequence that the walk finds them.
        This is the same list object as ``leaves`` when the caller supplies
        one.
    :rtype: list[str]
    """
    if leaves is None:
        leaves = []

    children = panel.get("children", [])
    if not children:
        panel_id = panel.get("id")
        if isinstance(panel_id, str) and panel_id:
            leaves.append(panel_id)
    else:
        for child in children:
            if isinstance(child, dict):
                _get_leaf_panel_ids(child, leaves)

    return leaves


def _validate_panel_structure(
    panel: Any,
    errors: list[str],
    path: str = "panel",
) -> None:
    """Validate the structure of a panel tree and collect the error messages.

    The function applies these rules to each node:

    - The node must be a dictionary.
    - The node must have an ``id`` that is a string with one or more
      characters.
    - A node that has children must also have a ``direction`` of
      ``'horizontal'`` or ``'vertical'``, and its ``children`` must be a list.

    A node with an empty ``children`` list, or with no ``children`` key, is a
    leaf panel. The function applies no ``direction`` rule to a leaf panel.

    The function calls itself for each child, thus it checks the full tree. It
    does not stop at the first problem. It adds each message to ``errors`` and
    continues.

    :param panel: The panel node to validate. A node that is not a dictionary
        is an error.
    :type panel: Any
    :param errors: The list of error messages. The function adds each new
        message to this list. The function returns nothing.
    :type errors: list[str]
    :param path: The position of this node in the tree, for the error
        messages. The function makes the path of a child from this value, for
        example ``panel.children[0]``.
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
        direction = panel.get("direction")
        if direction not in ("horizontal", "vertical"):
            errors.append(
                f"{path} (id={panel_id}): container panel missing valid 'direction' "
                f"(got {direction!r}, expected 'horizontal' or 'vertical')"
            )

        if not isinstance(children, list):
            errors.append(f"{path} (id={panel_id}): 'children' must be a list")
        else:
            for i, child in enumerate(children):
                _validate_panel_structure(child, errors, path=f"{path}.children[{i}]")


def _raise_or_log(validation_errors: list[str], errors: Literal["raise", "ignore"]) -> None:
    """Report the problems that the checks found, in the way that ``errors`` selects.

    :raises InvalidWorkspaceError: If ``errors`` is ``'raise'`` and
        ``validation_errors`` is not empty.
    """
    if validation_errors and errors == "raise":
        raise InvalidWorkspaceError(validation_errors)
    for err in validation_errors:
        logger.error("Workspace validation: %s", err)


def validate_workspace(
    workspace: _T,
    errors: Literal["raise", "ignore"] = "raise",
) -> _T:
    """Validate that a dictionary is a correct Prism workspace.

    A Prism workspace has five top-level keys. ``tabs`` is the list of all the
    tabs. ``panel`` is the root of the panel tree. ``panelTabs`` gives the list
    of tab IDs for each leaf panel ID. ``activeTabIds`` gives the ID of the tab
    that each panel shows, or ``None``. ``activePanelId`` is the ID of the leaf
    panel that is active.

    The function does the checks in this sequence. First it makes sure that
    ``workspace`` is a dictionary and has the five keys. Then it makes sure
    that each of the five values has the correct type. Then it validates the panel tree with the
    rules of :func:`_validate_panel_structure`. Last, it compares the five
    values against each other.

    The function applies these cross-key rules:

    - Each tab in ``tabs`` is in the tab list of one panel only.
    - Each tab ID in ``panelTabs`` has a tab in ``tabs``.
    - Each key of ``panelTabs`` is a leaf panel of the panel tree.
    - Each leaf panel of the panel tree has an entry in ``panelTabs``.
    - ``activePanelId`` is a leaf panel of the panel tree.
    - Each key of ``activeTabIds`` is also a key of ``panelTabs``.
    - Each value of ``activeTabIds`` is ``None``, or it is a tab ID in the tab
      list of the same panel.

    The function collects all the problems that it finds, and it does not stop
    at the first one. But it returns immediately if one of the five keys is
    missing. It also returns immediately if ``tabs``, ``panel``, ``panelTabs``,
    or ``activeTabIds`` has the incorrect type. The checks that follow cannot
    use a value of the incorrect type.

    The function does not examine the other fields of a tab, for example
    ``name``, ``panelId``, or ``createdAt``. It also does not examine the
    ``order`` field of a panel.

    :param workspace: The dictionary to validate. The function accepts a value
        of any type and reports an incorrect type as an error.
    :type workspace: Any
    :param errors: What the function does when a check fails. ``'raise'``
        raises :exc:`dash_prism.InvalidWorkspaceError` with all the messages.
        ``'ignore'`` records each message with the ``dash_prism.workspace``
        logger at the error level, and then returns the workspace. The default
        is ``'raise'``.
    :type errors: Literal['raise', 'ignore']
    :returns: The same ``workspace`` object that the caller supplied. The
        function does not copy the workspace, and it does not change the
        workspace.
    :rtype: Any
    :raises dash_prism.InvalidWorkspaceError: If ``errors='raise'`` and one or
        more checks fail. The :attr:`~dash_prism.InvalidWorkspaceError.errors`
        attribute holds all the messages.

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
    validation_errors: list[str] = []

    if not isinstance(workspace, dict):
        validation_errors.append(f"Workspace must be a dict, got {type(workspace).__name__}")
        _raise_or_log(validation_errors, errors)
        return workspace

    # -------------------------------------------------------------------------
    # 1. Make sure that the workspace has the five top-level keys.
    # -------------------------------------------------------------------------
    required_keys = ["tabs", "panel", "panelTabs", "activeTabIds", "activePanelId"]
    for key in required_keys:
        if key not in workspace:
            validation_errors.append(f"Missing required key: '{key}'")

    # The checks that follow need these keys. Return now if one is missing.
    if validation_errors:
        _raise_or_log(validation_errors, errors)
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
    # A bad activePanelId does not stop the checks, because no later check
    # reads its value unless it is a string.
    if not isinstance(active_panel_id, str) or not active_panel_id:
        validation_errors.append("activePanelId: expected non-empty string")

    if type_errors:
        _raise_or_log(validation_errors, errors)
        return workspace

    # -------------------------------------------------------------------------
    # 2. Validate the structure of the panel tree.
    # -------------------------------------------------------------------------
    _validate_panel_structure(panel, validation_errors)

    # -------------------------------------------------------------------------
    # 3. Collect the leaf panel IDs and the tab IDs, and make sure that each
    #    tab ID in panelTabs has a tab in `tabs`.
    # -------------------------------------------------------------------------
    leaf_panel_ids = set(_get_leaf_panel_ids(panel))
    tab_ids_in_tabs = {
        tab_id
        for tab in tabs
        if isinstance(tab, dict) and isinstance((tab_id := tab.get("id")), str) and tab_id
    }

    # Record the panels that hold each tab ID. A tab must be in one panel only,
    # thus more than one panel for a tab ID is an error.
    tab_to_panels: dict[str, list[str]] = {}
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
            tab_to_panels.setdefault(tab_id, []).append(panel_id)
            if tab_id not in tab_ids_in_tabs:
                validation_errors.append(
                    f"Tab '{tab_id}' in panelTabs['{panel_id}'] not found in tabs"
                )

    # -------------------------------------------------------------------------
    # 4. Each tab in `tabs` is in one panelTabs list only.
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
        if not panels_containing_tab:
            validation_errors.append(f"Tab '{tab_id}' exists in tabs but not in any panelTabs list")
        elif len(panels_containing_tab) > 1:
            validation_errors.append(
                f"Tab '{tab_id}' appears in multiple panels: {panels_containing_tab}"
            )

    # -------------------------------------------------------------------------
    # 5. Each panelTabs key is a leaf panel of the panel tree.
    # -------------------------------------------------------------------------
    for panel_id in panel_tabs:
        if not isinstance(panel_id, str) or not panel_id:
            continue
        if panel_id not in leaf_panel_ids:
            validation_errors.append(
                f"panelTabs key '{panel_id}' is not a leaf panel in the panel tree"
            )

    # -------------------------------------------------------------------------
    # 6. Each leaf panel has an entry in panelTabs.
    # -------------------------------------------------------------------------
    for leaf_id in leaf_panel_ids:
        if leaf_id not in panel_tabs:
            validation_errors.append(f"Leaf panel '{leaf_id}' missing from panelTabs")

    # -------------------------------------------------------------------------
    # 7. activePanelId is a leaf panel of the panel tree.
    # -------------------------------------------------------------------------
    if isinstance(active_panel_id, str) and active_panel_id:
        if active_panel_id not in leaf_panel_ids:
            validation_errors.append(f"activePanelId '{active_panel_id}' is not a valid leaf panel")

    # -------------------------------------------------------------------------
    # 8. Each activeTabIds entry refers to a panel in panelTabs, and to a tab
    #    that the same panel holds.
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

    _raise_or_log(validation_errors, errors)
    return workspace
