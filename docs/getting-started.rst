Getting Started
===============

Installation
------------

.. code-block:: bash

   pip install dash-prism

Requirements: Python 3.9+, Dash 3.1.0+

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

The order matters: register layouts → define app.layout → call init().

Development Installation
------------------------

.. code-block:: bash

   git clone https://github.com/yourusername/dash_prism.git
   cd dash_prism
   npm install && npm run build
   pip install -e .
