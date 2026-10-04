User Guide
==========

Layouts
-------

A layout is the content that Prism renders in a tab. You register each layout
with :func:`dash_prism.register_layout`. Prism then shows the layout in the
search bar and in the layout grid of an empty tab. A search query matches the
layout ID, the name, the description and the keywords.

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

Each ``id`` must be unique. A second registration of the same ``id`` raises
``ValueError``. The ``name`` defaults to the ``id`` when you do not give one.
Register every layout before you call :func:`dash_prism.init`, because
``init()`` reads the registry one time and sends the result to the browser.

Parameterized Layouts
^^^^^^^^^^^^^^^^^^^^^

Layouts can accept parameters. Prism automatically inspects function signatures:

.. code-block:: python

   @dash_prism.register_layout(id='user-profile', name='User Profile')
   def user_profile(user_id: str):
       return html.Div(f'Profile: {user_id}')

The user enters a value for each parameter in the search bar, and Prism gives
the values to the function as keyword arguments. A parameter with no default
value is necessary, so the search bar asks for it before it opens the tab. A
parameter with a default value is optional.

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

Each key of ``param_options`` is the ID of one preset. Each value is a tuple of
the label to show and the parameters to apply. The search bar then shows the
labels and does not ask for the parameters one at a time. ``param_options``
works only with a callback layout. A static ``layout=...`` registration with
``param_options`` raises ``ValueError``.

Typed Parameters
^^^^^^^^^^^^^^^^

Parameters that a user types in the search bar travel as strings, and so do the
parameters in a share link. Prism validates each value and changes it to the
declared type **before** it calls your layout function. The type hints of the
function tell Prism what to do. Prism supports three styles:

.. code-block:: python

   from typing import Annotated, Literal
   from dash_prism import Param

   # 1. Plain type hints with defaults: str, int, float, bool, Optional[...],
   #    list[...], Literal[...] and Enum are coerced. Untyped params stay strings.
   @dash_prism.register_layout(id='country', name='Country', allow_multiple=True)
   def country_layout(country: str, n: int = 10, log_scale: bool = False):
       ...

   # 2. Annotated metadata: dash_prism.Param (no dependency) or pydantic.Field
   @dash_prism.register_layout(id='chart', name='Chart')
   def chart_layout(
       chart_type: Literal['bar', 'line'] = 'bar',
       n: Annotated[int, Param(ge=1, le=100, description='Rows to plot')] = 20,
   ):
       ...

   # 3. A single pydantic BaseModel parameter (requires pydantic v2)
   class ChartParams(BaseModel):
       chart_type: Literal['bar', 'line'] = 'bar'
       n: int = Field(20, ge=1, le=100)

   @dash_prism.register_layout(id='chart-model', name='Chart (model)')
   def chart_model_layout(params: ChartParams):
       ...

A parameter with no type hint keeps its string value. A parameter with a type
that pydantic cannot turn into a schema, such as a ``DataFrame``, also keeps its
string value.

In the search bar, the user types a list as comma-separated values (``a, b, c``)
or as a JSON array (``["a", "b"]``). To give an ``Optional`` parameter the value
``None``, the user types ``none`` or ``null``. If the user leaves the input
empty, Prism leaves out a parameter that has a default value, and the function
uses that default.

The search bar marks an invalid value next to the field, and it does not make
the tab. The browser does the same check on the parameters of a share link. If
invalid parameters reach the server, the tab body shows an "Invalid parameters"
panel. The panel names each field that failed, with the message and the value
that arrived. The panel shows no traceback. Prism sends each ``param_options``
preset through the same validator at registration, so a bad preset raises
``ValueError`` at import time.

Prism builds this validation on pydantic v2, which is a dependency of the
package. Thus ``pydantic.Field`` metadata and ``BaseModel`` parameters are always
available.

Async Layouts
^^^^^^^^^^^^^

A layout callback can be a coroutine function. In an app with
``use_async=True``, Prism awaits the coroutine in the async render callback. In
a synchronous app, Prism runs the coroutine with ``asyncio.run()``, and
``init()`` emits a ``UserWarning`` about the mixture.

.. code-block:: python

   @dash_prism.register_layout(id='async-data', name='Data')
   async def async_layout():
       data = await fetch_data()
       return html.Div(str(data))

Component IDs Inside Tabs
^^^^^^^^^^^^^^^^^^^^^^^^^

Prism always rewrites every string component ID inside a tab's layout into a
pattern-matching dict, ``{'type': <your id>, 'index': <tab id>}``. Prism can
thus show one layout in more than one tab with no ID collisions. The rewrite
happens for every layout, whether or not ``allow_multiple`` is set.

As a result, a callback that targets a plain string ID
(``Output('chat-messages', 'children')``) never matches a component inside a
tab. Use ``MATCH`` (or ``ALL``) pattern-matching callbacks for the content of a
tab. As an alternative, give the component an explicit dict ID yourself
(``id={'type': 'settings-theme', 'index': 'global'}``), which Prism leaves
untouched, when you need a fixed index.

Prism walks only the ``children`` of each component. Thus a component that sits
in a different prop keeps its string ID. A ``label`` prop that holds a component
is one example.

Multiple Instances (allow_multiple)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

By default, each layout can be open in one tab only. Set
``allow_multiple=True`` to let the same layout open in more than one tab:

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

   **Pattern-Matching Callbacks Are Necessary**

   Prism rewrites string component IDs into pattern-matching dicts for every
   tab. Each tab thus gets its own ``index``, also when more than one tab shows
   the same layout.

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
          Output('chat-messages', 'children'),  # A string ID does not match
          Input('chat-send', 'n_clicks'),
      )
      def send_message(n_clicks): ...

   This applies with ``allow_multiple=False`` too. Prism rewrites the IDs
   either way. The flag only controls how many tabs can show the layout at the
   same time.

Actions
-------

An action is a button in the status bar. Prism puts the actions at the right
end of the bar, before the last-updated time. Each action is a different Dash
component with its own ``n_clicks``, so each button gets its own callback.

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

An action has a ``label`` (the text on the button), a ``tooltip``, a
``variant``, and the ``disabled`` and ``loading`` flags. The ``loading`` flag
shows a spinner and disables the button. A callback can set the flag to ``True``
when a long task starts, and to ``False`` when the task ends. ``tooltip``
defaults to ``"Click to trigger {label}"``.

Variant options (``variant`` parameter): ``'default'``, ``'primary'``,
``'secondary'``, ``'success'``, ``'warning'``, ``'danger'``, or a hex color
like ``'#FF5500'``.

Tab Icons
---------

A tab can show a small icon to the left of its name. To add or change the icon
of a tab, right-click the tab and select **Add Icon** or **Change Icon**. The
icons come from a selected group of the `lucide-react
<https://lucide.dev/icons>`_ icons.

Use ``get_available_icons()`` to see all icon names available for tab icons:

.. code-block:: python

   import dash_prism

   for icon in dash_prism.get_available_icons():
       print(icon)

   # Check if an icon exists
   if 'Rocket' in dash_prism.AVAILABLE_ICONS:
       print('Available!')

An icon name is case-sensitive and starts with an uppercase letter. Each tab in
``readWorkspace`` carries its icon name in the ``icon`` key. A callback can thus
read the icon of a tab, and can set a new icon through ``updateWorkspace``. A
tab with an icon name that Prism does not know shows no icon.

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

``persistence`` is the on/off switch, and ``persistence_type`` selects the
storage only while the switch is on. With ``persistence=False`` (the default),
Prism writes nothing to the browser, whatever ``persistence_type`` says.
``persistence_type`` defaults to ``'memory'``, so ``persistence=True`` on its
own persists nothing and emits a ``UserWarning``. Always set the two props
together.

``id``, ``persistence`` and ``persistence_type`` together select the storage key
and the storage engine. Prism reads the three props one time, when the component
mounts (``persistence=False`` resolves to ``'memory'``, which is why it counts).
A change to any of the three from a callback mounts the workspace again. Prism
then loads the state that it saved under the new key, or makes a fresh
workspace, and the undo history starts again. You can change every other prop at
any time with no loss of state.

Initial Layout
--------------

Set the layout that Prism opens in the first tab when a user loads the page:

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       initialLayout='dashboard',  # Must match a registered layout ID
   )

The ID must belong to a layout that you registered before you call ``init()``.
If the ID is not in the registry, ``init()`` raises
:exc:`dash_prism.InitializationError` and names the layouts that are available.

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

Prism gives two props for the workspace state:

- ``readWorkspace`` — A read-only prop that holds the current workspace state. Use it as an ``Input`` or a ``State`` in a callback.
- ``updateWorkspace`` — A write-only prop that pushes a new workspace into Prism. Use it as an ``Output`` in a callback.

``readWorkspace`` is a dict with the keys ``tabs``, ``panel``, ``panelTabs`` (the
tab order in each panel), ``activeTabIds``, ``activePanelId``,
``favoriteLayouts`` and ``searchBarsHidden``. Prism sends the first workspace
immediately. After that, Prism waits 500 ms after the last change, and then
sends the workspace again. Prism sends nothing when the new workspace is the
same as the one that it sent before.

``updateWorkspace`` accepts the same keys. A key that you leave out keeps its
current value. Prism then heals the result in three ways:

- Each tab's ``panelId`` decides which panel holds the tab.
- Prism keeps the tab order that ``panelTabs`` gives for each panel.
- Prism drops a tab whose panel is not a leaf of the panel tree.

.. warning::

   A callback from ``Input('workspace', 'readWorkspace')`` straight into
   ``Output('workspace', 'updateWorkspace')`` is a wasted round trip. Prism
   skips a sync when the workspace does not change, so a plain echo stops after
   one pass. But a callback that returns a *different* workspace on every pass
   goes back and forward with Prism every 500 ms.

Reading State with Actions
^^^^^^^^^^^^^^^^^^^^^^^^^^

Use an Action to start a read of the workspace. The Action gives the ``Input``,
and ``readWorkspace`` comes in through a ``State``:

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

``updateWorkspace`` accepts partial updates. You can change one field or a few
fields, and let Prism keep the rest of the workspace:

.. code-block:: python

   # Only update favorite layouts
   return {'favoriteLayouts': ['dashboard', 'analytics']}

   # Only update which panel is active
   return {'activePanelId': 'panel-abc'}

Server-Side Persistence Pattern
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Use ``readWorkspace`` and ``updateWorkspace`` together with Actions to keep the
workspace on the server. This pattern helps when your users open their workspace
from more than one device. The browser storage of one device does not reach the
other devices.

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

Use ``validate_workspace`` to check workspace data before you write it:

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

``validate_workspace`` first checks that the workspace holds the five keys
``tabs``, ``panel``, ``panelTabs``, ``activeTabIds`` and ``activePanelId``, each
with the correct type. It then walks the panel tree: each node must have an
``id``, and a node with children must have a ``direction`` of ``'horizontal'``
or ``'vertical'``. Last, it checks that the keys agree with each other:

- Each tab in ``tabs`` is in one ``panelTabs`` list only.
- Each tab ID in ``panelTabs`` is also in ``tabs``.
- Each key of ``panelTabs`` is a leaf panel, and each leaf panel has a key.
- ``activePanelId`` names a leaf panel.
- Each entry in ``activeTabIds`` names a panel in ``panelTabs`` and a tab that
  is in that panel.

The function raises :exc:`dash_prism.InvalidWorkspace` with one message for each
problem in ``e.errors``. Pass ``errors='ignore'`` to write the messages to the
log and get the workspace back.

Configuration
-------------

.. code-block:: python

   dash_prism.Prism(
       id='workspace',
       theme='light',           # or 'dark'
       size='md',               # 'sm', 'md', 'lg'
       maxTabs=16,              # Max tabs globally (< 1 = unlimited)
       maxPanels=20,            # Max leaf panels. 1 disables splitting, < 1 = unlimited
       layoutTimeout=30,        # Seconds before timeout
       showStatusBar=True,      # False hides the bar (and any actions)
       statusBarPosition='bottom',  # or 'top'
       statusBarItems=['reset', 'help', 'undo', 'mode', 'panels', 'tab', 'count', 'updated'],
       emptyTabView='layouts',  # 'layouts' | 'hint' | 'none'
       enableKeyboardShortcuts=True,  # False if they clash with your app's shortcuts
       enableShareLinks=True,   # False to disable tab share links and '#p:' hashes
   )

Tab Limits
^^^^^^^^^^

The ``maxTabs`` parameter sets the maximum number of tabs in the workspace. The
limit is **global**, and it counts the tabs of all the panels together. These
rules apply:

- The default is ``16``.
- A value of ``0``, or any value less than ``1``, means no limit.
- At the limit, Prism blocks each new tab action and writes a warning to the
  browser console.
- You can change ``maxTabs`` from a callback at any time
  (``Output('workspace', 'maxTabs')``). Prism keeps the open tabs and the undo
  history, and applies the new limit to the next tab action.

``maxPanels`` sets how many leaf panels the workspace can hold (default
``20``). At the limit, the split button and the edge drop zones disappear.
``maxPanels=1`` prevents all splits. A value less than ``1``, and an explicit
``None``, mean no limit.

Status Bar
^^^^^^^^^^

``showStatusBar=False`` removes the status bar fully. The reset, help and undo
buttons, the mode, panel and tab read-outs and all your ``actions`` go with it.
Keyboard shortcuts continue to work, but the status bar is the only way into the
help dialog and the workspace reset. Prism emits a ``UserWarning`` when you pass
``actions`` and ``showStatusBar=False`` together, because no user can click
those buttons. ``statusBarPosition`` selects ``'top'`` or ``'bottom'`` while the
bar is shown.

``statusBarItems`` selects which built-in segments the bar shows, and in which
order. The names are ``'reset'``, ``'help'``, ``'undo'``, ``'mode'``,
``'panels'``, ``'tab'``, ``'count'`` and ``'updated'``. Prism always puts
``'updated'`` at the far right, after all your ``actions``. For example,
``statusBarItems=['count', 'updated']`` keeps only the tab count and the
last-updated time next to your actions. An empty list leaves only the actions.

Prism ignores a name that it does not know, and a name that you give twice.
Thus a wrong name in Python hides one segment but does not break the bar.

Empty Tabs
^^^^^^^^^^

A tab with no layout usually shows a grid of all the registered layouts, with
the favorites first. ``emptyTabView`` changes that body:

- ``'layouts'`` (default) — the layout grid
- ``'hint'`` — one line that points the user to the search bar (and ``Ctrl+Space``)
- ``'none'`` — an empty pane. The user opens a layout from the search bar only

``emptyTabView`` and ``newTabOpensDropdown`` are independent of each other. The
first prop controls the tab body. The second prop controls whether the search
bar dropdown opens for a new tab. ``emptyTabView='none'`` together with
``newTabOpensDropdown=False`` leaves a new tab with no cue on the screen, so
Prism emits a ``UserWarning`` for that combination. A value that Prism does not
know falls back to ``'layouts'``.

Share Links
^^^^^^^^^^^

The tab context menu has a **Share** item for each tab that holds a layout. The
item copies a link that opens the same layout, with its parameters, in a new
tab. The link carries the layout in a ``#p:`` hash. Prism reads the hash on load
and on every hash change, and then removes the hash from the URL.
``enableShareLinks=False`` removes the menu item and ignores such a hash. Use it
for an app that must not give out deep links, or that uses the URL hash itself.

Layout Timeout
^^^^^^^^^^^^^^

``layoutTimeout`` (seconds, default ``30``) sets how long a tab waits for its
layout. The browser shows a timeout card when the content does not arrive in
time. The render callback also stops a layout callback that runs longer than
this limit, and renders an error tab. The server-side limit covers ``async``
layout callbacks in every app, and synchronous callbacks in an app that you make
with ``use_async=True``. A synchronous callback in a synchronous app runs to the
end, because Prism cannot stop it. A value that is not a finite positive number
falls back to ``30`` on the two sides, so there is no setting for "no limit".

Keyboard Shortcuts
^^^^^^^^^^^^^^^^^^

On macOS, ``Cmd`` works in the place of each ``Ctrl`` in the table, and
``Option`` is ``Alt``. The one exception is ``Ctrl`` + ``Space``, which is
Control on every platform, because ``Cmd`` + ``Space`` belongs to Spotlight. The
help dialog in the app shows the same bindings, and writes them with the ``⌃``
``⌥`` ``⇧`` symbols on macOS. The shortcuts apply to the Prism workspace that
the user touched last. Prism ignores them while the user types in an input, and
while a context menu or a dialog is open. A shortcut works only with exactly its
keys: with an extra ``Shift`` or ``Alt``, it does nothing.

============================  ===========================================
Shortcut                      Action
============================  ===========================================
``Ctrl`` + ``Alt`` + ``N``    New tab
``Ctrl`` + ``D``              Close tab
``Ctrl`` + ``B``              Duplicate tab
``Ctrl`` + ``U``              Undo last change
``Ctrl`` + ``O``              Lock / unlock tab
``Ctrl`` + ``R``              Rename tab
``Ctrl`` + ``Shift`` + ``R``  Refresh tab
``Ctrl`` + ``I``              Pin / unpin panel
``Ctrl`` + ``Y``              Toggle search bars
``Ctrl`` + ``J``              Previous tab
``Ctrl`` + ``K``              Next tab
``Ctrl`` + ``Space``          Focus the layout search
============================  ===========================================

New tab is a three-key chord. Chrome, Edge and Safari keep plain
``Ctrl``/``Cmd`` + ``N`` for themselves, and do not give that keystroke to the
page. The other bindings replace the browser's own default for the workspace
that the user clicked in last, at any position of the keyboard focus.

Pass ``enableKeyboardShortcuts=False`` to install none of the shortcuts. The
shortcut hints then disappear from the context menu, the help dialog and the
empty-tab view. Thus nothing on the screen shows a key binding that does
nothing.

Caveats
-------

Callback Exceptions
^^^^^^^^^^^^^^^^^^^

If your layouts contain components with callbacks, you must set
``suppress_callback_exceptions=True`` on your Dash app:

.. code-block:: python

   app = Dash(__name__, suppress_callback_exceptions=True)

**Why?** Components inside tab layouts do not exist in ``app.layout`` at
startup. Prism makes them only when a user opens a tab. Dash validates callback
IDs against the layout at registration time, so a callback that refers to those
components raises an exception.

.. code-block:: python

   # This layout has a Dropdown and Graph inside a tab:
   @dash_prism.register_layout(id='analytics', name='Analytics')
   def analytics():
       return html.Div([
           dcc.Dropdown(id='metric', options=['revenue', 'users']),
           dcc.Graph(id='chart'),
       ])

   # This callback will FAIL at startup without suppress_callback_exceptions
   # because 'metric' and 'chart' do not exist in app.layout yet.
   @app.callback(Output('chart', 'figure'), Input('metric', 'value'))
   def update_chart(metric):
       return px.line(df, y=metric)

**When is the flag not necessary?** You can leave the flag out when all your
layouts are fully static, with no callback that targets a component inside a
tab. You can also leave it out when you give a dict ID to each such component
yourself.

.. note::

   ``init()`` logs a warning if ``suppress_callback_exceptions`` is
   ``False`` to help catch this early.

ID Transformation
^^^^^^^^^^^^^^^^^

Prism rewrites string component IDs inside a tab's layout into pattern-matching
dicts so each tab instance stays isolated:

- ``'my-button'`` -> ``{'type': 'my-button', 'index': 'tab-xyz'}``

``inject_tab_id()`` does this automatically for **every** layout, and the value
of ``allow_multiple`` makes no difference. Prism does not touch a component that
has a dict ID, and it does not touch a component with no ID. See
`Component IDs Inside Tabs`_ for what the rewrite means for your callbacks.

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

``MATCH`` gives one callback for each tab, and it is the correct choice for the
content of a tab. ``ALL`` gives one callback that receives the values of all the
open tabs in one list. Use ``ALL`` only when the callback must read all the tabs
together.

Registration Order
^^^^^^^^^^^^^^^^^^

Register your layouts **before** you call ``init()``:

.. code-block:: python

   # 1. Register first
   @dash_prism.register_layout(...)
   def my_layout(): ...

   # 2. Then app.layout
   app.layout = html.Div([dash_prism.Prism(...)])

   # 3. Finally init
   dash_prism.init('workspace', app)

``init()`` reads the registry one time and puts the result into the
``registeredLayouts`` prop. A layout that you register after that call does not
reach the browser, so the search bar does not show the layout. ``init()`` also
emits a ``UserWarning`` when the registry is empty.

Initialization (``dash_prism.init``)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``init()`` function connects Prism to your Dash application. The call is
**necessary**, because Prism cannot render a tab without it. ``init()`` does
four tasks:

1. **Validates the setup** and raises :exc:`dash_prism.InitializationError`
   with a clear message
2. **Injects the layout metadata** into the Prism component, so the user
   interface knows which layouts are available
3. **Injects the** ``serverSessionId`` **prop** into the same component
4. **Creates the callback** that renders the contents of each tab

.. code-block:: python

   dash_prism.init('workspace', app)

``init()`` raises :exc:`dash_prism.InitializationError` when ``app.layout`` is
not set, or when ``initialLayout`` names a layout that you did not register.
``init()`` emits a ``UserWarning`` when it cannot find the Prism component in
the layout. The ``serverSessionId`` prop of :class:`dash_prism.Prism` says what
Prism does with the value that ``init()`` sets. The render callback is async
when the app has ``use_async=True``, and sync in every other case.

.. versionchanged:: 1.0.0
   The module-level ``dash_prism.SERVER_SESSION_ID`` constant (a new random
   value per process) was removed. ``init()`` now derives ``serverSessionId``
   from the registered layout IDs, so it is identical across workers and
   restarts. Pass ``serverSessionId=...`` to ``Prism`` to override it.

Static and Callable Layouts
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Prism supports a **static** ``app.layout`` and a **callable** ``app.layout``:

**Static Layout (Recommended)**

.. code-block:: python

   # Define layout as a static component tree
   app.layout = html.Div([
       dash_prism.Prism(id='workspace')
   ])

   dash_prism.init('workspace', app)

This is the **recommended approach** because:

- Better performance, because there is no function call on each page load
- Simpler to think about
- Prism injects the metadata one time, during the initialization

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

- A layout for each user, because the function can read the request context
- A layout that changes with a condition
- Compatibility with a Dash app that you already have

.. note::

   With a callable layout, ``init()`` automatically wraps your layout function
   and injects the Prism metadata on each render. The wrapper adds little work
   (~1ms), and it keeps the metadata correct each time that Dash makes the
   layout again. A second call to ``init()`` with the same ``prism_id`` does not
   wrap the layout again. A call with another ``prism_id`` fills that Prism
   component too. If you set ``app.layout`` again, for example when you run a
   notebook cell again, call ``init()`` again to fill the new layout. ``init()``
   registers the render callback one time for each Dash app.

.. warning::

   Prism supports an **async callable layout**, but you must make the app with
   ``use_async=True``: ``app = Dash(__name__, use_async=True)``. The wrapper
   does the same work, and it keeps the async nature of your function.

Background Callbacks
~~~~~~~~~~~~~~~~~~~~

A layout callback can be expensive, for example because it loads a large
dataset or does a long computation. You can move such a callback to a background
process with Dash's
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

``init()`` then registers the Prism render callback with ``background=True``.
Dash runs the callback in a different worker process (DiskCache) or on a task
queue (Celery). The main server thread then stays free for other requests. The
Dash app must have a ``background_callback_manager``, because Dash raises an
error for a background callback without one.
