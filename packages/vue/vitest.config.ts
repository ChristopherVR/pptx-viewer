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
		alias: {
			'pptx-viewer-core': resolve(__dirname, '../core/src/index.ts'),
		},
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/*.test.{ts,tsx}'],
		setupFiles: ['./src/test-setup.ts'],
	},
});
