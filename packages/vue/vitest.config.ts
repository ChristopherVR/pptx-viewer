import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			'pptx-viewer-core': resolve(__dirname, '../core/src/index.ts'),
			'emf-converter': resolve(__dirname, '../emf-converter/src/index.ts'),
			'mtx-decompressor': resolve(__dirname, '../mtx-decompressor/src/index.ts'),
		},
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/*.test.{ts,tsx}'],
	},
});
