import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/mcp/index.ts', 'src/codec/index.ts', 'src/schemas/index.ts'],
	format: ['esm', 'cjs'],
	outDir: '.types',
	dts: { emitDtsOnly: true },
	sourcemap: false,
	clean: !options.watch,
	treeshake: true,
	platform: 'neutral',
}));
