Contributing
============

Setup
-----

Dash Prism uses `Poetry <https://python-poetry.org/>`_ for Python dependency
management and `pnpm <https://pnpm.io/>`_ for the TypeScript frontend.

.. code-block:: bash

   git clone https://github.com/LudwigAJ/dash-prism.git
   cd dash-prism
   poetry install --with dev,test,docs,demo
   pnpm install
   pnpm run build

If `just <https://github.com/casey/just>`_ is installed you can run
``just install && just build`` instead.

Tests
-----

The project has both TypeScript (Vitest) and Python (pytest) tests:

.. code-block:: bash

   # TypeScript tests
   pnpm run test:ts

   # Python unit tests (no browser required)
   pnpm run test:unit

   # Selenium integration tests (requires chromedriver)
   pnpm run test:integration

   # All tests
   pnpm run test

Or with ``just``:

.. code-block:: bash

   just test-ts            # TypeScript only
   just test-py            # Python unit only
   just test-integration   # Selenium integration
   just test               # All of the above

Code Style
----------

- Python: `Black <https://black.readthedocs.io/>`_ (line-length 100)
- TypeScript: ESLint, Prettier

.. code-block:: bash

   # Python
   black dash_prism tests
   mypy

   # TypeScript
   pnpm run lint
   pnpm run format

Building Docs
-------------

.. code-block:: bash

   poetry install --with docs
   cd docs
   make html
