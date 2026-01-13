import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import tailwind from 'eslint-plugin-tailwindcss';
import ts from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      react,
      tailwind,
      prettier,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...tailwind.configs.recommended.rules,
      'prettier/prettier': 'error',
      // your custom rules...
    },
    settings: {
      react: { version: 'detect' },
    },
  },
];