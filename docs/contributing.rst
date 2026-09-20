Contributing
============

Setup
-----

Dash Prism has two parts. The Python package in ``dash_prism/`` holds the
registry, the initialization code, and the component wrappers. The TypeScript
sources in ``src/ts/`` hold the React workspace that runs in the browser. The
project uses `Poetry <https://python-poetry.org/>`_ for the Python dependencies
and `pnpm <https://pnpm.io/>`_ for the frontend.

.. code-block:: bash

   git clone https://github.com/LudwigAJ/dash-prism.git
   cd dash-prism
   poetry install --with dev,test,docs,demo
   pnpm install
   pnpm run build

The last command is not optional. ``pnpm run build`` writes the JavaScript
bundle and the generated Python component classes into the ``dash_prism``
package. You cannot import ``dash_prism`` until those files exist.

Each Poetry group has one purpose. The ``dev`` group holds Black, mypy, and the
packages that the component generator needs. The ``test`` group holds pytest,
its plugins, and Selenium. The ``docs`` group holds Furo, which pulls in
Sphinx. The ``demo`` group holds numpy and pandas, which the ``usage.py`` demo
application needs.

If `just <https://github.com/casey/just>`_ is installed, ``just install &&
just build`` does the same work as the last three commands.

Tests
-----

The project has TypeScript tests in Vitest and Python tests in pytest. The
Python tests are in two groups. The unit tests run in the process and need no
browser. The integration tests in ``tests/integration/`` start a Dash server
and drive Chrome through Selenium, thus chromedriver is necessary for them.

.. code-block:: bash

   # TypeScript tests
   pnpm run test:ts

   # Python unit tests (no browser required)
   pnpm run test:unit

   # Selenium integration tests (requires chromedriver)
   pnpm run test:integration

   # All Python tests: unit and integration
   pnpm run test

Or with ``just``:

.. code-block:: bash

   just test-ts            # TypeScript only
   just test-py            # Python unit only
   just test-integration   # Selenium integration
   just test               # All of the above

``pnpm run test`` runs the Python tests only. ``just test`` is the one recipe
that runs the TypeScript tests and the Python tests together.

Code Style
----------

- Python: `Black <https://black.readthedocs.io/>`_ with a line length of 100
- TypeScript: ESLint and Prettier

.. code-block:: bash

   # Python
   black dash_prism tests
   mypy

   # TypeScript
   pnpm run lint
   pnpm run format

``mypy`` needs no path on the command line. The ``files`` key in the
``[tool.mypy]`` table of ``pyproject.toml`` names the modules that mypy checks.
Both that list and the Black configuration leave out the generated component
files, because those files change on every build. ``just lint`` does the
TypeScript type check, the Black check, and mypy in one command.

Documentation
-------------

The documentation is Sphinx source in ``docs/``. The ``autodoc`` extension
reads the docstrings of the package. Thus the API pages come from the code and
not from a second copy of the text.

.. code-block:: bash

   poetry install --with docs
   cd docs
   make html

``make html`` writes the site to ``docs/_build/html``. ``docs/conf.py`` reads
the release number from ``pyproject.toml`` when the checkout is present, and
from the installed package metadata when it is not. As a result, you do not
update a version number in the documentation by hand.
