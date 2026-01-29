Contributing
============

Setup
-----

.. code-block:: bash

   git clone https://github.com/yourusername/dash_prism.git
   cd dash_prism
   python -m venv .venv
   source .venv/bin/activate
   poetry install --with dev,test,docs,demo
   npm install
   npm run build

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

   poetry install --with docs
   cd docs
   make html