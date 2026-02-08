import os
import sys

sys.path.insert(0, os.path.abspath(".."))

project = "Dash Prism"
copyright = "2026, Ludwig Jonsson"
author = "Ludwig Jonsson"
release = "0.9.0"

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.viewcode",
    "sphinx.ext.intersphinx",
]

exclude_patterns = ["_build"]
master_doc = "index"

autodoc_default_options = {
    "members": True,
    "member-order": "bysource",
    "undoc-members": False,
    "show-inheritance": True,
}

intersphinx_mapping = {"python": ("https://docs.python.org/3", None)}

html_theme = "sphinx_rtd_theme"
html_title = "Dash Prism"
html_theme_options = {
    "navigation_depth": 4,
    "collapse_navigation": False,
    "sticky_navigation": True,
}
