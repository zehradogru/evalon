import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        host: true, // needed for WebView access
        proxy: {
            '/api': {
                // Use IPv4 loopback to avoid localhost->::1 resolution mismatches.
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
                chart: resolve(__dirname, 'chart.html'),
                backtest: resolve(__dirname, 'backtest.html'),
                ai: resolve(__dirname, 'ai.html'),
            },
        },
    },
});
