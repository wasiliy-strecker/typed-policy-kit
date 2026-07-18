import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/server/index.ts', 'src/shared/model.ts'],
      include: ['src/server/**', 'src/shared/**'],
      provider: 'v8',
      thresholds: {
        branches: 65,
        functions: 65,
        lines: 65,
        statements: 65,
      },
    },
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
})
