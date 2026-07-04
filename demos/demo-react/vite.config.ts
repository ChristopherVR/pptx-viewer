import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { buildStamp } from '../build-stamp';

export default defineConfig({
	root: __dirname,
	// Served from the repo root locally ("/"), but under "/pptx-viewer/demo/" when
	// deployed to GitHub Pages. CI sets DEMO_BASE to the subpath.
	base: process.env.DEMO_BASE ?? '/',
	plugins: [
		react(),
		tailwindcss(),
		buildStamp(path.resolve(__dirname, '../../packages/react/package.json')),
	],
	server: {
		port: 4173,
		open: true,
	},
	build: {
		chunkSizeWarningLimit: 2500,
	},
	resolve: {
		alias: {
			'pptx-viewer-core/converter': path.resolve(
				__dirname,
				'../../packages/core/src/converter/index.ts',
			),
			'pptx-viewer-core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
			'pptx-react-viewer/i18n': path.resolve(__dirname, '../../packages/react/src/i18n.ts'),
			'pptx-react-viewer': path.resolve(__dirname, '../../packages/react/src/index.ts'),
		},
	},
});
