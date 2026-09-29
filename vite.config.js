import { defineConfig } from 'vite';
export default defineConfig({ root: 'static', envDir: '..', build: { outDir: '../dist', emptyOutDir: true } });
