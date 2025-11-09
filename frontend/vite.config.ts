import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Adjust chunk size warning limit
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          vendor: ['framer-motion'], // Add other large dependencies here
        },
      },
    },
  },
  server: {
    port: 3000, // Default Vite dev server port
  },
  preview: {
    port: 3000, // Preview server port (for `vite preview` command)
  }
})