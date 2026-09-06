import { plugins } from "eslint-config-airbnb-extended";
import config, { documentation } from "./eslint.config.mjs";

// Keep scope and documentation policy identical to the full Airbnb configuration.
export default [
  config[0],
  {
    ...plugins.typescriptEslint,
    files: documentation.files,
    ignores: documentation.ignores,
  },
  documentation,
];
