API Reference
=============

Components
----------

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

   Backwards-compatible alias of :class:`dash_prism.Action`.

Registration
------------

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
   reads it when injecting layout metadata into the Prism component, so an
   application uses this instance rather than creating its own.

Parameter Validation
--------------------

.. autoclass:: dash_prism.Param
   :members:

.. autoclass:: dash_prism.ParamValidationError
   :members:

.. autoclass:: dash_prism.FieldError
   :members:

.. autofunction:: dash_prism.has_pydantic

Icons
-----

.. autofunction:: dash_prism.get_available_icons

.. autodata:: dash_prism.AVAILABLE_ICONS

Utilities
---------

.. autofunction:: dash_prism.walk_layout

.. autofunction:: dash_prism.inject_tab_id

.. autofunction:: dash_prism.find_component_by_id

.. autofunction:: dash_prism.update_component_props

.. autofunction:: dash_prism.validate_workspace

Exceptions
----------

.. autoclass:: dash_prism.InitializationError

.. autoclass:: dash_prism.InvalidWorkspace
