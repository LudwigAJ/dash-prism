"""Icon names for Prism tabs.

A tab in :class:`dash_prism.Prism` can show a small icon adjacent to its
name. The icon names come from a small group of the `lucide-react
<https://lucide.dev/icons>`_ icons. This module gives two ways to read the
names. :func:`get_available_icons` returns a sorted list, and
:data:`AVAILABLE_ICONS` lets you do a membership test.

The file ``src/icons.json`` holds the names. It is the one source of truth for
the TypeScript frontend and for this module. The webpack build copies the file
into the package directory of ``dash_prism``. This module reads the file one
time only, at the first call, and then keeps the names in a cache.

An icon name is case-sensitive and starts with an uppercase letter. For
example, ``'Rocket'`` is correct, but ``'rocket'`` is not. The frontend shows
no icon for a name that ``icons.json`` does not hold.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _load_icons() -> frozenset[str]:
    """Read the icon names from ``icons.json``.

    The function reads one of two paths. The first path is ``icons.json`` in
    the package directory that holds this module. The webpack build copies the
    file to that path. If that file is not available, the function uses
    ``src/icons.json`` in the parent directory. The second path helps when you
    work in a source checkout that has no build output.

    The :func:`functools.lru_cache` decorator keeps the frozen set in a cache.
    Thus the function reads the file one time only in each Python process.

    :returns: A frozen set of the icon names that ``icons.json`` holds.
    :rtype: frozenset[str]
    :raises FileNotFoundError: If the two paths have no ``icons.json`` file.
        The message names the second path and tells you to run
        ``pnpm run build``.
    :raises KeyError: If ``icons.json`` has no ``icons`` key.
    """
    icons_path = Path(__file__).parent / "icons.json"
    if not icons_path.exists():
        # The build did not copy the file. Use the source file.
        icons_path = Path(__file__).parent.parent / "src" / "icons.json"

    if not icons_path.exists():
        raise FileNotFoundError(
            f"icons.json not found. Expected at {icons_path}. "
            "Run 'pnpm run build' to generate it."
        )

    with icons_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    return frozenset(data["icons"])


def _get_available_icons_set() -> frozenset[str]:
    """Return the frozen set of icon names.

    The function calls :func:`_load_icons`. The first call reads
    ``icons.json``. Each call after the first one returns the cached set and
    reads no file.

    :returns: A frozen set of the icon names.
    :rtype: frozenset[str]
    """
    return _load_icons()


def get_available_icons() -> list[str]:
    """Return a sorted list of the icon names.

    A tab in :class:`dash_prism.Prism` can show one of these icons adjacent
    to its name. The names come from a small group of the `lucide-react
    <https://lucide.dev/icons>`_ icons. Each name is case-sensitive, and it
    starts with an uppercase letter.

    The first call reads ``icons.json``. Each call after the first one uses
    the cached names, but it makes a new list each time.

    :returns: A new list of the icon names, sorted with the Python
        :func:`sorted` function.
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
    return sorted(_get_available_icons_set())


# The module makes one instance of this class below, with the name
# AVAILABLE_ICONS. The instance reads no file until the first use, thus an
# import of dash_prism reads no file.
class _AvailableIconsProxy:
    """A proxy that gives the icon names and reads ``icons.json`` at first use.

    The proxy gives a membership test, iteration, ``len()``, and ``repr()``.
    It is not an instance of :class:`frozenset`, thus it has no set
    operations, for example union or intersection.

    :ivar _icons: The icon names, or ``None`` before the first use.
    :type _icons: frozenset[str] | None
    """

    _icons: frozenset[str] | None = None

    def _load(self) -> frozenset[str]:
        if self._icons is None:
            self._icons = _load_icons()
        return self._icons

    def __contains__(self, item: object) -> bool:
        return item in self._load()

    def __iter__(self) -> Iterator[str]:
        return iter(self._load())

    def __len__(self) -> int:
        return len(self._load())

    def __repr__(self) -> str:
        return f"frozenset({sorted(self._load())!r})"


#: The icon names that a :class:`dash_prism.Prism` tab can show. The names
#: come from a small group of the `lucide-react <https://lucide.dev/icons>`_
#: icons.
#:
#: This object is a proxy. It is not an instance of :class:`frozenset`. The
#: proxy reads ``icons.json`` at the first use, thus an import of
#: ``dash_prism`` reads no file. The proxy gives a membership test, iteration,
#: ``len()``, and ``repr()``. It does not give the set operations of a frozen
#: set, for example union or intersection.
#:
#: Use it for a membership test::
#:
#:     if 'Rocket' in dash_prism.AVAILABLE_ICONS:
#:         print('Available!')
#:
#: For a sorted list, use :func:`dash_prism.get_available_icons`.
AVAILABLE_ICONS: frozenset[str] = _AvailableIconsProxy()  # type: ignore[assignment]
