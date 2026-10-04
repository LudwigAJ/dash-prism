"""Helpers that read and change a Dash component tree.

:func:`walk_layout` walks a component tree and calls a function on each
component. :func:`inject_tab_id` uses that walk. It changes the string
component IDs of a tab layout into pattern-matching IDs. Two tabs that show the
same layout thus keep different component IDs.
:func:`find_component_by_id` and :func:`update_component_props` read or change
one component in a tree.
"""

from __future__ import annotations

import copy
from collections.abc import Callable
from typing import Any


def walk_layout(
    layout: Any,
    transform: Callable[[Any], Any],
    _visited: set[int] | None = None,
) -> Any:
    """Walk a Dash component tree and call ``transform`` on each component.

    The function goes into lists, tuples, dictionaries, and the ``children``
    attribute of each component. It calls ``transform`` on a component before
    it goes into the children of that component.

    The function calls ``transform`` on components only. It returns ``None``,
    a string, a number, and a boolean with no change. It goes into the items
    of a list, a tuple, or a dictionary. But it does not call ``transform`` on
    the list, the tuple, or the dictionary. A pattern-matching ID is a
    dictionary, thus ``transform`` never receives one.

    The function changes the component objects, and it does not copy them.
    :func:`inject_tab_id` and :func:`update_component_props` make a deep copy
    before they call this function.

    The function keeps the ``id()`` value of each component that it walked
    into. If it finds the same component object again, it returns that
    component and does not go into it. This prevents a loop that does not end
    when the tree has a circular reference. It also means that ``transform``
    runs one time only for a component object that is in the tree two times.

    :param layout: The root of the tree to walk. This can be a component, a
        list, a tuple, a dictionary, a string, a number, a boolean, or
        ``None``.
    :type layout: Any
    :param transform: The function to call on each component. It receives the
        component, and it returns the component to put in the tree. It can
        return the same object or a different object.
    :type transform: Callable[[Any], Any]
    :param _visited: For internal use only. The set of ``id()`` values of the
        components that the walk already changed. Callers must not supply this
        parameter.
    :type _visited: set[int] | None
    :returns: The root of the tree after the walk. For a list or a tuple, the
        function returns a new object of the same type. For a component, it
        returns the result of ``transform``.
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

    if layout is None:
        return None

    if isinstance(layout, (str, int, float, bool)):
        return layout

    if isinstance(layout, (list, tuple)):
        result = [walk_layout(child, transform, _visited) for child in layout]
        return type(layout)(result)

    # A dictionary is a style dictionary or a pattern-matching ID, not a
    # component, so the transform function does not receive it.
    if isinstance(layout, dict):
        return {k: walk_layout(v, transform, _visited) for k, v in layout.items()}

    # Stop at a component that the walk already changed. This prevents a loop
    # that does not end when the tree has a circular reference.
    layout_id = id(layout)
    if layout_id in _visited:
        return layout
    _visited.add(layout_id)

    layout = transform(layout)

    if hasattr(layout, "children"):
        children = getattr(layout, "children", None)
        if children is not None:
            layout.children = walk_layout(children, transform, _visited)

    return layout


def inject_tab_id(layout: Any, tab_id: str) -> Any:
    """Change the string component IDs of one tab into pattern-matching IDs.

    Prism can show the same registered layout in more than one tab. Dash finds
    a component by its ID. If two tabs use the same string IDs, Dash cannot
    find the correct component. This function prevents that problem. It
    changes a string ID, for example ``'my-input'``, into a pattern-matching
    dictionary::

        {'type': 'my-input', 'index': tab_id}

    A callback can then use ``MATCH`` on the ``index`` key to address the
    components of one tab. It can use ``ALL`` to address the same component of
    all the tabs.

    The function makes no change to a component that has no ``id``. It also
    makes no change to an ID that is already a dictionary. It works on a deep
    copy, thus the layout that the caller supplies stays as it is.

    :param layout: The component tree to change. This is the layout of one
        tab.
    :type layout: Any
    :param tab_id: The ID of the tab. The function puts this value in the
        ``'index'`` key of each new pattern-matching ID.
    :type tab_id: str
    :returns: A deep copy of ``layout``, with the new IDs.
    :rtype: Any

    **Example**::

        layout = html.Div([
            dcc.Input(id='my-input'),
            html.Div(id='my-output'),
            html.Span(id={'type': 'existing', 'index': 'other'}),
        ])
        injected = inject_tab_id(layout, 'tab-abc-123')
        # String IDs become: {'type': 'my-input', 'index': 'tab-abc-123'}
        # dict IDs are left unchanged
    """
    layout = copy.deepcopy(layout)

    def transform(component: Any) -> Any:
        if hasattr(component, "id"):
            component_id = getattr(component, "id", None)

            # Change a string ID only. Ignore a dictionary ID, because it is
            # already a pattern-matching ID.
            if isinstance(component_id, str):
                component.id = {
                    "type": component_id,
                    "index": tab_id,
                }
        return component

    return walk_layout(layout, transform)


def find_component_by_id(layout: Any, component_id: str) -> Any | None:
    """Find one component in a layout tree by its ID.

    The function walks the full tree. It compares the ``id`` attribute of each
    component against ``component_id`` with the ``==`` operator. A
    pattern-matching ID is a dictionary, thus it never agrees with a string.

    The function returns the component object from the tree, and not a copy. A
    change to that object is also a change to the tree that the caller
    supplied.

    :param layout: The root of the tree to examine.
    :type layout: Any
    :param component_id: The ID to find.
    :type component_id: str
    :returns: The component that has this ID, or ``None`` if the tree holds no
        component with this ID. If more than one component has the ID, the
        function returns the first one that the walk finds. The walk examines
        a component before its children.
    :rtype: Any | None
    """
    result: Any | None = None

    def search(component: Any) -> Any:
        nonlocal result
        if result is None and hasattr(component, "id") and component.id == component_id:
            result = component
        return component

    walk_layout(layout, search)
    return result


def update_component_props(
    layout: Any,
    component_id: str,
    **props: Any,
) -> Any:
    """Set properties on each component in a tree that has a given ID.

    The function walks a deep copy of ``layout``. It finds each component
    that has the ID, and it sets each keyword argument as an attribute of that
    component. If more than one component has the ID, the function changes all
    of them.

    The function does not check that a property name is correct for the
    component type. It sets the attribute in all cases. But Dash ignores an
    unknown property name when it renders the layout. Thus an incorrect name
    makes no change to the page.

    :param layout: The root of the tree to change.
    :type layout: Any
    :param component_id: The ID of the component or components to change.
    :type component_id: str
    :param props: The properties to set, as keyword arguments. The name of
        each keyword argument becomes the name of an attribute on the
        component.
    :type props: Any
    :returns: A deep copy of ``layout``, with the new property values. The
        tree that the caller supplies stays as it is.
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
