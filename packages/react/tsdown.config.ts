import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/viewer/index.ts', 'src/i18n.ts', 'src/internals.ts'],
	format: ['esm', 'cjs'],
	outDir: '.types',
	minify: false,
	dts: { emitDtsOnly: true },
	deps: {
		neverBundle: ['pptx-viewer-core', 'pptx-viewer-shared'],
	},
	sourcemap: false,
	clean: !options.watch,
	// Bundle the internal workspace packages so consumers can install just
	// `pptx-react-viewer` without also pulling `pptx-viewer-core` from npm.
	// (`emf-converter` / `mtx-decompressor` are no longer bundled into core's
	// dist (core now imports them from npm) but since they're not listed as
	// external above, they get inlined here too, keeping this package
	// self-contained.)
	treeshake: true,
	platform: 'browser',
}));
