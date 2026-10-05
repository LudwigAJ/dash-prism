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

Each Poetry group has one purpose. The ``dev`` group holds Black, Ruff, mypy, and
the packages that the component generator needs. The ``test`` group holds pytest,
its plugins, and Selenium. The ``docs`` group holds Furo, which pulls in
Sphinx. The ``demo`` group holds numpy and pandas, which the demo app in
``examples/`` needs.

To start the demo app, run this command from the root of the repository. Then
open http://127.0.0.1:5050 in a browser.

.. code-block:: bash

   poetry run python -m examples.app

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

React StrictMode
----------------

In a development build of React, StrictMode runs each render, each state
initializer and each effect two times. A side effect in a render, or an effect
without a correct cleanup, then shows as a defect. The CI job ``Test React
StrictMode`` runs the integration tests with Prism in StrictMode. To run the
same check on your computer:

.. code-block:: bash

   pnpm run build:strict
   pnpm run test:integration:strict
   pnpm run build

``pnpm run build:strict`` writes a development bundle that wraps Prism in
``React.StrictMode``. ``pnpm run test:integration:strict`` sets
``PRISM_STRICT_MODE=1``. Then ``testutils.start_app`` makes Dash serve the
development build of React, and it makes sure that Prism runs in StrictMode.
The last command writes the release bundle again.

The release bundle does not wrap Prism in StrictMode. StrictMode also applies
to the Dash components in the tabs. Dash serves the development build of React
to an app with ``debug=True``. Thus the components of that app, for example
``dcc.Graph``, would run their effects two times and write StrictMode warnings
to the console.

Code Style
----------

- Python: `Black <https://black.readthedocs.io/>`_ with a line length of 100 and
  `Ruff <https://docs.astral.sh/ruff/>`_ for the lint rules
- TypeScript: ESLint and Prettier
- CSS: `Stylelint <https://stylelint.io/>`_ with the standard configuration

.. code-block:: bash

   # All checks: Black, Ruff, mypy, ESLint, Stylelint and the TypeScript type check
   pnpm run lint

   # Format
   pnpm run format:py
   pnpm run format

``pnpm run lint`` is the command that CI runs. ``pnpm run lint:py``, ``pnpm run
lint:js`` and ``pnpm run lint:css`` run the Python checks, ESLint and Stylelint
alone. ``just lint`` calls ``pnpm run lint``.

Ruff and Black check each Python file in the repository, except the files that
``.gitignore`` lists. ``pnpm run format:py`` sorts the imports with Ruff and then
formats the code with Black.

The ``[tool.ruff.lint]`` table in ``pyproject.toml`` selects the Ruff rules.
A comment in that table names each rule that is not yet selected. The comment
states when to select the rule. ``stylelint.config.mjs`` and
``eslint.config.mjs`` use the same kind of comment for their rules.

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
- The ``extend-exclude`` key of the ``[tool.ruff]`` table
- The ``omit`` key of the ``[tool.coverage.run]`` table
- ``GENERATED_FILES`` in ``scripts/check_wheel.py``, which CI and the release
  workflow use to check the wheel

The ``files`` key of the ``[tool.mypy]`` table names only the hand-written
modules. Thus mypy does not check the generated files.

If you add a component file whose name contains ``Prism``, the build writes one
more Python file. Add that file to each place in the list.

Python and TypeScript contracts
-------------------------------

The Python package and the TypeScript frontend exchange data in three places.
Each place has one definition on each side. For ``registeredLayouts`` and
``PrismContent.data``, a test fails when the two sides differ. No test compares
the two sides of the workspace contract.

``registeredLayouts``
   ``LayoutRegistration.to_metadata()`` in ``dash_prism/layout_registry.py``
   makes the metadata of one layout. :func:`dash_prism.init` puts the metadata
   of every layout into this prop. The ``RegisteredLayouts`` type in
   ``src/ts/types/index.ts`` describes it. ``tests/test_registry.py`` compares
   the metadata of a set of reference layouts with
   ``tests/fixtures/layout_meta.json``. ``src/ts/types/layoutMeta.test.ts``
   checks the same file against the type. To change the metadata on purpose,
   run ``PRISM_WRITE_FIXTURES=1 pytest tests/test_registry.py`` to write the
   file again. Then change the TypeScript types until ``pnpm run typecheck``
   passes.

``readWorkspace`` and ``updateWorkspace``
   Prism writes ``readWorkspace`` for Dash, and a Dash callback sets
   ``updateWorkspace`` for Prism. Both props hold the same dict. The
   ``Workspace`` interface in ``src/ts/types/index.ts`` is its shape.
   ``selectWorkspaceSnapshot`` in ``src/ts/store/selectors.ts`` makes the value
   of ``readWorkspace``, and the ``syncWorkspace`` action applies a
   ``Partial<Workspace>``. The Python side is
   :func:`dash_prism.validate_workspace` in ``dash_prism/workspace.py``, which
   checks the five required keys of a dict. The documentation of the
   ``readWorkspace`` prop in ``PrismComponent.tsx`` and in ``dash_prism/Prism.py``
   lists all the keys. When you change a key, change all three places by hand.

``PrismContent.data``
   ``buildDashSpec`` in ``src/ts/utils/dashSpec.ts`` makes the component that
   renders one tab. The tab ID is the ``index`` of its ``id``. The ``data`` prop
   holds ``layoutId``, ``layoutParams``, ``layoutOption`` and ``timeout``.
   ``_parse_content_request`` in ``dash_prism/app_init.py`` reads these fields
   in the render callback. ``src/ts/utils/dashSpec.test.ts`` and
   ``tests/test_init.py`` pin the field names.

The search bar also checks parameter input in the browser with the rules of the
server. ``tests/fixtures/param_inputs.json`` lists inputs that both sides must
accept or reject in the same way. ``tests/test_params.py`` and
``src/ts/components/SearchBar/paramValidation.test.ts`` read it.

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
