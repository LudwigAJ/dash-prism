API Reference
=============

This page documents the public API of the ``dash_prism`` package. Each name on
this page is available directly on the package, for example
``dash_prism.Prism``.

Components
----------

The three component classes are hand-written wrappers around the component
classes that ``dash-generate-components`` writes from the React sources. A
wrapper adds the documented signature and the type annotations. The wrapper
forwards only the props that you set, so a prop that you do not set keeps the
default value of the React component.

Prism
^^^^^

.. autoclass:: dash_prism.Prism
   :members:

Action
^^^^^^

.. autoclass:: dash_prism.Action
   :members:

PrismContent
^^^^^^^^^^^^

.. autoclass:: dash_prism.PrismContent
   :members:

.. data:: dash_prism.PrismAction

   An alias of :class:`dash_prism.Action`. The alias keeps the older name
   available for applications that already use it.

Registration
------------

The registration API holds the layouts that a user can open in a tab. A layout
is a Dash component tree, or a function that returns one.
:func:`dash_prism.register_layout` puts a layout into the registry, and
:func:`dash_prism.init` connects the registry to a Dash application.
:func:`dash_prism.init` reads the registry one time, thus you must register
each layout before you call ``init()``.

.. autofunction:: dash_prism.register_layout

.. autofunction:: dash_prism.init

.. autofunction:: dash_prism.get_layout

.. autofunction:: dash_prism.get_registered_layouts_metadata

.. autofunction:: dash_prism.clear_registry

.. autoclass:: dash_prism.LayoutRegistration
   :members:

.. autoclass:: dash_prism.LayoutParameter
   :members:

.. autoclass:: dash_prism.LayoutRegistry
   :members:

.. data:: dash_prism.registry

   The process-wide :class:`~dash_prism.LayoutRegistry`.
   :func:`dash_prism.register_layout` writes to it and :func:`dash_prism.init`
   reads it when it injects the layout metadata into the Prism component. Thus
   an application must use this instance and must not make a registry of its
   own.

Parameter Validation
--------------------

A layout function can take parameters. The user gives a value for each
parameter in the search bar, or a share link supplies the values. These values
arrive as strings. Prism reads the type annotations of the layout function and
builds a pydantic model from them. The model validates and coerces the values
before Prism calls the layout function. When a value is not valid, Prism raises
:class:`~dash_prism.ParamValidationError` and shows one message for each field
that failed.

.. autoclass:: dash_prism.Param
   :members:

.. autoclass:: dash_prism.ParamValidationError
   :members:

.. autoclass:: dash_prism.FieldError
   :members:

Icons
-----

A tab can show an icon. The icon names come from a selected subset of the
`lucide-react <https://lucide.dev/icons>`_ icon set. The frontend bundle
contains only this subset, thus a tab with a name that is not in the list shows
no icon. The two names that follow read the list from ``icons.json`` on the
first access, and not at import time.

.. autofunction:: dash_prism.get_available_icons

.. autodata:: dash_prism.AVAILABLE_ICONS

Utilities
---------

These functions work on a Dash component tree or on a workspace dictionary.
The first four help you to read a layout and to change it before Prism renders
the layout. :func:`dash_prism.validate_workspace` checks a workspace
dictionary that comes from a callback or from your own storage.

.. autofunction:: dash_prism.walk_layout

.. autofunction:: dash_prism.inject_tab_id

.. autofunction:: dash_prism.find_component_by_id

.. autofunction:: dash_prism.update_component_props

.. autofunction:: dash_prism.validate_workspace

Exceptions
----------

Prism raises :exc:`~dash_prism.InitializationError` from
:func:`dash_prism.init` when the setup is not correct, for example when
``app.layout`` is not set. Prism raises :exc:`~dash_prism.InvalidWorkspace`
from :func:`dash_prism.validate_workspace` when a workspace dictionary is not
coherent. The `Parameter Validation`_ section above documents
:class:`~dash_prism.ParamValidationError`.

.. autoclass:: dash_prism.InitializationError

.. autoclass:: dash_prism.InvalidWorkspace
