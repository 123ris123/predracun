import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // za Vercel držimo root. Nemoj stavljati `base` na podputanju.
  build: { outDir: 'dist' }
})
