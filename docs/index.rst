Dash Prism
==========

A multi-panel workspace manager for Plotly Dash with drag-and-drop tabs,
layout registration, and persistent state.

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
