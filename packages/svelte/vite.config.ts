import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Library build for `pptx-svelte-viewer`.
 *
 * Mirrors the Vue package's approach:
 *  - `.`        - top-level barrel (component + theme helpers)
 *  - `./viewer` - viewer sub-package barrel
 *  - `./i18n`   - shared dictionary + translator helpers
 *
 * The internal workspace packages (`pptx-viewer-core`, `pptx-viewer-shared`)
 * are intentionally NOT external; they are bundled in so consumers can
 * install just `pptx-svelte-viewer` without pulling them from npm. Their
 * `.d.ts` types are inlined via vite-plugin-dts `bundledPackages`.
 *
 * Unlike the Vue/React packages, only an ESM bundle is emitted: Svelte 5's
 * client runtime (`svelte/internal/client`) is ESM-only, so a CJS artifact
 * could never be `require()`d successfully anyway.
 *
 * Component CSS is compiled with `css: 'injected'`, so consumers do not need
 * a separate stylesheet import.
 */
const INTERNAL_BUNDLED = ['pptx-viewer-core', 'pptx-viewer-shared'];

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: { css: 'injected' },
		}),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
			// Bundle each entry's declarations into one .d.ts per entry, inlining
			// the internal (never-published) workspace packages' types.
			bundleTypes: { bundledPackages: INTERNAL_BUNDLED },
			exclude: ['**/*.test.ts', 'vite.config.ts', 'vitest.config.ts'],
		}),
	],
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, 'src/index.ts'),
				'viewer/index': resolve(__dirname, 'src/viewer/index.ts'),
				i18n: resolve(__dirname, 'src/i18n.ts'),
			},
			formats: ['es'],
			fileName: (_format, entryName) => `${entryName}.js`,
		},
		sourcemap: false,
		emptyOutDir: true,
		minify: 'esbuild',
		rollupOptions: {
			external: [
				'svelte',
				/^svelte\//u,
				'jszip',
				'fast-xml-parser',
				// PNG/PDF export libraries: both are dynamically `import()`-ed only
				// when export is actually used (see viewer/export/render-to-canvas.ts
				// and export-controller.svelte.ts). Kept external so they stay real
				// dynamic imports instead of being inlined into the main chunk.
				'html2canvas-pro',
				'jspdf',
			],
		},
	},
});
