import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ compilerOptions: { css: 'injected' } })],
	resolve: {
		alias: {
			'pptx-viewer-core': resolve(__dirname, '../core/src/index.ts'),
		},
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
