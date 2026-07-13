import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/mcp/index.ts', 'src/codec/index.ts', 'src/schemas/index.ts'],
	format: ['esm', 'cjs'],
	dts: false,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	external: [
		'pptx-viewer-core',
		'pptx-viewer-core/converter',
		'jszip',
		'fast-xml-parser',
		'yjs',
		'fs',
		'fs/promises',
		'path',
		'node:fs',
		'node:fs/promises',
		'node:path',
	],
	treeshake: true,
	platform: 'neutral',
}));
