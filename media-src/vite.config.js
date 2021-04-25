import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [legacy({
	  targets: ['defaults']
  })],
  // ...
  build: {
    outDir: '../media/dist',
    emptyOutDir: true,
    manifest: true,
  },
})
