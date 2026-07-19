import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Read once at config-eval time so `__PPTX_SVELTE_VIEWER_VERSION__` (see
// `src/build-info.d.ts`) always reflects this package's own version, with no
// separate value to keep in sync. Used by AccountPage.svelte's About section.
const pkgVersion = (
	JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }
).version;

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
 * `.d.ts` types are inlined by the post-build Rollup declaration pass.
 *
 * Unlike the Vue/React packages, only an ESM bundle is emitted: Svelte 5's
 * client runtime (`svelte/internal/client`) is ESM-only, so a CJS artifact
 * could never be `require()`d successfully anyway.
 *
 * Component CSS is compiled with `css: 'external'` and extracted to
 * `dist/pptx-svelte-viewer.css`, matching how the React/Vue/Vanilla packages
 * ship a real stylesheet consumers import explicitly. Runtime style injection
 * (`css: 'injected'`) was tried first but is unreliable once this package is
 * consumed as an actual npm dependency: the injected `<style>` tag is created
 * by a mount-time effect (not present at SSR time), so a strict CSP with no
 * matching nonce silently drops it, and because it lands in `<head>` late it
 * can lose cascade-order fights against a host app's own global CSS (e.g. a
 * reset) despite matching specificity. A build-time stylesheet sidesteps all
 * of that.
 */
export default defineConfig({
	define: {
		__PPTX_SVELTE_VIEWER_VERSION__: JSON.stringify(pkgVersion),
	},
	plugins: [
		svelte({
			compilerOptions: { css: 'external' },
		}),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
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
				// Optional AI SDK peers, reachable only through the lazily-loaded
				// AI panel chunk. Kept external so the dynamic `import('ai')` inside
				// shared stays a real optional runtime import and `@ai-sdk/svelte`'s
				// runes `Chat` is never inlined into the base bundle.
				'ai',
				/^@ai-sdk\//u,
			],
		},
	},
});
