import { resolve } from 'node:path';

import { defineConfig } from 'vite';

import { buildStamp } from '../build-stamp';

/**
 * Vite dev server / build for the pptx-vanilla-viewer demo.
 *
 * Mirrors the Vue demo setup: the bare package specifiers are aliased to the
 * library **source** so the demo hot-reloads against live edits without a
 * rebuild. (Published consumers resolve these via the package's `dist`
 * `exports` instead.)
 */
const pkg = (...p: string[]) => resolve(__dirname, '..', '..', 'packages', ...p);

export default defineConfig({
	root: __dirname,
	// Served from a subpath (e.g. /pptx-viewer/demo-vanilla/) on GitHub Pages.
	base: process.env.DEMO_BASE ?? '/',
	// The repo-wide .gitignore excludes public/ dirs, so the sample deck is
	// served straight from the committed e2e fixtures instead.
	publicDir: resolve(__dirname, '..', '..', 'e2e', 'fixtures'),
	plugins: [buildStamp(pkg('vanilla', 'package.json'))],
	server: {
		port: 4176,
		open: true,
	},
	build: {
		chunkSizeWarningLimit: 2500,
	},
	resolve: {
		// Order matters: more specific subpath aliases must precede the bare ones.
		alias: [
			{ find: 'pptx-vanilla-viewer', replacement: pkg('vanilla', 'src', 'index.ts') },
			{
				find: 'pptx-viewer-core/converter',
				replacement: pkg('core', 'src', 'converter', 'index.ts'),
			},
			{ find: 'pptx-viewer-core', replacement: pkg('core', 'src', 'index.ts') },
			{
				find: 'pptx-viewer-shared/smartart-3d',
				replacement: pkg('shared', 'src', 'smartart-3d', 'index.ts'),
			},
			{ find: 'pptx-viewer-shared/i18n', replacement: pkg('shared', 'src', 'i18n', 'index.ts') },
			{ find: 'pptx-viewer-shared', replacement: pkg('shared', 'src', 'index.ts') },
		],
	},
	optimizeDeps: {
		include: ['jszip', 'fast-xml-parser'],
	},
});
