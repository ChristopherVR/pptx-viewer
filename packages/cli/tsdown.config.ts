import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/cli.ts'],
	format: ['esm', 'cjs'],
	outDir: '.types',
	dts: { emitDtsOnly: true },
	deps: {
		// Keep the re-exported `pptx-react-viewer` types as a reference, not
		// inlined: it's a real published package with its own `.d.ts`, so
		// there's nothing to bundle.
		neverBundle: ['pptx-react-viewer'],
	},
	sourcemap: false,
	clean: !options.watch,
	// 'neutral' (not 'node') so the dts pass emits a single plain `.d.ts` per
	// entry instead of a `.d.mts`/`.d.cts` pair; `scripts/merge-declarations.mjs`
	// only looks for `.d.ts`. Matches `packages/tools`, the other dual
	// bin+library package in this repo.
	platform: 'neutral',
}));
