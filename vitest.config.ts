import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      './packages/shared/vitest.config.ts',
      './apps/web/vitest.config.ts',
      './n8n/normalizers/vitest.config.mts',
      './scripts/vitest.config.ts',
      {
        test: {
          name: 'brand-tokens',
          environment: 'node',
          include: ['scripts/brand-tokens.test.ts'],
        },
      },
    ],
  },
});
