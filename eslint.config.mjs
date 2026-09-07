import { configs, plugins } from "eslint-config-airbnb-extended";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";

// Share the strict documentation rules between both commands. Tests and external
// API declarations are outside this implementation-documentation pass.
export const documentation = {
  ...jsdoc.configs["flat/recommended-typescript-error"],
  files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts", "vite.config.ts"],
  ignores: ["**/*.test.ts", "**/*.d.ts"],
  settings: { jsdoc: { mode: "typescript" } },
  rules: {
    ...jsdoc.configs["flat/recommended-typescript-error"].rules,
    "jsdoc/tag-lines": ["error", "any", { startLines: 1 }],
    "jsdoc/require-jsdoc": [
      "error",
      {
        enableFixer: false,
        checkGetters: true,
        checkSetters: true,
        require: {
          FunctionDeclaration: true,
          FunctionExpression: true,
          ArrowFunctionExpression: true,
          ClassDeclaration: true,
          ClassExpression: true,
          MethodDefinition: true,
        },
      },
    ],
    "jsdoc/require-description": "error",
    "jsdoc/require-param-description": "error",
    "jsdoc/require-returns-description": "error",
  },
};

export default [
  {
    ignores: [
      "node_modules/**",
      ".worktrees/**",
      ".artifacts/**",
      "docs/**",
      "assets/**",
      "public/**",
      "web/**",
      "web-mvp/**",
      "dist/**",
      "*.mjs",
    ],
  },
  ...[
    plugins.stylistic,
    plugins.importX,
    plugins.typescriptEslint,
    ...configs.base.all,
    prettier,
  ].map((config) => ({
    ...config,
    files: documentation.files,
    ignores: documentation.ignores,
  })),
  documentation,
];
