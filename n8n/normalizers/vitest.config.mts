import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

// Explicit ESM config alongside the plain CommonJS helper files.
export default defineProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    name: 'normalizers',
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
