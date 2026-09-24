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
		// Never auto-bump onto a sibling demo's port when this one is busy: an
		// Angular server that lands on 4175 is indistinguishable from the Vue demo
		// to the e2e harness, which then fails every Vue spec against stale dist.
		strictPort: true,
		open: true,
	},
	build: {
		chunkSizeWarningLimit: 2500,
	},
	optimizeDeps: {
		// `emf-converter`'s Node fallback path does a guarded, try/caught
		// `import('@napi-rs/canvas')` (an optional dependency this repo never
		// installs; browsers use OffscreenCanvas/HTMLCanvasElement instead).
		// Vite's dep pre-bundler re-runs its own import-analysis over the
		// bundled output and no longer sees the source's `/* @vite-ignore */`
		// hint next to the call, so it 500s on "Failed to resolve import
		// '@napi-rs/canvas'" the moment emf-converter is pulled into the
		// dep graph (any EMF/WMF picture, poster frame, or OLE preview
		// image). Excluding it from pre-bundling serves it as source, where
		// the ignore hint is still adjacent to the dynamic import and Vite
		// skips the check.
		exclude: ['emf-converter'],
	},
	resolve: {
		alias: {
			'pptx-viewer-core/converter': path.resolve(
				__dirname,
				'../../packages/core/src/converter/index.ts',
			),
			'pptx-viewer-core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
			'pptx-viewer-locales': path.resolve(__dirname, '../../packages/locales/src/index.ts'),
			'pptx-react-viewer/i18n': path.resolve(__dirname, '../../packages/react/src/i18n.ts'),
			'pptx-react-viewer': path.resolve(__dirname, '../../packages/react/src/index.ts'),
		},
	},
});
