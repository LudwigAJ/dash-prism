set dotenv-load := false

# Activate the virtual environment
venv:
    source pnpm run venv

# Generate components and build the bundle
build:
    pnpm run venv
    pnpm run build

# Build the webpack bundle
build-js:
    pnpm run venv
    pnpm run build:js

# Generate the components
gen:
    pnpm run venv
    pnpm run build:backends

# Rebuild the bundle on change
watch:
    pnpm run watch

# Install Poetry dependencies & node modules.
install:
    poetry install --with dev,test,docs,demo
    pnpm install

# Package the application for distribution using python wheel.
package: clean build
    pnpm run venv
    python -m build --wheel

# Publish the package to pypi using twine.
publish: package
    pnpm run venv
    pnpm publish
    twine upload dist/*

# format the codebase
format:
    pnpm run venv
    pnpm run format

# format Python code with black
format-py:
    black dash_prism tests

# check typescript no emit
check:
    pnpm run venv
    npx tsc --noEmit

# type check Python with mypy
check-py:
    mypy

# run all linters (TypeScript + Python)
lint:
    npx tsc --noEmit
    black --check dash_prism tests
    mypy

# Remove dist & build directories
clean:
    rm -rf dist
    rm -rf build

# Install package in editable mode with test dependencies
install-test:
    source .venv/bin/activate && pip install -e .[test]

# Run unit tests
test-unit:
    source .venv/bin/activate && pip install -e . -q && pytest tests/ --ignore=tests/integration/ -v

# Run TypeScript unit tests
test-ts:
    pnpm run test:ts

# Run Python unit tests only
test-py:
    source .venv/bin/activate && pip install -e . -q && pytest tests/ --ignore=tests/integration/ -v

# Run integration tests (requires chromedriver) - uses 4 parallel workers
test-integration:
    source .venv/bin/activate && pip install -e . -q && pytest tests/integration/ -v -n auto --dist loadfile --reruns 2 --reruns-delay 1

# Run integration tests sequentially (for debugging)
test-integration-seq:
    source .venv/bin/activate && pip install -e . -q && pytest tests/integration/ -v

# Run all tests (Python + TypeScript)
test:
    pnpm run test:ts
    source .venv/bin/activate && pip install -e . -q && pytest tests/ -v --ignore=tests/integration/
    source .venv/bin/activate && pytest tests/integration/ -v -n auto --dist loadfile --reruns 2 --reruns-delay 1

# Run tests with coverage report
coverage:
    source .venv/bin/activate && pip install -e . -q && pytest tests/ --cov=dash_prism --cov-report=html --cov-report=term --ignore=tests/integration/
    @echo "Coverage report generated in htmlcov/index.html"

# Run integration tests with coverage (sequential for accurate coverage)
coverage-integration:
    source .venv/bin/activate && pip install -e . -q && pytest tests/integration/ --cov=dash_prism --cov-report=html --cov-report=term
    @echo "Coverage report generated in htmlcov/index.html"

# Open coverage report in browser
coverage-open:
    open htmlcov/index.html
