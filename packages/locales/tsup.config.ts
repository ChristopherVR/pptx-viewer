import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/fr/index.ts', 'src/es/index.ts', 'src/de/index.ts'],
	format: ['esm', 'cjs'],
	dts: false,
	splitting: false,
	clean: true,
	target: 'es2022',
});
