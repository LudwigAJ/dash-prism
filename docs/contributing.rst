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
