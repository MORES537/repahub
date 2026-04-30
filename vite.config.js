import { defineConfig } from 'vite'
export default defineConfig({
  server: { port: 3000 },
  build: { outDir: 'dist' },
  define: { 
    global: 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      buffer: 'buffer/'
    }
  },
  optimizeDeps: {
    include: ['hashconnect', '@hashgraph/sdk', 'buffer']
  }
})
