/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@firelancer/eslint-config/backend.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.lint.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "no-useless-catch": "off", // Disable the rule globally
  },
};
