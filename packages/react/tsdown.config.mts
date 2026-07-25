import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/viewer/index.ts', 'src/i18n.ts', 'src/internals.ts'],
	format: ['esm', 'cjs'],
	outDir: '.types',
	minify: false,
	dts: { emitDtsOnly: true },
	deps: {
		// `pptx-viewer-core` / `pptx-viewer-shared` root specifiers are kept external
		// here and inlined later by `scripts/bundle-declarations.mjs`. The
		// `pptx-viewer-shared/*` SUBPATHS (`/ai`, `/i18n`, `/smartart-3d`) are
		// deliberately absent: they resolve to built `.d.ts` that rollup-plugin-dts
		// cannot pick up from a bare specifier, so tsdown inlines them instead.
		//
		// `zod` rides in through `pptx-viewer-shared/ai` -> `pptx-viewer-mcp/schemas`.
		// None of its types survive tree-shaking into our public surface, but parsing
		// it emits a `CommonJS dts syntax` warning for every `zod/v4/locales/*.d.cts`
		// file (100+ lines of build noise), so cut it off at the import.
		neverBundle: ['pptx-viewer-core', 'pptx-viewer-shared', 'zod', /^zod\//],
		// The only dependencies expected to be inlined into the declarations are
		// `lib0` and `y-protocols`: neither is a dependency of this package, but their
		// types (`Observable`, `Awareness`) leak through the collaboration API, and
		// under isolated node_modules a consumer cannot resolve them by name. They
		// only appear in the declaration pass (not the fake-js pass), so an
		// `onlyBundle` allowlist would report itself as unused on every build; opt out
		// of the hint instead.
		onlyBundle: false,
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
