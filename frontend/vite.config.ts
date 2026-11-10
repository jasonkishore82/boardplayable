import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js lands in the lazily-loaded 3D chunk, which is expected to be large.
    chunkSizeWarningLimit: 1200,
  },
})
