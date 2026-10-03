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
    // Delete this override when no selector targets .SplitPane or .Resizer.
    'selector-class-pattern': null,
    // Delete this override when the rules for the svg elements of the tab bar buttons and of the
    // tab triggers are scoped. The rule reports selectors that never match the same element.
    'no-descending-specificity': null,
    // Set this rule to true when the SplitPane rule and the print block no longer use !important.
    'declaration-no-important': null,
    // Enable `property-disallowed-list: ['/^-ms-/']` when .scrollbar-none no longer sets
    // -ms-overflow-style.
  },
};
