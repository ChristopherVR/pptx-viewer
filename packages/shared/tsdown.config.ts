import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: [
		'src/index.ts',
		'src/theme/index.ts',
		'src/loader/index.ts',
		'src/smartart-3d/index.ts',
		'src/i18n/index.ts',
		'src/ai/index.ts',
	],
	format: ['esm', 'cjs'],
	outDir: '.types',
	dts: { emitDtsOnly: true },
	deps: {
		neverBundle: ['pptx-viewer-core', 'three', /^three\//u, 'dompurify', 'ai'],
	},
	sourcemap: false,
	clean: !options.watch,
	treeshake: true,
	platform: 'neutral',
}));
