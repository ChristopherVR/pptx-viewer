import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: [
		'src/index.ts',
		'src/converter/index.ts',
		'src/cli/index.ts',
		'src/signature-node/index.ts',
	],
	format: ['esm', 'cjs'],
	dts: false,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	external: [
		'emf-converter',
		'mtx-decompressor',
		'jszip',
		'fast-xml-parser',
		'fs',
		'path',
		'node-forge',
		'xml-crypto',
		'@xmldom/xmldom',
		'@napi-rs/canvas',
		'crypto',
		'http',
		'https',
		'tls',
	],
	treeshake: true,
	platform: 'neutral',
}));
