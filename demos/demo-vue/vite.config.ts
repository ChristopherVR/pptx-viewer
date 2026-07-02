import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/**
 * Vite + Vue dev server / build for the pptx-vue-viewer demo.
 *
 * Mirrors the React `demo/` setup: the bare package specifiers are aliased to
 * the library **source** so the demo hot-reloads against live edits without a
 * rebuild. `@vitejs/plugin-vue` compiles both the demo and the aliased
 * `pptx-vue-viewer` SFCs. (Published consumers resolve these via the package's
 * `dist` `exports` instead.)
 */
const pkg = (...p: string[]) => resolve(__dirname, '..', '..', 'packages', ...p);

export default defineConfig({
	root: __dirname,
	// Served from a subpath (e.g. /pptx-viewer/demo-vue/) on GitHub Pages.
	// CI sets DEMO_BASE so the demo's asset URLs resolve under that subpath.
	base: process.env.DEMO_BASE ?? '/',
	plugins: [vue(), tailwindcss()],
	server: {
		port: 4175,
		open: true,
	},
	build: {
		chunkSizeWarningLimit: 2500,
	},
	resolve: {
		// Order matters: more specific subpath aliases must precede the bare ones.
		alias: [
			{
				find: /^pptx-vue-viewer\/styles(?<ext>\.css)?$/u,
				replacement: pkg('vue', 'src', 'styles', 'pptx-vue-viewer.css'),
			},
			{ find: 'pptx-vue-viewer/viewer', replacement: pkg('vue', 'src', 'viewer', 'index.ts') },
			{ find: 'pptx-vue-viewer', replacement: pkg('vue', 'src', 'index.ts') },
			{
				find: 'pptx-viewer-core/converter',
				replacement: pkg('core', 'src', 'converter', 'index.ts'),
			},
			{ find: 'pptx-viewer-core', replacement: pkg('core', 'src', 'index.ts') },
			// Subpath alias must come BEFORE the bare alias; otherwise the bare alias
			// matches first and the dynamic import becomes "…/index.ts/smartart-3d"
			// (a path on a file, not a directory), which Rolldown cannot resolve.
			{
				find: 'pptx-viewer-shared/smartart-3d',
				replacement: pkg('shared', 'src', 'smartart-3d', 'index.ts'),
			},
			{ find: 'pptx-viewer-shared/i18n', replacement: pkg('shared', 'src', 'i18n', 'index.ts') },
			{ find: 'pptx-viewer-shared', replacement: pkg('shared', 'src', 'index.ts') },
		],
	},
	optimizeDeps: {
		include: ['vue', 'jszip', 'fast-xml-parser'],
	},
});
