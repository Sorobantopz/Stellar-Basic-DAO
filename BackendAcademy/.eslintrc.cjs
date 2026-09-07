/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**'],
  rules: {
    // The codebase predates strict typing; blanket `any` usage is pervasive
    // and the NestJS service layer relies on it heavily. Keep these off so
    // lint errors stay meaningful (real bugs) rather than stylistic noise.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
  },
};
