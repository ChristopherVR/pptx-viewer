import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'pptx-viewer-core': path.resolve(__dirname, '../core/src/index.ts'),
			'pptx-viewer-shared/i18n': path.resolve(__dirname, '../shared/src/i18n/index.ts'),
			'pptx-viewer-shared/ai': path.resolve(__dirname, '../shared/src/ai/index.ts'),
			'pptx-viewer-shared': path.resolve(__dirname, '../shared/src/index.ts'),
		},
	},
	test: {
		globals: true,
		include: ['src/**/*.test.{ts,tsx}'],
	},
});
