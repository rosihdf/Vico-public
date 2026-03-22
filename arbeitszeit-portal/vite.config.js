import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { vicoVersionPlugin, getAppVersion, getAppReleaseLabel } from '../scripts/vite-plugin-version.mjs';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var repoRoot = path.resolve(__dirname, '..');
var appVersion = getAppVersion(__dirname);
var appReleaseLabel = getAppReleaseLabel(__dirname);
/** Fester Port für das Arbeitszeitenportal (Dev + Preview). Haupt-App 5173, Admin 5175, Kundenportal 5174. */
var PORT = 5176;
/// <reference types="vitest" />
export default defineConfig(function (_a) {
    var _b, _c, _d, _e, _f;
    var mode = _a.mode;
    var env = loadEnv(mode, __dirname, '');
    return {
        envDir: __dirname,
        test: {
            globals: true,
            environment: 'node',
        },
        server: {
            port: PORT,
            strictPort: true,
            open: true,
            host: true,
            fs: {
                allow: [__dirname, repoRoot],
            },
        },
        preview: {
            port: 4176,
            strictPort: false,
        },
        plugins: [react(), vicoVersionPlugin(__dirname)],
        resolve: {
            alias: {
                react: path.resolve(__dirname, 'node_modules/react'),
                'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
                '@supabase/supabase-js': path.resolve(__dirname, 'node_modules/@supabase/supabase-js'),
                jspdf: path.resolve(__dirname, 'node_modules/jspdf'),
            },
        },
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
            __APP_RELEASE_LABEL__: JSON.stringify(appReleaseLabel),
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify((_b = env.VITE_SUPABASE_URL) !== null && _b !== void 0 ? _b : ''),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify((_c = env.VITE_SUPABASE_ANON_KEY) !== null && _c !== void 0 ? _c : ''),
            'import.meta.env.VITE_LICENSE_API_URL': JSON.stringify((_d = env.VITE_LICENSE_API_URL) !== null && _d !== void 0 ? _d : ''),
            'import.meta.env.VITE_LICENSE_NUMBER': JSON.stringify((_e = env.VITE_LICENSE_NUMBER) !== null && _e !== void 0 ? _e : ''),
            'import.meta.env.VITE_LICENSE_API_KEY': JSON.stringify((_f = env.VITE_LICENSE_API_KEY) !== null && _f !== void 0 ? _f : ''),
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'react-vendor': ['react', 'react-dom'],
                        'router': ['react-router-dom'],
                        'supabase': ['@supabase/supabase-js'],
                    },
                },
            },
            chunkSizeWarningLimit: 400,
        },
    };
});
