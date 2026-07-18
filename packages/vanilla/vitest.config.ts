import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: [
			// Test against workspace sources (not dists) so the suite never runs
			// against stale build output. Mirrors the Vue package's vitest setup.
			// Subpath aliases must come first (first match wins).
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
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
	},
});
