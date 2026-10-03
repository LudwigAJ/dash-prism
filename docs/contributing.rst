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

The ``.nvmrc`` file names the Node.js version that CI uses.

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
   just test-unit          # Python unit only
   just test-integration   # Selenium integration
   just test               # All of the above

``pnpm run test`` runs the Python tests only. ``just test`` is the one recipe
that runs the TypeScript tests and the Python tests together.

The scripts in ``package.json`` hold the one definition of each test command.
The ``just`` recipes and the CI workflow call the same scripts. Thus a local run
and a CI run use the same options. ``pnpm run test`` and ``pnpm run
test:integration`` run the tests in parallel with pytest-xdist and keep the
tests of one file in one worker. They run a failed test again, two times at
most, because a Selenium drag-and-drop test can fail when the code has no
defect.

Each pytest run writes a coverage report to ``htmlcov/``. The ``addopts`` key in
the ``[tool.pytest.ini_options]`` table of ``pyproject.toml`` sets the coverage
options. ``pnpm run test:ts:coverage`` writes the Vitest coverage report. That
report includes the ``.tsx`` files, but the Vitest tests do not render
components. Thus the figure for the components is low.

Code Style
----------

- Python: `Black <https://black.readthedocs.io/>`_ with a line length of 100
- TypeScript: ESLint and Prettier

.. code-block:: bash

   # All checks: Black, mypy, ESLint and the TypeScript type check
   pnpm run lint

   # Format
   pnpm run format:py
   pnpm run format

``pnpm run lint`` is the command that CI runs. ``pnpm run lint:py`` and ``pnpm
run lint:js`` run the Python checks and ESLint alone. ``just lint`` calls ``pnpm
run lint``.

``mypy`` needs no path on the command line. The ``files`` key in the
``[tool.mypy]`` table of ``pyproject.toml`` names the modules that mypy checks.

Generated files
---------------

The build writes four Python files: ``PrismComponent.py``,
``PrismActionComponent.py``, ``PrismContentComponent.py`` and ``_imports_.py``.
Each tool must know these files. Each tool reads its own configuration. Thus the
list of these files is in more than one place:

- ``.gitignore``
- The ``extend-exclude`` key of the ``[tool.black]`` table in ``pyproject.toml``
- The ``omit`` key of the ``[tool.coverage.run]`` table
- ``GENERATED_FILES`` in ``scripts/check_wheel.py``, which CI and the release
  workflow use to check the wheel

The ``files`` key of the ``[tool.mypy]`` table names only the hand-written
modules. Thus mypy does not check the generated files.

If you add a component file whose name contains ``Prism``, the build writes one
more Python file. Add that file to each place in the list.

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
