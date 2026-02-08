User Guide
==========

Layouts
-------

Register layouts with the decorator:

.. code-block:: python

   @dash_prism.register_layout(
       id='dashboard',
       name='Dashboard',
       description='Main analytics dashboard',
       keywords=['analytics', 'charts', 'metrics'],
   )
   def dashboard_layout():
       return html.Div([...])

Or register static content directly:

.. code-block:: python

   dash_prism.register_layout(
       id='about',
       name='About',
       layout=html.Div('About page'),
   )

Parameterized Layouts
^^^^^^^^^^^^^^^^^^^^^

Layouts can accept parameters. Prism automatically inspects function signatures:

.. code-block:: python

   @dash_prism.register_layout(id='user-profile', name='User Profile')
   def user_profile(user_id: str):
       return html.Div(f'Profile: {user_id}')

For pre-defined parameter options, use ``param_options``:

.. code-block:: python

   @dash_prism.register_layout(
       id='chart',
       name='Chart View',
       param_options={
           'bar': ('Bar Chart', {'chart_type': 'bar'}),
           'line': ('Line Chart', {'chart_type': 'line'}),
       }
   )
   def chart_layout(chart_type: str = 'bar'):
       return dcc.Graph(...)

.. note::

   Parameters passed from the Prism UI are serialized as strings. If your
   layout expects richer types (e.g., numbers or booleans), convert them
   inside the layout callback.

Async Layouts
^^^^^^^^^^^^^

.. code-block:: python

   @dash_prism.register_layout(id='async-data', name='Data')
   async def async_layout():
       data = await fetch_data()
       return html.Div(str(data))

Multiple Instances (allow_multiple)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

By default, each layout can only be open in one tab at a time. Set
``allow_multiple=True`` to allow the same layout in multiple tabs:

.. code-block:: python

   @dash_prism.register_layout(
       id='chat',
       name='Chat Room',
       allow_multiple=True,  # Can open multiple chat tabs
   )
   def chat_layout():
       return html.Div([
           html.Div(id='chat-messages'),
           dcc.Input(id='chat-input'),
           html.Button('Send', id='chat-send'),
       ])

.. warning::

   **Pattern-Matching Callbacks Required**

   When ``allow_multiple=True``, Prism automatically transforms all string
   component IDs into pattern-matching dicts to isolate each tab instance.

   Your ID ``'chat-input'`` becomes ``{'type': 'chat-input', 'index': '<tab-id>'}``

   You **must** use pattern-matching callbacks with ``MATCH``:

   .. code-block:: python

      from dash import MATCH

      # CORRECT - uses pattern matching
      @app.callback(
          Output({'type': 'chat-messages', 'index': MATCH}, 'children'),
          Input({'type': 'chat-send', 'index': MATCH}, 'n_clicks'),
          State({'type': 'chat-input', 'index': MATCH}, 'value'),
      )
      def send_message(n_clicks, text):
          return f'You said: {text}'

      # WRONG - will not work with allow_multiple=True
      @app.callback(
          Output('chat-messages', 'children'),  # String ID won't match
          Input('chat-send', 'n_clicks'),
      )
      def send_message(n_clicks): ...

   If your layout uses ``allow_multiple=False`` (default), you can use
   regular string IDs in callbacks since only one instance exists.

Actions
-------

Add buttons to the status bar:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       actions=[
           dash_prism.Action(
               id='save-btn',
               label='Save',
               icon='Rocket',
               tooltip='Save workspace',
           ),
       ],
   )

Handle clicks with callbacks:

.. code-block:: python

   @app.callback(
       Output('save-btn', 'loading'),
       Input('save-btn', 'n_clicks'),
       prevent_initial_call=True
   )
   def handle_save(n_clicks):
       # Do work...
       return False  # Stop loading spinner

Variant options (``variant`` parameter): ``'default'``, ``'primary'``,
``'secondary'``, ``'success'``, ``'warning'``, ``'danger'``, or a hex color
like ``'#FF5500'``.

Icons
-----

Use ``get_available_icons()`` to see all available icon names:

.. code-block:: python

   import dash_prism

   for icon in dash_prism.get_available_icons():
       print(icon)

   # Check if an icon exists
   if 'Rocket' in dash_prism.AVAILABLE_ICONS:
       print('Available!')

Persistence
-----------

Enable workspace persistence:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       persistence=True,
       persistence_type='local',  # 'local', 'session', or 'memory'
   )

- ``'local'`` — Persists across browser sessions (localStorage)
- ``'session'`` — Persists for current tab only (sessionStorage)
- ``'memory'`` — No persistence

Initial Layout
--------------

Set a default layout to display in the first tab on initial page load:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       initialLayout='dashboard',  # Must match a registered layout ID
   )

The specified layout will load automatically when users first visit the page.

.. note::

   If ``persistence`` is enabled and a saved workspace exists, the persisted
   state takes precedence over ``initialLayout``. The initial layout only
   applies on the very first visit before any workspace is saved.

Example with persistence:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       initialLayout='dashboard',
       persistence=True,
       persistence_type='local',
   )
   # First visit: shows 'dashboard' layout
   # Subsequent visits: restores user's saved workspace

Workspace State
---------------

Prism exposes two properties for reading and writing workspace state:

- ``readWorkspace`` — Read-only property containing the current workspace state (use as ``Input`` or ``State`` in callbacks)
- ``updateWorkspace`` — Write-only property for programmatically updating the workspace (use as ``Output`` in callbacks)

Reading State with Actions
^^^^^^^^^^^^^^^^^^^^^^^^^^

Use an Action to trigger reading the workspace. The Action provides the
``Input`` while ``readWorkspace`` is accessed via ``State``:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       actions=[
           dash_prism.Action(
               id='export-btn',
               label='Export',
               icon='Download',
               tooltip='Export workspace layout',
           ),
       ],
   )

   @app.callback(
       Output('export-btn', 'loading'),
       Input('export-btn', 'n_clicks'),
       State('workspace', 'readWorkspace'),
       prevent_initial_call=True
   )
   def export_workspace(n_clicks, workspace):
       if workspace:
           # Save to database, file, or external storage
           save_to_storage(workspace)
       return False

Writing State with Actions
^^^^^^^^^^^^^^^^^^^^^^^^^^

Use ``updateWorkspace`` to restore a previously saved workspace:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       actions=[
           dash_prism.Action(
               id='import-btn',
               label='Import',
               icon='Upload',
               tooltip='Import workspace layout',
           ),
       ],
   )

   @app.callback(
       Output('workspace', 'updateWorkspace'),
       Input('import-btn', 'n_clicks'),
       prevent_initial_call=True
   )
   def import_workspace(n_clicks):
       # Load from database, file, or external storage
       saved_workspace = load_from_storage()
       return saved_workspace

``updateWorkspace`` accepts partial updates. You can update specific fields
without replacing the entire workspace:

.. code-block:: python

   # Only update the theme
   return {'theme': 'dark'}

   # Only update favorite layouts
   return {'favoriteLayouts': ['dashboard', 'analytics']}

Server-Side Persistence Pattern
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Combine ``readWorkspace`` and ``updateWorkspace`` with Actions for server-side
persistence (useful when users access their workspace from multiple devices):

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       actions=[
           dash_prism.Action(id='save-btn', label='Save', icon='Save'),
           dash_prism.Action(id='load-btn', label='Load', icon='FolderOpen'),
       ],
   )

   @app.callback(
       Output('save-btn', 'loading'),
       Input('save-btn', 'n_clicks'),
       State('workspace', 'readWorkspace'),
       prevent_initial_call=True
   )
   def save_to_server(n_clicks, workspace):
       # Save workspace to database keyed by user ID
       db.save_workspace(current_user.id, workspace)
       return False

   @app.callback(
       Output('workspace', 'updateWorkspace'),
       Input('load-btn', 'n_clicks'),
       prevent_initial_call=True
   )
   def load_from_server(n_clicks):
       # Restore workspace from database
       return db.load_workspace(current_user.id)

Validating Workspace Data
^^^^^^^^^^^^^^^^^^^^^^^^^

Use ``validate_workspace`` to check workspace data before writing:

.. code-block:: python

   from dash_prism.utils import validate_workspace, InvalidWorkspace

   @app.callback(
       Output('workspace', 'updateWorkspace'),
       Output('error-msg', 'children'),
       Input('import-btn', 'n_clicks'),
       prevent_initial_call=True
   )
   def import_with_validation(n_clicks):
       workspace = load_from_storage()
       try:
           validate_workspace(workspace)
           return workspace, ''
       except InvalidWorkspace as e:
           return dash.no_update, f'Invalid workspace: {e.errors}'

Configuration
-------------

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       theme='light',           # or 'dark'
       size='md',               # 'sm', 'md', 'lg'
       maxTabs=16,              # Max tabs globally (< 1 = unlimited)
       layoutTimeout=30,        # Seconds before timeout
       statusBarPosition='bottom',  # or 'top'
   )

Tab Limits
^^^^^^^^^^

The ``maxTabs`` parameter controls the maximum number of tabs allowed in
the entire workspace. This is a **global** limit, not per-panel.

- Default: ``16``
- Set to ``0`` (or any value less than ``1``) for unlimited tabs
- When the limit is reached, new tab actions are blocked with a console warning

Caveats
-------

Callback Exceptions
^^^^^^^^^^^^^^^^^^^

If your layouts contain components with callbacks, you should set
``suppress_callback_exceptions=True`` on your Dash app:

.. code-block:: python

   app = Dash(__name__, suppress_callback_exceptions=True)

**Why?** Components inside tab layouts don't exist in ``app.layout`` at
startup — they are created dynamically when a user opens a tab. Dash
validates callback IDs against the layout at registration time, so callbacks
referencing those components will raise an exception.

.. code-block:: python

   # This layout has a Dropdown and Graph inside a tab:
   @dash_prism.register_layout(id='analytics', name='Analytics')
   def analytics():
       return html.Div([
           dcc.Dropdown(id='metric', options=['revenue', 'users']),
           dcc.Graph(id='chart'),
       ])

   # This callback will FAIL at startup without suppress_callback_exceptions
   # because 'metric' and 'chart' don't exist in app.layout yet.
   @app.callback(Output('chart', 'figure'), Input('metric', 'value'))
   def update_chart(metric):
       return px.line(df, y=metric)

**When is it not needed?** If all your layouts are purely static (no
callbacks targeting components inside tabs), or if you exclusively use
pattern-matching IDs (dict-style) for those components, you can skip it.

.. note::

   ``init()`` logs a warning if ``suppress_callback_exceptions`` is
   ``False`` to help catch this early.

ID Transformation (allow_multiple only)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When a layout is registered with ``allow_multiple=True``, Prism transforms
string component IDs into pattern-matching dicts to isolate each tab instance:

- ``'my-button'`` -> ``{'type': 'my-button', 'index': 'tab-xyz'}``

This transformation happens automatically via ``inject_tab_id()`` and only
applies to layouts that allow multiple instances. Components that already
have dict IDs are left unchanged.

**Layouts with ``allow_multiple=False`` (the default) are rendered as-is.**
You can use regular string IDs in callbacks without any transformation.

Callback Patterns for allow_multiple
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

For layouts with ``allow_multiple=True``, use pattern-matching callbacks:

.. code-block:: python

   from dash import MATCH, ALL, ctx

   # Match specific tab instance
   @app.callback(
       Output({'type': 'output', 'index': MATCH}, 'children'),
       Input({'type': 'button', 'index': MATCH}, 'n_clicks'),
   )
   def handle(n): ...

   # Match all instances (use carefully)
   @app.callback(
       Output('global-state', 'data'),
       Input({'type': 'button', 'index': ALL}, 'n_clicks'),
   )
   def handle_all(clicks): ...

Registration Order
^^^^^^^^^^^^^^^^^^

Layouts must be registered **before** calling ``init()``:

.. code-block:: python

   # 1. Register first
   @dash_prism.register_layout(...)
   def my_layout(): ...

   # 2. Then app.layout
   app.layout = html.Div([dash_prism.Prism(...)])

   # 3. Finally init
   dash_prism.init('workspace', app)

Initialization (``dash_prism.init``)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``init()`` function connects Prism to your Dash application and is **required** for Prism to function. It performs three critical tasks:

1. **Injects layout metadata** into the Prism component so the UI knows which layouts are available
2. **Injects server session ID** to invalidate stale persisted workspaces after server restarts
3. **Creates callbacks** to render tab contents dynamically

.. code-block:: python

   dash_prism.init('workspace', app)

Static vs Callable Layouts
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Prism supports both **static** and **callable** ``app.layout`` configurations:

**Static Layout (Recommended)**

.. code-block:: python

   # Define layout as a static component tree
   app.layout = html.Div([
       dash_prism.Prism(id='workspace')
   ])

   dash_prism.init('workspace', app)

This is the **recommended approach** because:

- Better performance (no function call overhead on every page load)
- Simpler to reason about
- Metadata is injected once during initialization

**Callable Layout (Supported)**

.. code-block:: python

   # Define layout as a function that returns a component tree
   def layout():
       return html.Div([
           dash_prism.Prism(id='workspace')
       ])

   app.layout = layout
   dash_prism.init('workspace', app)

Callable layouts are useful for:

- User-specific layouts (reading request context)
- Conditional layout generation
- Compatibility with existing Dash apps

.. note::

   When using callable layouts, ``init()`` automatically wraps your layout function
   to inject Prism metadata on every render. This adds minimal overhead (~1ms) but
   ensures metadata stays synchronized even when the layout is regenerated.

.. warning::

   **Async callable layouts** are supported but require ``app = Dash(__name__, use_async=True)``.
   The wrapping behavior is the same, but the wrapper preserves the async nature of your function.
