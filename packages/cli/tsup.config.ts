import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	platform: 'node',
}));
