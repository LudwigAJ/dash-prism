"""PrismContent Component Wrapper.

User-facing wrapper for the PrismContent component with documentation.
This file wraps the auto-generated PrismContentComponent while preserving
the component type expected by the Dash frontend bundle.
"""

from __future__ import annotations

from typing import Any

from dash.development.base_component import Component

from .PrismContentComponent import PrismContentComponent

# Sentinel to distinguish "not provided" from an explicit None
_UNSET: Any = type("_Unset", (), {"__repr__": lambda self: "_UNSET"})()


class PrismContent(PrismContentComponent):
    """Internal content host for Prism tab layouts.

    ``PrismContent`` is primarily created by Prism's frontend and
    :func:`dash_prism.init` callback wiring. Most applications should not
    instantiate it directly.

    :param children: Rendered Dash layout content for a Prism tab.
    :type children: dash.development.base_component.Component | list | str | int | float | None
    :param id: Pattern-matching Dash ID for the tab content host.
    :type id: str | dict | None
    :param data: Tab and layout metadata passed from Prism to the render callback.
    :type data: dict or None
    :param layoutTimeout: Timeout in seconds for layout loading. Defaults to ``30``.
    :type layoutTimeout: int or float
    """

    # Match the React export used by WorkspaceView's ExternalWrapper spec.
    _type = "PrismContent"

    def __init__(
        self,
        children: Component | list[Component] | str | int | float | None = _UNSET,
        id: str | dict[str, Any] | None = _UNSET,
        data: dict[str, Any] | None = _UNSET,
        layoutTimeout: int | float = _UNSET,
        **kwargs: Any,
    ):
        _locals = locals()
        explicit = {
            k: v
            for k, v in _locals.items()
            if k not in ("self", "kwargs", "_locals", "__class__") and v is not _UNSET
        }
        explicit.update(kwargs)
        super().__init__(**explicit)
