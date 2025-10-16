import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['apps/gateway/test/**/*.test.ts'],
    setupFiles: ['apps/gateway/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
