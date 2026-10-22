import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    testTimeout: 10_000,
    include: ["src/**/*.itest.ts", "src/**/*.test.ts"],
    passWithNoTests: true,
    watch: false
  }
})
