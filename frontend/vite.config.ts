import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import controllerRelay from './server/controllerRelay.mjs'

export default defineConfig({
  // controllerRelay: dev-only phone controller for the gyro games (Free Fly, Free Flight, Cricket nets) (https :5180 for phones, http :5181 for games).
  plugins: [react(), controllerRelay()],
  build: {
    // three.js lands in the lazily-loaded 3D chunk, which is expected to be large.
    chunkSizeWarningLimit: 1200,
  },
})
