Getting Started
===============

Installation
------------

.. code-block:: bash

   pip install dash-prism

Dash Prism needs Python 3.11 or later. It also needs Dash 3.1.1 or later but
less than 4.5, and pydantic 2.10 or later but less than 3. ``pip`` installs
Dash and pydantic for you.

Prism validates the parameters of a layout with pydantic. For this reason
pydantic is a necessary dependency and not an optional extra.

| **PyPI:** https://pypi.org/project/dash-prism/
| **Repository:** https://github.com/LudwigAJ/dash-prism

Minimal Example
---------------

.. code-block:: python

   import dash_prism
   from dash import Dash, html

   app = Dash(__name__)

   # 1. Register layouts
   @dash_prism.register_layout(id='home', name='Home')
   def home_layout():
       return html.Div('Hello, Prism!')

   # 2. Add Prism to app layout
   app.layout = html.Div([
       dash_prism.Prism(id='workspace', style={'height': '100vh'})
   ])

   # 3. Initialize
   dash_prism.init('workspace', app)

   if __name__ == '__main__':
       app.run(debug=True)

The workspace opens with one empty tab that has the name ``New Tab``. With the
default props, that tab shows the layout dropdown of the search bar and a grid
of the registered layouts. The user opens ``Home`` from either one. The
``style`` prop goes to the root container of the component. As a result,
``height`` controls how much of the page the workspace fills.

The sequence of the three steps is important:

1. Each call of :func:`~dash_prism.register_layout` adds one layout to the
   process-wide registry. :func:`~dash_prism.init` reads that registry one
   time and copies the layout metadata into the component. As a result, a
   layout that you register after ``init()`` does not reach the browser.
   ``init()`` also gives a warning when the registry is empty.
2. ``app.layout`` must contain the :class:`~dash_prism.Prism` component before
   you call ``init()``. If ``app.layout`` is not set, ``init()`` raises
   :exc:`~dash_prism.InitializationError`. If the layout contains no component
   with the given ID, ``init()`` gives a warning and no component receives the
   layout metadata.
3. :func:`~dash_prism.init` registers one pattern-matching Dash callback for
   the content of a tab. The callback receives the request of a tab and calls
   the layout function with the validated parameters of that tab. Then the
   callback returns the Dash components to render.

.. note::

   Tab layouts are not part of ``app.layout`` when the application starts. As
   a result, Dash raises an exception for each callback that targets a
   component inside a tab layout. The option
   ``suppress_callback_exceptions=True`` on the ``Dash`` application prevents
   these exceptions. :func:`~dash_prism.init` writes a warning to the log when
   the option is off.

Development Installation
------------------------

A development checkout builds the JavaScript bundle and the Python component
classes from source. The project uses `Poetry <https://python-poetry.org/>`_
for the Python dependencies and `pnpm <https://pnpm.io/>`_ for the TypeScript
frontend.

.. code-block:: bash

   git clone https://github.com/LudwigAJ/dash-prism.git
   cd dash-prism
   poetry install --with dev,test,docs,demo
   pnpm install
   pnpm run build

``pnpm run build`` does two steps. Webpack bundles the TypeScript sources into
``dash_prism/dash_prism.js``. Then ``dash-generate-components`` writes the
Python component classes, such as ``PrismComponent.py``, from the React
components in ``src/ts/components``. The generated files are build output, so
do not edit them.

Or with `just <https://github.com/casey/just>`_:

.. code-block:: bash

   just install
   just build
