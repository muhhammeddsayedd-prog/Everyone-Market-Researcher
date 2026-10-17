import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

// https://vitest.dev/guide/projects
export default defineProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    name: 'shared',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
