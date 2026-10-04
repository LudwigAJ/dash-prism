"""Tests for the icon names that a tab can show."""

from __future__ import annotations

import dash_prism


def test_available_icons_is_a_frozenset_with_the_names_of_get_available_icons() -> None:
    assert isinstance(dash_prism.AVAILABLE_ICONS, frozenset)
    assert "Rocket" in dash_prism.AVAILABLE_ICONS
    assert dash_prism.get_available_icons() == sorted(dash_prism.AVAILABLE_ICONS)
