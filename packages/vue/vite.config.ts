import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import terser from '@rollup/plugin-terser';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

function readSourceFile(path: string): string | undefined {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return undefined;
	}
}

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
 * are intentionally NOT external; they are bundled in so consumers can
 * install just `pptx-vue-viewer` without pulling them from npm. Their `.d.ts`
 * types are likewise inlined via vite-plugin-dts `bundledPackages`, matching
 * the React package's tsup `noExternal` behaviour.
 */
const INTERNAL_BUNDLED = ['pptx-viewer-core', 'pptx-viewer-shared'];

export default defineConfig({
	plugins: [
		vue({
			script: {
				fs: {
					fileExists: existsSync,
					readFile: readSourceFile,
					realpath: realpathSync,
				},
			},
		}),
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
				i18n: resolve(__dirname, 'src/i18n.ts'),
				'composables-unstable': resolve(__dirname, 'src/composables-unstable.ts'),
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
		},
		sourcemap: false,
		emptyOutDir: true,
		// Vite's built-in minify (esbuild or terser) is NOT applied to the ESM
		// output in lib mode, leaving the .js bundle ~50% larger than the .cjs
		// one. Run terser as a rollup output plugin instead so every emitted
		// chunk (ESM and CJS) is minified uniformly. `minify: false` avoids a
		// redundant esbuild pass on the CJS output.
		minify: false,
		rollupOptions: {
			// Rolldown (Vite 8) panics when tree-shaking symbols that span the
			// entry-point / dynamic-chunk boundary created by the SmartArt3D
			// lazy import + three.js external. Disabling tree-shaking keeps every
			// symbol in its declaring chunk and avoids the finalizer panic.
			treeshake: false,
			plugins: [terser({ format: { comments: false } })],
			external: [
				'vue',
				'lucide-vue-next',
				'jspdf',
				'html2canvas-pro',
				'jszip',
				'fast-xml-parser',
				'dompurify',
				'clsx',
				'tailwind-merge',
				'yjs',
				'y-websocket',
				// Optional peer behind the lazily-imported `pptx-viewer-shared/
				// smartart-3d` scene; keep it external so it is never bundled and
				// the SmartArt 3D chunk resolves it from the host's node_modules.
				'three',
				/^three\//u,
			],
			output: {
				globals: { vue: 'Vue' },
				assetFileNames: 'pptx-vue-viewer[extname]',
			},
		},
	},
});
