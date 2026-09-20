Dash Prism
==========

Dash Prism is a multi-panel workspace manager for Plotly Dash. It shows each
registered Dash layout as a tab inside a panel. A user drags a tab to a panel
edge to split the workspace, and drags a tab between panels to rearrange the
workspace. Prism can also store the arrangement in the browser, so the user
returns to the same workspace on the next visit.

You build a Prism application in three steps. First, you register each layout
with :func:`~dash_prism.register_layout`. Next, you put one
:class:`~dash_prism.Prism` component in ``app.layout``. Last, you call
:func:`~dash_prism.init`. This function reads the layout registry and registers
the callback that renders the content of a tab.

.. code-block:: python

   import dash_prism
   from dash import Dash, html

   app = Dash(__name__)

   @dash_prism.register_layout(id='home', name='Home')
   def home_layout():
       return html.Div('Welcome!')

   app.layout = html.Div([
       dash_prism.Prism(id='workspace', style={'height': '100vh'})
   ])

   dash_prism.init('workspace', app)
   app.run(debug=True)

The pages that follow give the details:

* **Getting Started** tells you how to install Dash Prism and how to run a
  first application.
* **User Guide** explains layouts, layout parameters, actions, persistence,
  workspace state, and the configuration props of the component.
* **API Reference** documents each public class, function, and exception.
* **Contributing** describes the development setup, the tests, and the code
  style of the project.

.. toctree::
   :maxdepth: 2
   :caption: Contents

   getting-started
   user-guide
   api
   contributing

Indices
-------

* :ref:`genindex`
* :ref:`search`
