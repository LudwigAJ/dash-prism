"""The default argument value and the prop filter that the three component wrappers share.

Dash must know which props the caller of a wrapper gave. An explicit ``None``
reaches the browser as ``null`` and clears the prop, but an omitted argument
keeps the default of the React component. Each keyword argument of a wrapper
thus has the default :data:`UNSET`, and :func:`explicit_props` drops each
argument that still holds it.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class _Unset:
    """The type of :data:`UNSET`."""

    def __repr__(self) -> str:
        return "UNSET"


#: The default of each keyword argument of a wrapper. The annotation is ``Any``,
#: so the value can be the default of an argument of each type.
UNSET: Any = _Unset()


def explicit_props(arguments: Mapping[str, Any]) -> dict[str, Any]:
    """Return the props that the caller of a wrapper gave.

    The generated base class also builds its props from its ``locals()``. The
    filter thus gives the base class the same set of props as a direct call.

    :param arguments: The ``locals()`` of the ``__init__`` method of the
        wrapper. The method must read them before it assigns a local variable,
        because each local variable becomes a prop.
    :returns: Each argument that does not hold :data:`UNSET`, and the items of
        ``kwargs``.
    """
    props = {
        name: value
        for name, value in arguments.items()
        if name not in ("self", "kwargs", "__class__") and value is not UNSET
    }
    props.update(arguments["kwargs"])
    return props
