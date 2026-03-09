import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    server: {
        port: 5175,
        strictPort: true,
        open: true,
    },
    preview: {
        port: 4175,
        strictPort: false,
    },
    plugins: [react()],
});
