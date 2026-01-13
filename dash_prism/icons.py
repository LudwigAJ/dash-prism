"""Icon utilities for dash_prism.

This module provides access to the available icon names that can be used
with :class:`Action` and tab icons in :class:`Prism`.

The icon list is defined in ``src/icons.json`` (single source of truth)
and copied to the package during build.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List


@lru_cache(maxsize=1)
def _load_icons() -> frozenset[str]:
    """Load available icons from icons.json.

    :returns: Frozen set of available icon names.
    :rtype: frozenset[str]
    """
    icons_path = Path(__file__).parent / 'icons.json'
    if not icons_path.exists():
        # Fallback for development when icons.json hasn't been copied
        icons_path = Path(__file__).parent.parent / 'src' / 'icons.json'

    if not icons_path.exists():
        raise FileNotFoundError(
            f"icons.json not found. Expected at {icons_path}. "
            "Run 'npm run build' to generate it."
        )

    with icons_path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    return frozenset(data['icons'])


def _get_available_icons_set() -> frozenset[str]:
    """Get the frozen set of available icons (lazy-loaded).

    :returns: Frozen set of available icon names.
    :rtype: frozenset[str]
    """
    return _load_icons()


def get_available_icons() -> List[str]:
    """Get a sorted list of available icon names.

    These icons can be used with the ``icon`` parameter of :class:`Action`
    and for tab icons in :class:`Prism`. Icons are from a curated subset
    of `lucide-react <https://lucide.dev/icons>`_.

    :returns: Sorted list of available icon names.
    :rtype: list[str]

    .. rubric:: Example

    .. code-block:: python

        import dash_prism

        # Print all available icons
        for icon in dash_prism.get_available_icons():
            print(icon)

        # Check if an icon is available
        if 'Rocket' in dash_prism.AVAILABLE_ICONS:
            print('Rocket icon is available!')

    .. seealso::

        :data:`AVAILABLE_ICONS`
            Frozen set for membership testing.

        :class:`Action`
            Action component that uses icons.
    """
    return sorted(_get_available_icons_set())


# Module-level constant for convenient access
# Note: This is loaded lazily on first access to avoid import-time file I/O
class _AvailableIconsProxy:
    """Lazy proxy for AVAILABLE_ICONS to defer file loading until first use."""

    _icons: frozenset[str] | None = None

    def _load(self) -> frozenset[str]:
        if self._icons is None:
            self._icons = _load_icons()
        return self._icons

    def __contains__(self, item: object) -> bool:
        return item in self._load()

    def __iter__(self):
        return iter(self._load())

    def __len__(self) -> int:
        return len(self._load())

    def __repr__(self) -> str:
        return f"frozenset({sorted(self._load())!r})"


#: Frozen set of all available icon names.
#: Icons are from a curated subset of `lucide-react <https://lucide.dev/icons>`_.
#:
#: Use for membership testing::
#:
#:     if 'Rocket' in dash_prism.AVAILABLE_ICONS:
#:         print('Available!')
#:
#: For a sorted list, use :func:`get_available_icons`.
AVAILABLE_ICONS: frozenset[str] = _AvailableIconsProxy()  # type: ignore[assignment]
