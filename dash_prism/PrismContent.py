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

from dash_prism import _component_base
from dash_prism.PrismContentComponent import PrismContentComponent


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
        ``layoutId``, ``layoutParams``, ``layoutOption`` and ``timeout``
        (seconds, mirrors ``layoutTimeout``). The tab ID is not in ``data``. The
        callback reads the tab ID from the ``index`` of ``id``. The callback
        stops if the ``index`` is empty or if ``layoutId`` is empty.
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
        children: Component | list[Component] | str | int | float | None = _component_base.UNSET,
        id: str | dict[str, Any] | None = _component_base.UNSET,
        data: dict[str, Any] | None = _component_base.UNSET,
        layoutTimeout: float = _component_base.UNSET,
        **kwargs: Any,
    ):
        """Make a content host and send only the arguments that you give.

        The wrapper drops each argument that keeps the ``UNSET`` sentinel.
        Thus the React component applies its own default to that prop, and a
        prop that you set to ``None`` stays ``None``.

        :param kwargs: More props for the generated component. The wrapper adds
            them to the explicit arguments.
        :type kwargs: Any
        """
        super().__init__(**_component_base.explicit_props(locals()))
