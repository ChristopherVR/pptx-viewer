import { resolve } from 'node:path';

import { defineConfig } from 'vite';

/**
 * PowerPoint-parity harness for the shared `<pptx-three-view>` scenes.
 *
 * Serves `e2e/fixtures` (the ground-truth decks + COM-exported PNGs live in
 * `e2e/fixtures/three-d-parity/`) and aliases every workspace package to its
 * source, so shared scene edits hot-reload with no build step.
 */
const pkg = (...p: string[]) => resolve(__dirname, '..', '..', 'packages', ...p);

export default defineConfig({
	root: __dirname,
	publicDir: resolve(__dirname, '..', '..', 'e2e', 'fixtures'),
	server: { port: 4178, strictPort: true },
	resolve: {
		alias: [
			{ find: 'pptx-viewer-core', replacement: pkg('core', 'src', 'index.ts') },
			{ find: 'pptx-viewer-shared/i18n', replacement: pkg('shared', 'src', 'i18n', 'index.ts') },
			{ find: 'pptx-viewer-shared', replacement: pkg('shared', 'src', 'index.ts') },
		],
	},
	optimizeDeps: {
		include: ['jszip', 'fast-xml-parser', 'three'],
		// Same as the binding demos: a pre-bundled emf-converter 500s on its
		// guarded optional `import('@napi-rs/canvas')`.
		exclude: ['emf-converter'],
	},
});
