import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: [
		'src/index.ts',
		'src/converter/index.ts',
		'src/cli/index.ts',
		'src/signature-node/index.ts',
	],
	format: ['esm', 'cjs'],
	outDir: '.types',
	dts: { emitDtsOnly: true },
	sourcemap: false,
	clean: !options.watch,
	treeshake: true,
	platform: 'neutral',
}));
