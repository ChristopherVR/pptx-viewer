import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
	root: __dirname,
	plugins: [react(), tailwindcss()],
	server: {
		port: 4173,
		open: true,
	},
	resolve: {
		alias: {
			'pptx-viewer-core/converter': path.resolve(__dirname, '../packages/core/src/converter/index.ts'),
			'pptx-viewer-core': path.resolve(__dirname, '../packages/core/src/index.ts'),
			'pptx-viewer': path.resolve(__dirname, '../packages/react/src/index.ts'),
			'emf-converter': path.resolve(__dirname, '../packages/emf-converter/src/index.ts'),
		},
	},
});
