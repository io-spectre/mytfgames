import { defineConfig } from "vitest/config";

export default defineConfig({
  clearScreen: false,
  test: {
    projects: ["src/libs/*", "src/main", "src/renderer"],
  },
});
