import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/** Package version, baked into the bundle as `__PPTX_PACKAGE_VERSION__` (see `src/version.ts`). */
const pkgVersion = (
	JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
).version;

export default defineConfig({
	define: {
		__PPTX_PACKAGE_VERSION__: JSON.stringify(pkgVersion),
	},
	plugins: [vue()],
	resolve: {
		// Test against workspace sources (not dists) so the suite never runs
		// against stale build output. Mirrors the Vanilla package's vitest setup.
		// Subpath aliases must come first (first match wins).
		alias: [
			{
				find: 'pptx-viewer-shared/i18n',
				replacement: resolve(__dirname, '../shared/src/i18n/index.ts'),
			},
			{
				find: 'pptx-viewer-shared/smartart-3d',
				replacement: resolve(__dirname, '../shared/src/smartart-3d/index.ts'),
			},
			{ find: 'pptx-viewer-shared', replacement: resolve(__dirname, '../shared/src/index.ts') },
			{ find: 'pptx-viewer-core', replacement: resolve(__dirname, '../core/src/index.ts') },
		],
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/*.test.{ts,tsx}'],
		setupFiles: ['./src/test-setup.ts'],
	},
});
