import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import ts from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    // Generated/vendored output, virtualenvs and docs are not linted. The webpack
    // config is CommonJS with browser globals and its own formatting, so it is
    // skipped too; vitest.config.ts is ordinary ESM TypeScript and stays linted.
    // .claude/ is local tool state (gitignored) and can hold whole worktrees.
    ignores: [
      'dash_prism/**',
      'docs/**',
      'node_modules/**',
      '.venv/**',
      'dist/**',
      '**/htmlcov/**',
      '**/coverage/**',
      'internal_docs/**',
      '.claude/**',
      'webpack.config.js',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      react,
      prettier,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      'prettier/prettier': 'error',
      'default-case': 'error',
      'no-console': 'error',
      curly: ['error', 'multi-line'],
      '@typescript-eslint/array-type': [
        'error',
        { default: 'array-simple', readonly: 'array-simple' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Underscore-prefixed names are the conventional "intentionally unused" marker.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // eslint-plugin-react-hooks 7 ships React Compiler rules in `recommended`.
      // This project does not use the compiler, and these rules fire on patterns
      // that are correct without it (dnd-kit's setNodeRef, a ref mirror written in
      // render, resetting state when new children arrive, an icon component looked
      // up from a static table). `exhaustive-deps` and `rules-of-hooks` stay on,
      // and `exhaustive-deps` is an error (the recommended preset only warns,
      // which would let the stale-closure bug fixed in 02 A-4 through CI).
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    // The config files outside src/ts need a default export, because their tools read it.
    files: ['src/ts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use a named export (typescript-style, Modules).',
        },
      ],
    },
  },
  {
    // Rules that need type information run on the project files only.
    files: ['src/ts/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A default branch does not count. A switch over a union lists every member.
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // A concise arrow body that calls a function stays legal, because the JSX event
      // handlers use it. Outside JSX, a block body shows that the result is not used.
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreVoidOperator: true, ignoreArrowShorthand: true },
      ],
    },
  },
  {
    // The logger is the one place that may call the console.
    files: ['src/ts/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },
];
