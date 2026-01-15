Contributing
============

Setup
-----

.. code-block:: bash

   git clone https://github.com/yourusername/dash_prism.git
   cd dash_prism
   python -m venv .venv
   source .venv/bin/activate
   npm install
   npm run build
   pip install -e ".[dev,test]"

Tests
-----

.. code-block:: bash

   pytest tests/ -v
   pytest --cov=dash_prism

Code Style
----------

- Python: Black, isort
- TypeScript: ESLint, Prettier

Building Docs
-------------

.. code-block:: bash

   pip install sphinx sphinx-rtd-theme
   cd docs
   make html


Future Improvements
-------------------

Tab Reparenting Without Remount
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Problem:** When a tab is dragged between panels, React unmounts and remounts
the content, causing Dash to refetch the layout from the server.

**Why:** React reconciles children per-parent. Moving a component to a different
parent always triggers unmount/remount—``memo`` and ``useMemo`` cannot prevent this.

**Solution:** Use `react-reverse-portal <https://www.npmjs.com/package/react-reverse-portal>`_:

.. code-block:: tsx

   import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';

   // Content lives in InPortal at WorkspaceView level - never unmounts
   <InPortal node={portalNode}>
     <DashContentRenderer tab={tab} />
   </InPortal>

   // OutPortal in each Panel - can move without unmounting content
   <TabsContent>
     <OutPortal node={portalNode} />
   </TabsContent>

Store portal nodes keyed by ``tabId`` in context. When tabs move between panels,
only the ``OutPortal`` moves—the content stays mounted and Dash callbacks keep working.
