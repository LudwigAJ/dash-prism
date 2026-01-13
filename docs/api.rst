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

Registration
------------

.. autofunction:: dash_prism.register_layout

.. autofunction:: dash_prism.init

.. autoclass:: dash_prism.LayoutParameter
   :members:

.. autofunction:: dash_prism.get_layout

.. autofunction:: dash_prism.clear_registry

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
