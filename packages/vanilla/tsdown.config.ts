import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	outDir: '.types',
	minify: true,
	dts: { emitDtsOnly: true },
	deps: {
		dts: { alwaysBundle: ['pptx-viewer-core', 'pptx-viewer-shared'] },
	},
	sourcemap: false,
	clean: !options.watch,
	// Bundle the internal workspace packages so consumers can install just
	// `pptx-vanilla-viewer` without also pulling `pptx-viewer-core` from npm.
	treeshake: true,
	platform: 'browser',
}));
