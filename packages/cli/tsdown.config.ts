import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts'],
	format: ['esm'],
	outDir: '.types',
	dts: { emitDtsOnly: true },
	sourcemap: false,
	clean: !options.watch,
	platform: 'node',
}));
