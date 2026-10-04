"""Icon names for Prism tabs.

A tab in :class:`dash_prism.Prism` can show a small icon adjacent to its
name. The icon names come from a small group of the `lucide-react
<https://lucide.dev/icons>`_ icons. This module gives two ways to read the
names. :func:`get_available_icons` returns a sorted list, and
:data:`AVAILABLE_ICONS` lets you do a membership test.

The file ``src/icons.json`` holds the names. It is the one source of truth for
the TypeScript frontend and for this module. The webpack build copies the file
into the package directory of ``dash_prism``. This module reads the file one
time, when Python imports it. An import of ``dash_prism`` without the build
output fails before that read in all cases, because the generated component
modules are absent too.

An icon name is case-sensitive and starts with an uppercase letter. For
example, ``'Rocket'`` is correct, but ``'rocket'`` is not. The frontend shows
no icon for a name that ``icons.json`` does not hold.
"""

from __future__ import annotations

import json
from pathlib import Path


def _load_icons() -> frozenset[str]:
    """Read the icon names from the ``icons.json`` file of the package."""
    with (Path(__file__).parent / "icons.json").open(encoding="utf-8") as f:
        return frozenset(json.load(f)["icons"])


#: The icon names that a :class:`dash_prism.Prism` tab can show, as a
#: :class:`frozenset`. The names come from a small group of the `lucide-react
#: <https://lucide.dev/icons>`_ icons.
#:
#: Use it for a membership test::
#:
#:     if 'Rocket' in dash_prism.AVAILABLE_ICONS:
#:         print('Available!')
#:
#: For a sorted list, use :func:`dash_prism.get_available_icons`.
AVAILABLE_ICONS: frozenset[str] = _load_icons()


def get_available_icons() -> list[str]:
    """Return a sorted list of the icon names.

    A tab in :class:`dash_prism.Prism` can show one of these icons adjacent
    to its name. The names come from a small group of the `lucide-react
    <https://lucide.dev/icons>`_ icons. Each name is case-sensitive, and it
    starts with an uppercase letter.

    :returns: A new list of the names in :data:`AVAILABLE_ICONS`, sorted with
        the Python :func:`sorted` function.
    :rtype: list[str]

    .. rubric:: Example

    .. code-block:: python

        import dash_prism

        # Print each available icon name
        for icon in dash_prism.get_available_icons():
            print(icon)

        # Find out whether one icon is available
        if 'Rocket' in dash_prism.AVAILABLE_ICONS:
            print('Rocket icon is available!')

    .. seealso::

        :data:`dash_prism.AVAILABLE_ICONS`
            The same names, for a membership test.

        :class:`dash_prism.Prism`
            The workspace component. Each of its tabs can show an icon.
    """
    return sorted(AVAILABLE_ICONS)
