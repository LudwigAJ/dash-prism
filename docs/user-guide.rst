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

Component IDs Inside Tabs
^^^^^^^^^^^^^^^^^^^^^^^^^

Prism always rewrites every string component ID inside a tab's layout into a
pattern-matching dict, ``{'type': <your id>, 'index': <tab id>}``, so that the
same layout can be rendered in several tabs without ID collisions. This happens
for every layout, whether or not ``allow_multiple`` is set. Consequently a
callback that targets a plain string ID (``Output('chat-messages', 'children')``)
never matches a component rendered inside a tab. Use ``MATCH`` (or ``ALL``)
pattern-matching callbacks for anything inside a tab, or give a component an
explicit dict ID yourself (``id={'type': 'settings-theme', 'index': 'global'}``),
which Prism leaves untouched, when you need a fixed index. Components in
non-``children`` props (for example a ``label`` holding a component) are not
rewritten.

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

   As described above, Prism rewrites string component IDs into
   pattern-matching dicts for every tab, so with several instances of the same
   layout open each tab gets its own ``index``.

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

      # WRONG - never fires for components inside a tab
      @app.callback(
          Output('chat-messages', 'children'),  # String ID won't match
          Input('chat-send', 'n_clicks'),
      )
      def send_message(n_clicks): ...

   This applies with ``allow_multiple=False`` too: the IDs are rewritten either
   way, the flag only controls how many tabs may show the layout at once.

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

Tab Icons
---------

Use ``get_available_icons()`` to see all icon names available for tab icons:

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

``persistence`` is the on/off switch and ``persistence_type`` only chooses the
storage when it is on. With ``persistence=False`` (the default) nothing is written
to the browser, whatever ``persistence_type`` says. Because ``persistence_type``
defaults to ``'memory'``, ``persistence=True`` on its own persists nothing and
emits a ``UserWarning``; always set both.

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

``readWorkspace`` is a dict with the keys ``tabs``, ``panel``, ``panelTabs`` (the
tab order within each panel), ``activeTabIds``, ``activePanelId``,
``favoriteLayouts`` and ``searchBarsHidden``. It is refreshed at most every
500 ms. ``updateWorkspace`` accepts the same keys; missing keys keep their current
value, each tab's ``panelId`` decides which panel it belongs to, and the order in
``panelTabs`` is preserved.

.. warning::

   Wiring ``Input('workspace', 'readWorkspace')`` straight into
   ``Output('workspace', 'updateWorkspace')`` is a wasted round trip: Prism skips
   a sync whose workspace is unchanged, so a plain echo stops after one pass. A
   callback that returns a *different* workspace on every pass, however,
   ping-pongs with Prism every 500 ms.

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

   # Only update favorite layouts
   return {'favoriteLayouts': ['dashboard', 'analytics']}

   # Only update which panel is active
   return {'activePanelId': 'panel-abc'}

Server-Side Persistence Pattern
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Combine ``readWorkspace`` and ``updateWorkspace`` with Actions for server-side
persistence (useful when users access their workspace from multiple devices):

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       actions=[
           dash_prism.Action(id='save-btn', label='Save'),
           dash_prism.Action(id='load-btn', label='Load'),
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

Layout Timeout
^^^^^^^^^^^^^^

``layoutTimeout`` (seconds, default ``30``) bounds how long a tab waits for its
layout. The browser shows a timeout card when the content has not arrived in
time, and the render callback stops waiting for a layout callback that runs
longer than this and renders an error tab instead. The server-side limit
covers ``async`` layout callbacks in every app and synchronous callbacks in
apps created with ``use_async=True``; a synchronous callback in a synchronous
app runs to completion regardless.

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

ID Transformation
^^^^^^^^^^^^^^^^^

Prism rewrites string component IDs inside a tab's layout into pattern-matching
dicts so each tab instance stays isolated:

- ``'my-button'`` -> ``{'type': 'my-button', 'index': 'tab-xyz'}``

This happens automatically via ``inject_tab_id()`` for **every** layout,
whatever ``allow_multiple`` is set to. Components that already have dict IDs are
left unchanged. See `Component IDs Inside Tabs`_ for what that means for your
callbacks.

Callback Patterns for Tab Content
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

For any component rendered inside a tab, use pattern-matching callbacks:

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
2. **Injects a server session fingerprint** (``serverSessionId``, derived from the registered
   layout IDs) that is stored with persisted workspaces, so tabs whose layouts were removed
   are closed on the next load instead of showing an error
3. **Creates callbacks** to render tab contents dynamically

.. code-block:: python

   dash_prism.init('workspace', app)

.. versionchanged:: 1.0.0
   The module-level ``dash_prism.SERVER_SESSION_ID`` constant (a new random
   value per process) was removed. ``init()`` now derives ``serverSessionId``
   from the registered layout IDs, so it is identical across workers and
   restarts; pass ``serverSessionId=...`` to ``Prism`` to override it.

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

Background Callbacks
~~~~~~~~~~~~~~~~~~~~

If your layout callbacks are expensive (e.g. loading large datasets or running
computations), you can offload them to a background process using Dash's
`Background Callback Manager <https://dash.plotly.com/background-callbacks>`_.

Pass ``background=True`` to ``init()`` to enable this:

.. code-block:: python

   from dash import Dash, DiskcacheManager
   import diskcache

   cache = diskcache.Cache("./cache")
   background_callback_manager = DiskcacheManager(cache)

   app = Dash(
       __name__,
       background_callback_manager=background_callback_manager,
   )

   # Register layouts as usual ...

   dash_prism.init('workspace', app, background=True)

This registers Prism's tab rendering callback with ``background=True``, so Dash
executes it in a separate worker process (DiskCache) or on a task queue (Celery)
instead of blocking the main server thread.
