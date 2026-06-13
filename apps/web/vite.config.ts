import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Placeholderer',
        short_name: 'Placeholderer',
        theme_color: '#1a1a2e'
      }
    })
  ]
});