import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/ts/**/*.test.ts', 'src/ts/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'dash_prism'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/ts/**/*.ts'],
      exclude: ['src/ts/**/*.test.ts', 'src/ts/**/*.spec.ts', 'src/ts/index.ts'],
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
