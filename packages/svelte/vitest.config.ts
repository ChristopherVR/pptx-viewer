import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ compilerOptions: { css: 'injected' } })],
	resolve: {
		// Test against workspace sources (not dists) so the suite never runs
		// against stale build output. Mirrors the Vue/Vanilla packages' vitest
		// setup. Subpath aliases must come first (first match wins).
		alias: [
			{
				find: 'pptx-viewer-shared/i18n',
				replacement: resolve(__dirname, '../shared/src/i18n/index.ts'),
			},
			{
				find: 'pptx-viewer-shared/smartart-3d',
				replacement: resolve(__dirname, '../shared/src/smartart-3d/index.ts'),
			},
			{
				find: 'pptx-viewer-shared/ai',
				replacement: resolve(__dirname, '../shared/src/ai/index.ts'),
			},
			{ find: 'pptx-viewer-shared', replacement: resolve(__dirname, '../shared/src/index.ts') },
			{ find: 'pptx-viewer-core', replacement: resolve(__dirname, '../core/src/index.ts') },
		],
		// Svelte 5 ships separate client/server runtimes; without the browser
		// condition Vitest resolves the server runtime and `mount()` throws.
		conditions: ['browser'],
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		// The component suite parses a real .pptx fixture per test.
		testTimeout: 30000,
	},
});
