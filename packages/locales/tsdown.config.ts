import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/fr/index.ts', 'src/es/index.ts', 'src/de/index.ts'],
	format: ['esm', 'cjs'],
	outDir: '.types',
	dts: { emitDtsOnly: true },
	clean: !options.watch,
	platform: 'neutral',
}));
