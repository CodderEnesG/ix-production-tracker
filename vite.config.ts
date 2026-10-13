import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The Hono API runs on its own port in development (see server/dev.ts).
    proxy: { '/api': 'http://localhost:8787' },
  },
});
