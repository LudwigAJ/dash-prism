"""PrismContent Component Wrapper.

This module holds the ``PrismContent`` class. ``PrismContent`` wraps the
auto-generated :class:`dash_prism.PrismContentComponent` and keeps the
component type that the JavaScript bundle registers. The wrapper sends only the
props that you give. The React component keeps its own defaults for every prop
that you omit.
"""

from __future__ import annotations

from typing import Any

from dash.development.base_component import Component

from .PrismContentComponent import PrismContentComponent

# Sentinel that shows the difference between a prop you do not give and a prop
# you set to an explicit None.
_UNSET: Any = type("_Unset", (), {"__repr__": lambda self: "_UNSET"})()


class PrismContent(PrismContentComponent):
    """Internal content host for Prism tab layouts.

    Prism makes one ``PrismContent`` for each tab. The frontend builds a Dash
    component specification with the type ``PrismContent`` and a
    pattern-matching ID, and Dash mounts the component from that
    specification. The render callback that :func:`dash_prism.init` registers
    then answers with the layout, which Dash puts into ``children``. Most
    applications do not make this component themselves.

    The component shows one of four states. It shows the ``children`` after the
    callback returns them. It shows a "Loading layout..." message while the
    callback runs. It shows a timeout card if the tab has a layout but no
    content arrives in ``layoutTimeout`` seconds. That card has a "Try Again"
    button, which starts the wait again. It shows nothing if the tab has no
    layout.

    :param children: Rendered Dash layout content for a Prism tab.
    :type children: dash.development.base_component.Component | list | str | int | float | None
    :param id: Pattern-matching Dash ID for the tab content host. Prism sets it
        to ``{"type": "prism-content", "index": <tab id>}``, which is the ID
        that the render callback matches.
    :type id: str | dict | None
    :param data: Tab request that Prism passes to the render callback. Keys:
        ``tabId``, ``layoutId``, ``layoutParams``, ``layoutOption`` and
        ``timeout`` (seconds, mirrors ``layoutTimeout``). The callback stops if
        ``data`` gives neither a tab ID nor a layout ID.
    :type data: dict or None
    :param layoutTimeout: Client-side timeout in seconds for layout loading.
        Prism sets it from its own ``layoutTimeout`` prop. A value that is not
        a finite number more than zero falls back to ``30``. Defaults to
        ``30``.
    :type layoutTimeout: float
    """

    # The JavaScript bundle exports this component as "PrismContent", and
    # buildDashSpec() names that same type in the spec it gives to Dash's
    # ExternalWrapper. Thus the generated name "PrismContentComponent" does not
    # work here.
    _type = "PrismContent"

    def __init__(
        self,
        children: Component | list[Component] | str | int | float | None = _UNSET,
        id: str | dict[str, Any] | None = _UNSET,
        data: dict[str, Any] | None = _UNSET,
        layoutTimeout: float = _UNSET,
        **kwargs: Any,
    ):
        """Make a content host and send only the arguments that you give.

        The wrapper drops each argument that keeps the ``_UNSET`` sentinel.
        Thus the React component applies its own default to that prop, and a
        prop that you set to ``None`` stays ``None``.

        :param kwargs: More props for the generated component. The wrapper adds
            them to the explicit arguments.
        :type kwargs: Any
        """
        _locals = locals()
        explicit = {
            k: v
            for k, v in _locals.items()
            if k not in ("self", "kwargs", "_locals", "__class__") and v is not _UNSET
        }
        explicit.update(kwargs)
        super().__init__(**explicit)
