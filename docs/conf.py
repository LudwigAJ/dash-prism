import os
import sys
import tomllib
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

sys.path.insert(0, os.path.abspath(".."))

project = "Dash Prism"
copyright = "2026, Ludwig Jonsson"
author = "Ludwig Jonsson"


def _read_release() -> str:
    """The version lives in pyproject.toml only (package.json must match; CI checks).

    Read it from the checkout when building docs from source, and fall back to
    the installed package metadata when the docs are built from a wheel.
    """
    pyproject = os.path.join(os.path.dirname(__file__), "..", "pyproject.toml")
    if os.path.exists(pyproject):
        with open(pyproject, "rb") as fh:
            return tomllib.load(fh)["project"]["version"]
    try:
        return _pkg_version("dash_prism")
    except PackageNotFoundError:
        raise RuntimeError("cannot determine the dash_prism version") from None


release = _read_release()

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.viewcode",
    "sphinx.ext.intersphinx",
]

exclude_patterns = ["_build"]
master_doc = "index"
html_static_path = ["_static"]

autodoc_default_options = {
    "members": True,
    "member-order": "bysource",
    "undoc-members": False,
}

intersphinx_mapping = {"python": ("https://docs.python.org/3", None)}

nitpick_ignore = [
    ("py:class", "Dash"),
    ("py:class", "LayoutRegistration"),
    ("py:class", "dash.development.base_component.Component"),
    ("py:class", "dash_prism.PrismActionComponent.PrismActionComponent"),
    ("py:class", "dash_prism.PrismComponent.PrismComponent"),
    ("py:class", "dash_prism.PrismContentComponent.PrismContentComponent"),
    ("py:class", "dash_prism.registry.LayoutRegistration"),
]

html_theme = "furo"
html_title = "Dash Prism"
html_theme_options = {
    "navigation_with_keys": True,
}
html_js_files = [
    (
        "https://www.googletagmanager.com/gtag/js?id=G-V4ZRTXT9W8",
        {"async": "async"},
    ),
    "js/google-analytics.js",
]
