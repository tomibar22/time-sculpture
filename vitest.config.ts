import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      include: ['src/engine/**'],
      exclude: ['src/engine/**/*.test.ts', 'src/engine/index.ts'],
    },
  },
});
