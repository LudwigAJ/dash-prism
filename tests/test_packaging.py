"""
Regression tests for packaging and documentation claims (01 §4, §6).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

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


def test_api_reference_documents_exactly_the_public_api() -> None:
    """docs/api.rst and dash_prism.__all__ must list the same names (01 §2.1)."""
    import dash_prism

    api = (ROOT / "docs" / "api.rst").read_text(encoding="utf-8")
    documented = set(re.findall(r"^\.\. (?:auto\w+|data):: dash_prism\.(\w+)", api, re.M))
    public = set(dash_prism.__all__)
    assert documented == public, (
        f"undocumented: {sorted(public - documented)}; "
        f"documented but not exported: {sorted(documented - public)}"
    )


def test_removed_public_helpers_are_gone() -> None:
    """render_layout_for_tab could not render async layouts and duplicated init.py."""
    import dash_prism

    assert not hasattr(dash_prism, "render_layout_for_tab")
    assert not hasattr(dash_prism.utils, "render_layout_for_tab")


def _pyproject_version() -> str:
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    assert match, "pyproject.toml must declare [project].version"
    return match.group(1)


def test_package_json_version_matches_pyproject() -> None:
    """The JS bundle and the Python package are released together (00 §2.7)."""
    package_json = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert package_json["version"] == _pyproject_version()


def test_docs_do_not_hardcode_the_version() -> None:
    """docs/conf.py derives `release` from the package; no third copy to keep in sync."""
    conf = (ROOT / "docs" / "conf.py").read_text(encoding="utf-8")
    assert not re.search(r'^release\s*=\s*"', conf, re.MULTILINE)
    assert "_read_release()" in conf


def _workflows() -> dict[str, str]:
    return {
        path.name: path.read_text(encoding="utf-8")
        for path in sorted((ROOT / ".github" / "workflows").glob("*.yml"))
    }


def test_nvmrc_matches_the_node_version_of_every_workflow() -> None:
    """A local shell that reads .nvmrc gets the Node.js version that CI uses."""
    nvmrc = (ROOT / ".nvmrc").read_text(encoding="utf-8").strip()
    for name, text in _workflows().items():
        for version in re.findall(r'node-version:\s*"?([0-9.]+)"?', text):
            assert version == nvmrc, f"{name} uses Node.js {version}, .nvmrc says {nvmrc}"


def test_ci_runs_on_pull_requests() -> None:
    """The checks must report on a pull request before the merge, not after it."""
    workflows = _workflows()
    for name in ("ci.yml", "codeql.yml"):
        assert re.search(r"^  pull_request:", workflows[name], re.MULTILINE), name


def _workflow_commands(text: str) -> list[str]:
    jobs = yaml.safe_load(text)["jobs"].values()
    return [step["run"] for job in jobs for step in job.get("steps", []) if "run" in step]


def _recipe_commands(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.startswith((" ", "\t"))]


def test_package_json_holds_the_only_test_commands() -> None:
    """CI and the justfile call the package.json scripts, so that all three run the same suite."""
    commands = {name: _workflow_commands(text) for name, text in _workflows().items()}
    commands["justfile"] = _recipe_commands((ROOT / "justfile").read_text(encoding="utf-8"))
    # A plugin name such as pytest-xdist is not a call of the tool.
    tool_call = re.compile(r"(?<![\w-])(pytest|vitest|eslint)(?![\w-])")
    for name, runs in commands.items():
        offenders = [run for run in runs if tool_call.search(run)]
        assert offenders == [], f"{name} calls a tool instead of a pnpm script: {offenders}"

    for script in ("test:ts", "test", "lint"):
        assert f"pnpm run {script}" in commands["ci.yml"], script
