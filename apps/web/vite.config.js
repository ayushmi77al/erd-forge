import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    base: '/tools/erd-forge/app/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            base: '/tools/erd-forge/app/',
            scope: '/tools/erd-forge/app/',
            workbox: {
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                navigateFallback: '/tools/erd-forge/app/index.html',
                navigateFallbackAllowlist: [/^\/tools\/erd-forge\/app/],
            },
            manifest: {
                name: 'ERD Forge',
                short_name: 'ERDForge',
                start_url: '/tools/erd-forge/app/',
                scope: '/tools/erd-forge/app/',
                theme_color: '#1a1a2e',
                background_color: '#0f0f1a',
                display: 'standalone',
                icons: [
                    { src: '/tools/erd-forge/app/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/tools/erd-forge/app/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                manualChunks: {
                    'sql-parser': ['node-sql-parser'],
                    'react-flow': ['@xyflow/react'],
                    'codemirror': ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/commands'],
                },
            },
        },
    },
    server: {
        headers: {
            // REQUIRED for wa-sqlite OPFS
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    preview: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    worker: {
        format: 'es',
    },
});
