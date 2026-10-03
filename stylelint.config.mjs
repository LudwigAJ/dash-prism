export default {
  extends: ['stylelint-config-standard'],
  // A copy of the Tailwind preflight rules. See the comment at the top of the file.
  ignoreFiles: ['src/ts/preflight.css'],
  rules: {
    // The preset asks for @import url(...). Tailwind resolves `@import 'tailwindcss'` only in the
    // plain string form.
    'import-notation': 'string',
    // Tailwind 4 puts utility class names in the prelude of @apply.
    'at-rule-prelude-no-invalid': [true, { ignoreAtRules: ['media', 'apply'] }],
    // Tailwind 4 directives.
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'import',
          'tailwind',
          'apply',
          'layer',
          'custom-variant',
          'theme',
          'utility',
          'variant',
          'source',
        ],
      },
    ],
    // The svg rules of the tab triggers, the search bar and the two tab bar buttons never match the
    // same element. The rule reports them because the later selectors have lower specificity.
    'no-descending-specificity': null,
    'declaration-no-important': true,
    'property-disallowed-list': ['/^-ms-/'],
  },
};
