"""
Integration tests for the actions of the error boundary.

Dash catches the errors in a tab layout itself, so these tests mount the
exported ErrorBoundary with a child that throws. A host page for the real
component would need a bug in Prism.
"""

from __future__ import annotations

import pytest
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from conftest import PRISM_ROOT, press_key, tab_to

pytestmark = pytest.mark.integration

# The boundary renders inside the Prism root, where the stylesheet applies. The child
# throws until the test clears window.__prismThrow, so "Try again" can succeed.
# The clear-storage callback writes to sessionStorage because the page reloads next.
_MOUNT_BOUNDARY = """
const level = arguments[0];
const host = document.createElement('div');
document.querySelector(arguments[1]).appendChild(host);
const React = window.React;
function Thrower() {
  if (window.__prismThrow) throw new Error('Something broke in this tab');
  return React.createElement('p', {id: 'recovered'}, 'recovered');
}
window.__prismThrow = true;
window.__beforeReload = true;
window.ReactDOM.createRoot(host).render(
  React.createElement(
    window.dash_prism.ErrorBoundary,
    {level: level, onClearStorage: () => sessionStorage.setItem('cleared', 'yes')},
    React.createElement(Thrower)
  )
);
"""

RETRY = "[data-testid='prism-error-action-retry']"
REFRESH = "[data-testid='prism-error-action-refresh']"
CLEAR_STORAGE = "[data-testid='prism-error-action-clear-storage']"

KEYS = pytest.mark.parametrize("key", [Keys.ENTER, Keys.SPACE], ids=["enter", "space"])


def _mount_boundary(duo, level: str) -> None:
    duo.wait_for_element(PRISM_ROOT, timeout=10)
    duo.driver.execute_script(_MOUNT_BOUNDARY, level, PRISM_ROOT)


def _wait_for_reload(duo) -> None:
    WebDriverWait(duo.driver, 10).until(
        lambda driver: driver.execute_script("return window.__beforeReload === undefined;"),
        message="The page should reload",
    )
    duo.wait_for_element(PRISM_ROOT, timeout=10)


@KEYS
def test_try_again_renders_the_content_again(prism_app_with_layouts, key):
    duo = prism_app_with_layouts
    _mount_boundary(duo, "panel")
    assert duo.find_element(RETRY).tag_name == "button"

    tab_to(duo, RETRY)
    duo.driver.execute_script("window.__prismThrow = false;")
    press_key(duo, key)

    duo.wait_for_element("#recovered", timeout=5)
    assert duo.find_elements(RETRY) == []


@KEYS
def test_refresh_page_reloads_the_page(prism_app_with_layouts, key):
    duo = prism_app_with_layouts
    _mount_boundary(duo, "workspace")

    tab_to(duo, REFRESH)
    press_key(duo, key)

    _wait_for_reload(duo)


@KEYS
def test_clear_storage_runs_the_callback_and_reloads_the_page(prism_app_with_layouts, key):
    duo = prism_app_with_layouts
    _mount_boundary(duo, "workspace")

    tab_to(duo, CLEAR_STORAGE)
    press_key(duo, key)

    _wait_for_reload(duo)
    assert duo.driver.execute_script("return sessionStorage.getItem('cleared');") == "yes"
