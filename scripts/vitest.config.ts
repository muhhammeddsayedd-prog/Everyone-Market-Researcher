import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'seed-scripts',
    environment: 'node',
    include: ['seed/**/*.test.ts'],
  },
});
