import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: [
			{ find: 'pptx-vanilla-viewer', replacement: resolve(__dirname, 'src/index.ts') },
			// Test against workspace sources (not dists) so the suite never runs
			// against stale build output. Mirrors the Vue package's vitest setup.
			// Subpath aliases must come first (first match wins).
			{
				find: 'pptx-viewer-shared/i18n',
				replacement: resolve(__dirname, '../shared/src/i18n/index.ts'),
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
		maxWorkers: 4,
		// Most of this suite mounts a whole viewer (ribbon with its style
		// galleries, dialogs, canvas) in happy-dom: about a second locally but
		// 3.5-5.5s on the hosted CI runner, where vitest's 5s default failed five
		// tests in CI run 36183962014. Matches core and svelte, which set 30s.
		testTimeout: 30_000,
		include: ['src/**/*.test.ts', '../../demos/demo-vanilla/src/host-owned-inline-editor.test.ts'],
		setupFiles: ['./src/web-controls.test-setup.ts'],
	},
});
