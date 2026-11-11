import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
const ReactCompilerConfig = {
    target: "19",
};
export default defineConfig({
    base: "/tools/erd-forge/app/",
    plugins: [
        react({
            babel: {
                plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
            },
        }),
        VitePWA({
            registerType: "autoUpdate",
            base: "/tools/erd-forge/app/",
            scope: "/tools/erd-forge/app/",
            workbox: {
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                navigateFallback: "/tools/erd-forge/app/index.html",
                navigateFallbackAllowlist: [/^\/tools\/erd-forge\/app/],
            },
            manifest: {
                name: "ERD Forge",
                short_name: "ERDForge",
                start_url: "/tools/erd-forge/app/",
                scope: "/tools/erd-forge/app/",
                theme_color: "#1a1a2e",
                background_color: "#0f0f1a",
                display: "standalone",
                icons: [
                    { src: "/tools/erd-forge/app/icons/icon-192.png", sizes: "192x192", type: "image/png" },
                    { src: "/tools/erd-forge/app/icons/icon-512.png", sizes: "512x512", type: "image/png" },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    optimizeDeps: {
        exclude: ["@guanmingchiu/sqlparser-ts", "@sqlite.org/sqlite-wasm"],
    },
    build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                manualChunks: {
                    "sql-parser": ["node-sql-parser"],
                    "react-flow": ["@xyflow/react"],
                    codemirror: ["@codemirror/state", "@codemirror/view", "@codemirror/language", "@codemirror/commands"],
                },
            },
        },
    },
    server: {
        headers: {
            // Cross-origin isolation headers for high-performance WebAssembly
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    preview: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    worker: {
        format: "es",
    },
});
