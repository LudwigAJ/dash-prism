set dotenv-load := false

# The build, format, lint and test recipes call the package.json scripts. Those
# scripts hold the one definition of each command, and CI calls the same scripts.

# Install Poetry dependencies & node modules.
install:
    poetry install --with dev,test,docs,demo
    pnpm install

# Generate components and build the bundle
build:
    pnpm run build

# Build the webpack bundle
build-js:
    pnpm run build:js

# Generate the components
gen:
    pnpm run build:backends

# Rebuild the bundle on change
watch:
    pnpm run watch

# Build the sdist and the wheel into dist/
dist: clean build
    pnpm run dist

# Format the TypeScript sources
format:
    pnpm run format

# Format Python code with black
format-py:
    pnpm run format:py

# Type check TypeScript
check:
    pnpm run typecheck

# Type check Python with mypy
check-py:
    poetry run mypy

# Run all linters (Python + TypeScript)
lint:
    pnpm run lint

# Remove dist & build directories
clean:
    rm -rf dist
    rm -rf build

# Run Python unit tests
test-unit:
    pnpm run test:unit

# Run TypeScript unit tests
test-ts:
    pnpm run test:ts

# Run integration tests (requires chromedriver)
test-integration:
    pnpm run test:integration

# Run integration tests in one process (for debugging)
test-integration-seq:
    pnpm run test:integration -n 0

# Run all tests (TypeScript + Python)
test:
    pnpm run test:ts
    pnpm run test

# Open the coverage report that every pytest run writes
coverage-open:
    open htmlcov/index.html
