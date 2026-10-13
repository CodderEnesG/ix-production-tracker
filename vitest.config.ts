import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
  },
});
