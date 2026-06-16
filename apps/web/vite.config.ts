import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project site at https://zdoss.github.io/Placeholderer/,
// so all asset URLs and the PWA manifest need to be prefixed with the
// repo name. Without this, the JS/CSS chunks and the service worker scope
// resolve against '/' and 404.
const REPO_NAME = '/Placeholderer/';

export default defineConfig({
  base: REPO_NAME,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Placeholderer',
        short_name: 'Placeholderer',
        start_url: REPO_NAME,
        scope: REPO_NAME,
        theme_color: '#1a1a2e'
      }
    })
  ]
});