import { defineConfig } from 'vitest/config';

// Unit tests only. Browser tests in e2e/ run under Playwright.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
