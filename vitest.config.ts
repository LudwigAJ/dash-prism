import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // The tests run in node and test pure logic only. Components and hooks that
    // render have no Vitest tests. The integration suite in tests/integration/
    // tests them in a browser.
    environment: 'node',
    include: ['src/ts/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'dash_prism'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Include the .tsx files, so that the figure is for all of the sources and
      // not only for the .ts files.
      include: ['src/ts/**/*.{ts,tsx}'],
      exclude: ['src/ts/**/*.test.ts', 'src/ts/store/testing.ts', 'src/ts/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@hooks': path.resolve(__dirname, 'src/ts/hooks'),
      '@components': path.resolve(__dirname, 'src/ts/components'),
      '@utils': path.resolve(__dirname, 'src/ts/utils'),
      '@types': path.resolve(__dirname, 'src/ts/types'),
      '@context': path.resolve(__dirname, 'src/ts/context'),
      '@constants': path.resolve(__dirname, 'src/ts/constants'),
      '@store': path.resolve(__dirname, 'src/ts/store'),
    },
  },
});
