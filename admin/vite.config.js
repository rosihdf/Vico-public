import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { vicoVersionPlugin, getAppVersion } from '../scripts/vite-plugin-version.mjs';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var appVersion = getAppVersion(__dirname);
export default defineConfig(function (_a) {
    var _b, _c;
    var mode = _a.mode;
    var env = loadEnv(mode, __dirname, '');
    return {
        envDir: __dirname,
        server: {
            port: 5175,
            strictPort: true,
            open: true,
            host: true,
        },
        preview: {
            port: 4175,
            strictPort: false,
        },
        plugins: [react(), vicoVersionPlugin(__dirname)],
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify((_b = env.VITE_SUPABASE_URL) !== null && _b !== void 0 ? _b : ''),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify((_c = env.VITE_SUPABASE_ANON_KEY) !== null && _c !== void 0 ? _c : ''),
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'router': ['react-router-dom'],
                        'supabase': ['@supabase/supabase-js'],
                    },
                },
            },
            chunkSizeWarningLimit: 400,
        },
    };
});
