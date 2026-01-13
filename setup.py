"""
Minimal setup.py shim for backward compatibility.
All configuration is in pyproject.toml.
"""

import json
from pathlib import Path
from setuptools import setup

# Read version from package.json to keep it in sync
package_json = Path(__file__).parent / "package.json"
if package_json.exists():
    with open(package_json) as f:
        package = json.load(f)
        version = package.get("version", "0.0.1")
else:
    version = "0.0.1"

# All other configuration is in pyproject.toml
setup(version=version)
