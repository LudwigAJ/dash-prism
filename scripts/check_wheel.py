"""Check that a built wheel holds every package file, then install it and import it.

The CI workflow and the release workflow both run this script after ``poetry
build``. Thus the two workflows share one list of required files and one smoke
test.

Usage::

    python scripts/check_wheel.py dist/
"""

from __future__ import annotations

import argparse
import os
import pathlib
import subprocess
import sys
import tempfile
import venv
import zipfile
from collections.abc import Iterable, Sequence

_PACKAGE_DIR = pathlib.Path(__file__).resolve().parent.parent / "dash_prism"

# The build writes these files and .gitignore excludes them. Name them here so
# that a failed build cannot remove them from the check: a glob of the checkout
# finds only the files that the build wrote.
GENERATED_FILES = frozenset(
    {
        "dash_prism/dash_prism.js",
        "dash_prism/icons.json",
        "dash_prism/metadata.json",
        "dash_prism/package-info.json",
        "dash_prism/proptypes.js",
        "dash_prism/PrismComponent.py",
        "dash_prism/PrismActionComponent.py",
        "dash_prism/PrismContentComponent.py",
        "dash_prism/_imports_.py",
    }
)

# The Python of the new environment runs this code. pydantic is a hard
# dependency, thus the install must give version 2.
_SMOKE_TEST = """
import dash_prism
import pydantic

if not dash_prism.__version__:
    raise SystemExit("dash_prism.__version__ is empty")
if not dash_prism.AVAILABLE_ICONS:
    raise SystemExit("dash_prism.AVAILABLE_ICONS is empty")
if int(pydantic.VERSION.split(".")[0]) < 2:
    raise SystemExit(f"pydantic {pydantic.VERSION} is installed, version 2 is necessary")
print(f"Smoke test passed: dash_prism {dash_prism.__version__}")
"""


def required_files(package_dir: pathlib.Path = _PACKAGE_DIR) -> frozenset[str]:
    """Returns the wheel paths of the files that a wheel must hold.

    The files are the generated files, each module in the checkout and py.typed.
    """
    modules = {f"dash_prism/{path.name}" for path in package_dir.glob("*.py")}
    return GENERATED_FILES | modules | {"dash_prism/py.typed"}


def missing_files(wheel: pathlib.Path, required: Iterable[str]) -> list[str]:
    """Returns the required paths that the wheel does not hold, in sorted order."""
    with zipfile.ZipFile(wheel) as archive:
        names = set(archive.namelist())
    return sorted(set(required) - names)


def find_wheel(path: pathlib.Path) -> pathlib.Path:
    """Returns the wheel at ``path``, or the one wheel in the directory ``path``.

    :param path: A wheel file, or a directory that holds one wheel.
    :returns: The path of the wheel.
    :raises ValueError: If ``path`` is not a wheel, or if the directory does not hold exactly
        one wheel.
    """
    if path.is_file() and path.suffix == ".whl":
        return path
    if not path.is_dir():
        raise ValueError(f"{str(path)!r} is not a wheel or a directory")
    wheels = sorted(path.glob("*.whl"))
    if len(wheels) != 1:
        raise ValueError(f"Expected one wheel in {str(path)!r}, found {len(wheels)}: {wheels}")
    return wheels[0]


def smoke_test(wheel: pathlib.Path) -> None:
    """Installs the wheel in a new virtual environment and imports the package.

    :param wheel: The wheel file to install.
    :raises subprocess.CalledProcessError: If the install or the import fails.
    """
    with tempfile.TemporaryDirectory() as env_dir:
        venv.create(env_dir, with_pip=True)
        bin_dir = "Scripts" if os.name == "nt" else "bin"
        python = pathlib.Path(env_dir, bin_dir, "python")
        subprocess.run(
            [python, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", wheel],
            check=True,
        )
        subprocess.run([python, "-c", _SMOKE_TEST], check=True)


def _write_summary(lines: Sequence[str]) -> None:
    """Prints the lines and adds them to the GitHub step summary when one exists."""
    text = "\n".join(lines)
    print(text, flush=True)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text + "\n")


def main(argv: Sequence[str] | None = None) -> int:
    """Checks the wheel that the command line names and returns the exit status."""
    parser = argparse.ArgumentParser(description="Check a built dash_prism wheel.")
    parser.add_argument("path", type=pathlib.Path, help="a wheel, or a directory with one wheel")
    args = parser.parse_args(argv)

    try:
        wheel = find_wheel(args.path)
    except ValueError as e:
        parser.error(str(e))
    missing = missing_files(wheel, required_files())
    if missing:
        _write_summary(
            [f"## Wheel check: {wheel.name}", "", "Missing from the wheel:"]
            + [f"- `{name}`" for name in missing]
        )
        return 1
    _write_summary([f"## Wheel check: {wheel.name}", "", "All required files are present."])

    smoke_test(wheel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
