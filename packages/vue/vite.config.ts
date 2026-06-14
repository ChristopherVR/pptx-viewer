import { resolve } from 'node:path';

import terser from '@rollup/plugin-terser';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Library build for `pptx-vue-viewer`.
 *
 * Two entry points mirror the React package:
 *  - `.`        → top-level barrel (component + theme helpers)
 *  - `./viewer` → viewer sub-package barrel
 *
 * Everything that ships as a peer/optional dependency is marked external so
 * the bundle stays slim and host apps dedupe a single Vue instance.
 *
 * The internal workspace packages (`pptx-viewer-core`, `pptx-viewer-shared`)
 * are intentionally NOT external — they are bundled in so consumers can
 * install just `pptx-vue-viewer` without pulling them from npm. Their `.d.ts`
 * types are likewise inlined via vite-plugin-dts `bundledPackages`, matching
 * the React package's tsup `noExternal` behaviour.
 */
const INTERNAL_BUNDLED = ['pptx-viewer-core', 'pptx-viewer-shared'];

export default defineConfig({
	plugins: [
		vue(),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
			rollupTypes: true,
			bundledPackages: INTERNAL_BUNDLED,
			exclude: ['**/*.test.ts', 'vite.config.ts', 'vitest.config.ts'],
		}),
	],
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, 'src/index.ts'),
				'viewer/index': resolve(__dirname, 'src/viewer/index.ts'),
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
		},
		sourcemap: false,
		emptyOutDir: true,
		// Vite's built-in minify (esbuild or terser) is NOT applied to the ESM
		// output in lib mode, leaving the .js bundle ~50% larger than the .cjs
		// one. Run terser as a rollup output plugin instead so every emitted
		// chunk — ESM and CJS — is minified uniformly. `minify: false` avoids a
		// redundant esbuild pass on the CJS output.
		minify: false,
		rollupOptions: {
			plugins: [terser({ format: { comments: false } })],
			external: [
				'vue',
				'jspdf',
				'jszip',
				'fast-xml-parser',
				'dompurify',
				'clsx',
				'tailwind-merge',
				'yjs',
				'y-websocket',
			],
			output: {
				globals: { vue: 'Vue' },
				assetFileNames: 'pptx-vue-viewer[extname]',
			},
		},
	},
});
