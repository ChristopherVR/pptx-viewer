import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

import { buildStamp } from '../build-stamp';

/**
 * Vite dev server / build for the pptx-svelte-viewer demo.
 *
 * Mirrors the other demos: the bare package specifiers are aliased to the
 * library **source** so the demo hot-reloads against live edits without a
 * rebuild. The svelte plugin compiles both the demo and the aliased
 * `pptx-svelte-viewer` SFCs.
 */
const pkg = (...p: string[]) => resolve(__dirname, '..', '..', 'packages', ...p);

export default defineConfig({
	root: __dirname,
	// Served from a subpath (e.g. /pptx-viewer/demo-svelte/) on GitHub Pages.
	base: process.env.DEMO_BASE ?? '/',
	// The repo-wide .gitignore excludes public/ dirs, so the sample deck is
	// served straight from the committed e2e fixtures instead.
	publicDir: resolve(__dirname, '..', '..', 'e2e', 'fixtures'),
	plugins: [svelte(), buildStamp(pkg('svelte', 'package.json'))],
	server: {
		port: 4177,
		open: true,
	},
	build: {
		chunkSizeWarningLimit: 2500,
	},
	resolve: {
		// Order matters: more specific subpath aliases must precede the bare ones.
		alias: [
			{ find: 'pptx-svelte-viewer/i18n', replacement: pkg('svelte', 'src', 'i18n.ts') },
			{ find: 'pptx-svelte-viewer', replacement: pkg('svelte', 'src', 'index.ts') },
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
