module.exports = {
  env: {
    node: true,
    es2020: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:unicorn/recommended',
    'plugin:sonarjs/recommended',
    'plugin:regexp/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['import', 'unicorn', 'sonarjs', 'regexp', '@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  rules: {
    // import
    'import/no-unresolved': 'off',

    // unicorns
    // keep regex literals safe
    'unicorn/no-unsafe-regex': 'off',
    // allow abbreviations
    'unicorn/prevent-abbreviations': 'off',
    // lowercase number formatting for octal, hex, binary (0x1'error' instead of 0X1'error')
    'unicorn/number-literal-case': 'error',
    // String methods startsWith/endsWith instead of more complicated stuff
    'unicorn/prefer-starts-ends-with': 'error',
  },
}
