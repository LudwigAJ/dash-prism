User Guide
==========

Layouts
-------

Register layouts with the decorator:

.. code-block:: python

   @dash_prism.register_layout(
       id='dashboard',
       name='Dashboard',
       icon='BarChart3',  # Use get_available_icons() to see options
       category='Analytics',
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

.. code-block:: python

   @dash_prism.register_layout(
       id='user-profile',
       name='User Profile',
       params=[
           dash_prism.LayoutParameter(
               name='user_id',
               type='string',
               required=True,
           ),
       ]
   )
   def user_profile(user_id: str):
       return html.Div(f'Profile: {user_id}')

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

Style options: ``'default'``, ``'primary'``, ``'secondary'``, ``'success'``,
``'warning'``, ``'danger'``, or a hex color like ``'#FF5500'``.

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

Workspace State
---------------

Prism exposes two properties for reading and writing workspace state:

- ``readWorkspace`` — Output property containing the current workspace state
- ``writeWorkspace`` — Input property for programmatically updating the workspace

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

Use ``writeWorkspace`` to restore a previously saved workspace:

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
       Output('workspace', 'writeWorkspace'),
       Input('import-btn', 'n_clicks'),
       prevent_initial_call=True
   )
   def import_workspace(n_clicks):
       # Load from database, file, or external storage
       saved_workspace = load_from_storage()
       return saved_workspace

``writeWorkspace`` accepts partial updates. You can update specific fields
without replacing the entire workspace:

.. code-block:: python

   # Only update the theme
   return {'theme': 'dark'}

   # Only update favorite layouts
   return {'favoriteLayouts': ['dashboard', 'analytics']}

Server-Side Persistence Pattern
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Combine ``readWorkspace`` and ``writeWorkspace`` with Actions for server-side
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
       Output('workspace', 'writeWorkspace'),
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

   from dash_prism.utils import validate_workspace, WorkspaceValidationError

   @app.callback(
       Output('workspace', 'writeWorkspace'),
       Output('error-msg', 'children'),
       Input('import-btn', 'n_clicks'),
       prevent_initial_call=True
   )
   def import_with_validation(n_clicks):
       workspace = load_from_storage()
       try:
           validate_workspace(workspace)
           return workspace, ''
       except WorkspaceValidationError as e:
           return dash.no_update, f'Invalid workspace: {e.message}'

Configuration
-------------

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       theme='light',           # or 'dark'
       size='md',               # 'xs', 'sm', 'md', 'lg', 'xl'
       maxTabs=8,               # Max tabs per panel
       layoutTimeout=30,        # Seconds before timeout
       statusBarPosition='bottom',  # or 'top'
   )

Caveats
-------

ID Transformation (allow_multiple only)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When a layout is registered with ``allow_multiple=True``, Prism transforms
string component IDs into pattern-matching dicts to isolate each tab instance:

- ``'my-button'`` → ``{'type': 'my-button', 'index': 'tab-xyz'}``

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
