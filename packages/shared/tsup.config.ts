import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/theme/index.ts', 'src/loader/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	// pptx-viewer-core is a peer of every UI binding; keep it external so the
	// host app dedupes a single copy of the engine.
	external: ['pptx-viewer-core'],
	treeshake: true,
	platform: 'neutral',
}));
