import base from "./jest.config";

export default {
  ...base,
  testRegex: ".*\\.e2e-spec\\.ts$",
  setupFiles: [...base.setupFiles, "<rootDir>/jest.e2e.setup.ts"],
};
