"""Tests for scripts/check_wheel.py, the wheel check that CI and the release workflow share."""

from __future__ import annotations

import importlib.util
import pathlib
import zipfile

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent

# scripts/ is not a package, thus load the module from its path.
_spec = importlib.util.spec_from_file_location("check_wheel", ROOT / "scripts" / "check_wheel.py")
if _spec is None or _spec.loader is None:
    raise ImportError("Cannot load scripts/check_wheel.py")
check_wheel = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_wheel)


def _make_wheel(path: pathlib.Path, names: set[str], bundle: str = "") -> pathlib.Path:
    with zipfile.ZipFile(path, "w") as archive:
        for name in sorted(names):
            archive.writestr(name, bundle if name == "dash_prism/dash_prism.js" else "")
    return path


def test_required_files_include_every_hand_written_module() -> None:
    required = check_wheel.required_files()

    # The two lists that the workflows kept before did not have these two modules.
    assert "dash_prism/params.py" in required
    assert "dash_prism/PrismContent.py" in required

    assert "dash_prism/py.typed" in required
    assert check_wheel.GENERATED_FILES <= required


def test_required_files_keep_generated_files_when_the_build_did_not_write_them(
    tmp_path: pathlib.Path,
) -> None:
    (tmp_path / "Prism.py").write_text("")

    required = check_wheel.required_files(tmp_path)

    assert "dash_prism/Prism.py" in required
    assert "dash_prism/PrismComponent.py" in required


def test_missing_files_lists_the_absent_paths_in_order(tmp_path: pathlib.Path) -> None:
    wheel = _make_wheel(tmp_path / "pkg.whl", {"dash_prism/a.py"})

    missing = check_wheel.missing_files(wheel, ["dash_prism/c.py", "dash_prism/a.py", "x/b.js"])

    assert missing == ["dash_prism/c.py", "x/b.js"]


def test_missing_files_does_not_accept_a_path_in_a_subdirectory(tmp_path: pathlib.Path) -> None:
    wheel = _make_wheel(tmp_path / "pkg.whl", {"other/dash_prism/a.py"})

    assert check_wheel.missing_files(wheel, ["dash_prism/a.py"]) == ["dash_prism/a.py"]


def test_find_wheel_returns_the_one_wheel_in_a_directory(tmp_path: pathlib.Path) -> None:
    wheel = _make_wheel(tmp_path / "pkg.whl", set())
    (tmp_path / "pkg.tar.gz").write_text("")

    assert check_wheel.find_wheel(tmp_path) == wheel
    assert check_wheel.find_wheel(wheel) == wheel


def test_find_wheel_rejects_a_path_that_does_not_exist(tmp_path: pathlib.Path) -> None:
    with pytest.raises(ValueError, match="is not a wheel or a directory"):
        check_wheel.find_wheel(tmp_path / "missing.whl")


def test_find_wheel_rejects_a_file_that_is_not_a_wheel(tmp_path: pathlib.Path) -> None:
    sdist = tmp_path / "pkg.tar.gz"
    sdist.write_text("")

    with pytest.raises(ValueError, match="is not a wheel or a directory"):
        check_wheel.find_wheel(sdist)


@pytest.mark.parametrize("count", [0, 2])
def test_find_wheel_rejects_a_directory_without_exactly_one_wheel(
    tmp_path: pathlib.Path, count: int
) -> None:
    for i in range(count):
        _make_wheel(tmp_path / f"pkg-{i}.whl", set())

    with pytest.raises(ValueError, match=f"found {count}"):
        check_wheel.find_wheel(tmp_path)


def test_main_reports_missing_files_and_does_not_install(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    monkeypatch.setattr(check_wheel, "smoke_test", pytest.fail)
    wheel = _make_wheel(tmp_path / "pkg.whl", {"dash_prism/__init__.py"})

    assert check_wheel.main([str(wheel)]) == 1

    assert "- `dash_prism/params.py`" in capsys.readouterr().out
    assert "- `dash_prism/params.py`" in summary.read_text(encoding="utf-8")


def test_main_runs_the_smoke_test_when_every_file_is_present(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    installed: list[pathlib.Path] = []
    monkeypatch.setattr(check_wheel, "smoke_test", installed.append)
    wheel = _make_wheel(tmp_path / "pkg.whl", set(check_wheel.required_files()))

    assert check_wheel.main([str(wheel)]) == 0
    assert installed == [wheel]


def test_holds_strict_mode_bundle_finds_the_strict_mode_wrapper(tmp_path: pathlib.Path) -> None:
    names = {"dash_prism/dash_prism.js"}
    strict = _make_wheel(tmp_path / "strict.whl", names, bundle="React.StrictMode")
    release = _make_wheel(tmp_path / "release.whl", names, bundle="React.Fragment")
    no_bundle = _make_wheel(tmp_path / "empty.whl", set())

    assert check_wheel.holds_strict_mode_bundle(strict)
    assert not check_wheel.holds_strict_mode_bundle(release)
    assert not check_wheel.holds_strict_mode_bundle(no_bundle)


def test_main_rejects_the_strict_mode_bundle_and_does_not_install(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.setattr(check_wheel, "smoke_test", pytest.fail)
    wheel = _make_wheel(
        tmp_path / "pkg.whl", set(check_wheel.required_files()), bundle="React.StrictMode"
    )

    assert check_wheel.main([str(wheel)]) == 1
    assert "StrictMode test bundle" in capsys.readouterr().out


def test_main_exits_with_a_usage_error_for_a_file_that_is_not_a_wheel(
    tmp_path: pathlib.Path,
) -> None:
    sdist = tmp_path / "pkg.tar.gz"
    sdist.write_text("")

    with pytest.raises(SystemExit) as exit_info:
        check_wheel.main([str(sdist)])

    assert exit_info.value.code == 2
