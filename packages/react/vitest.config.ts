import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'pptx-viewer-core': path.resolve(__dirname, '../core/src/index.ts'),
			'emf-converter': path.resolve(__dirname, '../emf-converter/src/index.ts'),
			'mtx-decompressor': path.resolve(__dirname, '../mtx-decompressor/src/index.ts'),
		},
	},
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
	},
});
