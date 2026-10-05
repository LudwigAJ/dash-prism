"""Integration tests for the demo app in ``examples/``."""

from __future__ import annotations

from tests.integration import testutils

# Dash writes a dict ID to the DOM as JSON with sorted keys.
SETTINGS_STATUS = """[id='{"index":"settings","type":"settings-status"}']"""


def test_opening_settings_does_not_apply_the_form(dash_duo, demo_app):
    """The apply callback must not run when the settings tab inserts its button.

    Prism starts dark and the form starts light, so a callback that applied the
    form would turn Prism light.
    """
    demo_app.app.layout.children.theme = "dark"
    duo = testutils.start_app(dash_duo, demo_app.app)
    duo.wait_for_element(".prism-root.dark", timeout=5)

    testutils.open_layout(duo, "settings")
    duo.wait_for_element(SETTINGS_STATUS, timeout=10)
    testutils.wait_for_callbacks_idle(duo)

    assert duo.find_element(SETTINGS_STATUS).text == ""
    assert "dark" in duo.find_element(testutils.PRISM_ROOT).get_attribute("class").split()
