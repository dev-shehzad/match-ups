import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: "src/renderer/public", // Renderer public directory
  build: {
    outDir: 'dist-react',  // Vite React output directory
    assetsDir: "assets",
    rollupOptions: {

      external: ['electron', 'fs', 'os', 'os-utils'],  // Exclude these from bundling
    }
  },
  server: {
    port: 5123,
    strictPort: true,
  },
});
