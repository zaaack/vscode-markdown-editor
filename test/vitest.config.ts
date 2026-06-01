import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'backend/vscode-mock.ts'),
    },
  },
  test: {
    root: path.resolve(__dirname, '..'),
    include: ['test/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
  },
})
