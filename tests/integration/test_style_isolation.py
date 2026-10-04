"""
Integration tests for the style isolation of Prism.

Prism shares the page with the host Dash app. These tests check that Prism
does not restyle the host page, that two instances keep their own theme, and
that a portal (context menu, dialog) uses the theme of the instance that
opened it.

Best Practices Applied:
- Use explicit waits (wait_for_*) instead of time.sleep()
- Use reliable CSS selectors (data-testid)
- Compare computed styles with a reference document that Prism never touches
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

import pytest
from dash import Dash, dcc, html
from dash.development.base_component import Component
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

import dash_prism
from tests.integration import testutils

pytestmark = pytest.mark.integration

TAB = "[data-testid^='prism-tab-']:not([data-testid*='close'])"
HELP_BUTTON = "[data-testid='prism-statusbar-help']"
DIALOG = "[data-slot='dialog-content']"

# Resolves any CSS color to [r, g, b], also for the oklch() values of the theme tokens.
TO_RGB_JS = """
const toRgb = (color) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
};
"""

# The tags and the properties that Tailwind preflight changes on a page.
HOST_STYLE_PROBE_JS = """
const markup = '<!doctype html><body><h1>h</h1><p>p</p><ul><li>i</li></ul>'
  + '<a href="#">a</a><button>b</button></body>';
const properties = {
  body: ['margin-top', 'background-color', 'font-family', 'line-height'],
  h1: ['margin-top', 'font-size', 'font-weight'],
  p: ['margin-top', 'box-sizing'],
  ul: ['list-style-type', 'padding-left'],
  a: ['color', 'text-decoration-line'],
  button: ['border-top-width', 'border-top-style', 'background-color', 'border-top-left-radius'],
};
const read = (doc) => {
  const result = {};
  for (const [tag, names] of Object.entries(properties)) {
    const style = doc.defaultView.getComputedStyle(doc.querySelector(tag));
    result[tag] = Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
  }
  return result;
};
// A frame that holds the same tags is the reference. No Prism rule applies inside it.
const frame = document.createElement('iframe');
frame.style.cssText = 'position: fixed; left: -9999px; width: 800px; height: 600px;';
document.body.appendChild(frame);
frame.contentDocument.open();
frame.contentDocument.write(markup);
frame.contentDocument.close();
const reference = read(frame.contentDocument);
frame.remove();

// The host elements sit in the page next to Prism.
const host = document.createElement('div');
host.id = 'host-probe';
host.innerHTML = '<h1>h</h1><p>p</p><ul><li>i</li></ul><a href="#">a</a><button>b</button>';
document.body.appendChild(host);
const actual = {};
for (const [tag, names] of Object.entries(properties)) {
  const element = tag === 'body' ? document.body : host.querySelector(tag);
  const style = getComputedStyle(element);
  actual[tag] = Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
}
host.remove();
return { reference, actual };
"""


def _start_app(dash_duo, layout, layouts: Mapping[str, Component] | None = None) -> None:
    """Start a Dash app with the given layout and initialize Prism for the first instance.

    The layouts argument maps layout IDs to the layouts that Prism registers.
    A second Prism component needs no layout. The theme tests and the portal tests do not open one.
    """
    app = Dash(__name__, suppress_callback_exceptions=True)
    for layout_id, tab_layout in (layouts or {"host-test": html.Div("Content")}).items():
        dash_prism.register_layout(id=layout_id, name=layout_id.title(), layout=tab_layout)
    app.layout = layout
    dash_prism.init("prism-first", app)
    dash_duo.driver.set_window_size(1280, 900)
    testutils.start_app(dash_duo, app)


def _prism(
    prism_id: str,
    theme: Literal["light", "dark"] = "light",
    initial_layout: str | None = None,
) -> dash_prism.Prism:
    return dash_prism.Prism(
        id=prism_id,
        theme=theme,
        initialLayout=initial_layout,
        persistence=False,
        style={"height": "320px", "width": "100%"},
    )


def _wait_for_tab(dash_duo, prism_id: str) -> None:
    dash_duo.wait_for_element(f"#{prism_id} {TAB}", timeout=10)


def _rgb(driver, element) -> list[int]:
    return driver.execute_script(
        TO_RGB_JS + "return toRgb(getComputedStyle(arguments[0]).backgroundColor);", element
    )


def test_prism_does_not_restyle_the_host_page(dash_duo):
    """The tags of the host page keep their browser defaults next to a Prism instance."""
    _start_app(
        dash_duo,
        html.Div(
            [
                html.H1("Host heading", id="host-heading"),
                html.Div("Host collapse", id="host-collapse", className="collapse show"),
                html.Button("Host button", id="host-button"),
                _prism("prism-first", "dark"),
            ]
        ),
    )
    _wait_for_tab(dash_duo, "prism-first")

    probe = dash_duo.driver.execute_script(HOST_STYLE_PROBE_JS)

    assert probe["actual"] == probe["reference"], "Prism changed the style of the host page"

    # A class name of a host element that is also a Tailwind utility name keeps its host meaning.
    visibility = dash_duo.driver.execute_script(
        "return getComputedStyle(document.getElementById('host-collapse')).visibility;"
    )
    assert visibility != "collapse", "A Prism utility styled an element of the host page"

    # The old stylesheet put these two on the document: a theme attribute and a token on :root.
    document_state = dash_duo.driver.execute_script("""
        return {
          attribute: document.documentElement.hasAttribute('data-prism-theme'),
          token: getComputedStyle(document.documentElement).getPropertyValue('--background'),
        };
        """)
    assert document_state == {"attribute": False, "token": ""}

    # Tailwind puts its theme variables on :root unless the theme import has the inline option.
    spacing = dash_duo.driver.execute_script(
        "return getComputedStyle(document.documentElement).getPropertyValue('--spacing');"
    )
    assert spacing == "", "Prism defined a Tailwind theme variable on :root"


def test_two_instances_paint_their_own_theme(dash_duo):
    """Two instances with different themes each paint their own background."""
    _start_app(
        dash_duo,
        html.Div([_prism("prism-first", "light"), _prism("prism-second", "dark")]),
    )
    _wait_for_tab(dash_duo, "prism-first")
    _wait_for_tab(dash_duo, "prism-second")

    light = _rgb(dash_duo.driver, dash_duo.find_element("#prism-first"))
    dark = _rgb(dash_duo.driver, dash_duo.find_element("#prism-second"))

    assert min(light) > 200, f"The light instance is not light: {light}"
    assert max(dark) < 80, f"The dark instance is not dark: {dark}"


def test_context_menu_and_dialog_use_the_theme_of_their_instance(dash_duo):
    """A portal renders inside the instance that opened it and takes that theme."""
    _start_app(
        dash_duo,
        html.Div([_prism("prism-first", "light"), _prism("prism-second", "dark")]),
    )
    _wait_for_tab(dash_duo, "prism-first")
    _wait_for_tab(dash_duo, "prism-second")
    driver = dash_duo.driver

    # Context menu of the dark instance
    testutils.open_context_menu(dash_duo, dash_duo.find_element(f"#prism-second {TAB}"))
    menu = dash_duo.find_element(testutils.CONTEXT_MENU)
    owner = driver.execute_script("return arguments[0].closest('.prism-root')?.id ?? null;", menu)
    assert owner == "prism-second", "The context menu is outside the instance that opened it"
    assert max(_rgb(driver, menu)) < 80, "The context menu of a dark instance is not dark"
    ActionChains(driver).send_keys(Keys.ESCAPE).perform()
    WebDriverWait(driver, 5).until(
        lambda d: not d.find_elements(By.CSS_SELECTOR, testutils.CONTEXT_MENU)
    )

    # Help dialog of the light instance
    dash_duo.find_element(f"#prism-first {HELP_BUTTON}").click()
    dialog = dash_duo.wait_for_element(DIALOG, timeout=5)
    owner = driver.execute_script("return arguments[0].closest('.prism-root')?.id ?? null;", dialog)
    assert owner == "prism-first", "The dialog is outside the instance that opened it"
    assert min(_rgb(driver, dialog)) > 200, "The dialog of a light instance is not light"


def test_print_hides_the_chrome_of_prism_only(dash_duo):
    """Print media hides the Prism chrome, prints a dark workspace white, and spares the host."""
    # A host app with its own shadcn tabs has this attribute on an element.
    host_tab_attributes: dict[str, Any] = {"data-slot": "tabs-list"}
    _start_app(
        dash_duo,
        html.Div(
            [
                html.Div("Host tabs", id="host-tabs", **host_tab_attributes),
                _prism("prism-first", "dark"),
            ]
        ),
    )
    _wait_for_tab(dash_duo, "prism-first")
    driver = dash_duo.driver

    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "print"})
    try:
        state = driver.execute_script(TO_RGB_JS + """
            const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
            return {
              background: toRgb(getComputedStyle(document.querySelector('#prism-first')).backgroundColor),
              tabList: display('#prism-first [data-slot=tabs-list]'),
              searchBar: display('#prism-first .prism-searchbar'),
              hostTabs: display('#host-tabs'),
            };
            """)
    finally:
        driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": ""})

    assert state["background"] == [255, 255, 255], "A dark workspace does not print white"
    assert state["tabList"] == "none"
    assert state["searchBar"] == "none"
    assert state["hostTabs"] != "none", "The print rules hid an element of the host page"


def _open_layout_in_new_tab(dash_duo, layout_id: str, tab_count: int) -> None:
    """Add a tab and open the layout in it through the dropdown that a new tab opens."""
    dash_duo.find_element(testutils.ADD_TAB_BUTTON).click()
    testutils.wait_for_tab_count(dash_duo, tab_count)
    item = f"[data-testid='prism-layout-item-{layout_id}']"
    dash_duo.wait_for_element(item, timeout=5)
    dash_duo.find_element(item).click()


def test_reset_rules_leave_the_defaults_of_tab_content(dash_duo):
    """A rule of the browser that the preflight reset takes away is back inside a tab."""
    probe = html.Div(
        [
            html.Hr(id="probe-hr"),
            html.Div("Hidden", id="probe-hidden", hidden=True, style={"display": "flex"}),
        ]
    )
    _start_app(
        dash_duo,
        html.Div(_prism("prism-first", initial_layout="probe")),
        layouts={"probe": probe},
    )
    dash_duo.wait_for_element("#prism-first [id*='probe-hr']", timeout=10)

    state = dash_duo.driver.execute_script("""
        const style = (selector) => getComputedStyle(document.querySelector(selector));
        return {
          rule: style('#prism-first [id*=probe-hr]').borderTopWidth,
          hidden: style('#prism-first [id*=probe-hidden]').display,
        };
        """)

    assert state["rule"] != "0px", "A horizontal rule in a tab has no border"
    assert state["hidden"] == "none", "An element with the hidden attribute shows in a tab"


def test_inactive_tab_does_not_extend_the_scroll_area_of_the_panel(dash_duo):
    """A tall layout in a background tab does not make the active short tab scroll."""
    _start_app(
        dash_duo,
        html.Div(_prism("prism-first", initial_layout="tall")),
        layouts={
            "tall": html.Div("Tall", id="tall-content", style={"height": "3000px"}),
            "short": html.Div("Short", id="short-content"),
        },
    )
    dash_duo.wait_for_element("#prism-first [id*='tall-content']", timeout=10)
    _open_layout_in_new_tab(dash_duo, "short", tab_count=2)
    dash_duo.wait_for_element("#prism-first [id*='short-content']", timeout=10)

    scroll_height, client_height = dash_duo.driver.execute_script("""
        const active = document.querySelector(
          "#prism-first [data-slot='tabs-content'][data-state='active']"
        );
        return [active.parentElement.scrollHeight, active.parentElement.clientHeight];
        """)

    assert scroll_height == client_height, "The hidden tab adds a scroll bar to the panel"


def test_inactive_tab_keeps_the_size_of_its_graph(dash_duo):
    """The content of a background tab keeps a real width, so a Plotly graph lays out."""
    _start_app(
        dash_duo,
        html.Div(_prism("prism-first", initial_layout="graph")),
        layouts={
            "graph": dcc.Graph(
                id="graph-content",
                figure={"data": [{"y": [1, 2, 3]}]},
                style={"height": "300px"},
            ),
            "short": html.Div("Short", id="short-content"),
        },
    )
    dash_duo.wait_for_element("#prism-first .js-plotly-plot", timeout=10)
    _open_layout_in_new_tab(dash_duo, "short", tab_count=2)
    dash_duo.wait_for_element("#prism-first [id*='short-content']", timeout=10)

    width = dash_duo.driver.execute_script("""
        const graph = document.querySelector(
          "#prism-first [data-slot='tabs-content'][data-state='inactive'] .js-plotly-plot"
        );
        return graph?.getBoundingClientRect().width ?? 0;
        """)

    assert width > 0, "The graph of the background tab has no width"


# Class names of Bootstrap, and of any other CSS framework, that are also Tailwind utility names.
# The host styles them. The Prism stylesheet must not.
FRAMEWORK_CLASS_NAMES = [
    "collapse",
    "container",
    "border",
    "hidden",
    "invisible",
    "rounded",
    "flex",
    "grid",
    "text-center",
    "p-4",
    "mt-1",
    "fixed",
    "absolute",
    "relative",
    "truncate",
    "sr-only",
]


def _probe_attributes(name: str) -> dict[str, str]:
    return {"data-testid": f"utility-probe-{name}"}


def test_bootstrap_collapse_in_a_tab_stays_visible(dash_duo):
    """An open Bootstrap collapse in a tab is not hidden by a Prism utility."""
    _start_app(
        dash_duo,
        html.Div(_prism("prism-first", initial_layout="collapse")),
        layouts={
            "collapse": html.Div(
                "Open collapse",
                id="open-collapse",
                className="collapse show",
                style={"height": "40px"},
            )
        },
    )
    dash_duo.wait_for_element("#prism-first [id*='open-collapse']", timeout=10)

    state = dash_duo.driver.execute_script("""
        const element = document.querySelector('#prism-first [id*=open-collapse]');
        return {
          visibility: getComputedStyle(element).visibility,
          height: element.getBoundingClientRect().height,
        };
        """)

    assert state["visibility"] == "visible", "A Prism utility hid an open collapse in a tab"
    assert state["height"] > 0


def test_framework_class_names_in_a_tab_keep_the_style_of_a_plain_element(dash_duo):
    """An element with the class name of a Tailwind utility looks like an element without it."""
    probes = [
        html.Div("Probe", className=name, **_probe_attributes(name))
        for name in FRAMEWORK_CLASS_NAMES
    ]
    reference = html.Div("Probe", **_probe_attributes("reference"))
    _start_app(
        dash_duo,
        html.Div(_prism("prism-first", initial_layout="probes")),
        layouts={"probes": html.Div([reference, *probes])},
    )
    dash_duo.wait_for_element("#prism-first [data-testid='utility-probe-reference']", timeout=10)

    changed = dash_duo.driver.execute_script("""
        const probes = document.querySelectorAll("#prism-first [data-testid^='utility-probe-']");
        const reference = getComputedStyle(
          document.querySelector("#prism-first [data-testid='utility-probe-reference']")
        );
        const changed = {};
        for (const probe of probes) {
          const style = getComputedStyle(probe);
          const names = Array.from(style).filter(
            (name) => style.getPropertyValue(name) !== reference.getPropertyValue(name)
          );
          if (names.length > 0) {
            changed[probe.dataset.testid] = names.slice(0, 5);
          }
        }
        return changed;
        """)

    assert changed == {}, f"A Prism utility styled a class name of the host: {changed}"
