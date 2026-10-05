// The webpack entry. Dash reads Prism, PrismAction and PrismContent by name from window.dash_prism.
export { Prism } from './components/PrismComponent';
export { PrismAction } from './components/PrismActionComponent';
export { PrismContent } from './components/PrismContentComponent';
// tests/integration/test_error_boundary.py mounts ErrorBoundary from window.dash_prism, because
// no input of a running Prism makes it throw.
export { ErrorBoundary } from './components/ErrorBoundary';
