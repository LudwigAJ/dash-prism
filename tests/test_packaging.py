"""
Regression tests for packaging and documentation claims (01 §4, §6).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_build_backend_requires_poetry_core_2() -> None:
    """The [project] table, dynamic fields and PEP 639 license need poetry-core 2.x."""
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    # Match the requirement itself, not one way of spelling the TOML array:
    # quoting, spacing, multi-line arrays and extra entries are all valid.
    match = re.search(r"poetry-core\s*>=\s*([0-9]+(?:\.[0-9]+)*)", text)
    assert match, "build-system.requires must pin poetry-core"
    parts = tuple(int(p) for p in match.group(1).split("."))
    assert parts + (0, 0) >= (2, 1, 0)


def test_no_setuptools_leftovers() -> None:
    """setup.py read the version from package.json; both files are dead under poetry-core."""
    assert not (ROOT / "setup.py").exists()
    assert not (ROOT / "MANIFEST.in").exists()


def test_docs_do_not_use_removed_run_server() -> None:
    """Dash >= 3 has app.run(); app.run_server() raises AttributeError."""
    files = [
        *(ROOT / "dash_prism").glob("*.py"),
        *(ROOT / "docs").glob("*.rst"),
        ROOT / "README.md",
        ROOT / "usage.py",
    ]
    offenders = [str(f) for f in files if "run_server" in f.read_text(encoding="utf-8")]
    assert offenders == []


def test_user_guide_does_not_promise_string_ids_without_allow_multiple() -> None:
    """inject_tab_id rewrites string IDs for every tab layout (01 §1.4).

    Assert the claim, not one phrasing of it: the guide must say the rewriting is
    unconditional and must nowhere tell the reader that a layout is rendered with
    its string IDs intact. Text is whitespace-normalised so re-wrapping a
    paragraph cannot silently disable the guard.
    """
    raw = (ROOT / "docs" / "user-guide.rst").read_text(encoding="utf-8")
    guide = " ".join(raw.split())

    for wrong in (
        "allow_multiple only",
        "rendered as-is",
        "regular string IDs",
        "only applies to layouts that allow multiple instances",
        "since only one instance exists",
    ):
        assert wrong not in guide, f"user guide still claims: {wrong}"

    assert "rewrites every string component ID" in guide
    assert "whether or not ``allow_multiple`` is set" in guide
