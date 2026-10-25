import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['components/**/*.test.tsx', 'server/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
