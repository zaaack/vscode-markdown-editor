import { beforeEach } from 'vitest'
import { resetMockConfig } from './backend/vscode-mock'

// Global beforeEach hook for every test file. Resets the shared
// mockConfig (in test/backend/vscode-mock.ts) to its declared defaults so
// a `setMockConfig` call in one test can't quietly affect the next one.
//
// Loaded via the `setupFiles` entry in test/vitest.config.ts.
beforeEach(() => {
  resetMockConfig()
})
