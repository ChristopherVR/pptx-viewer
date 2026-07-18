import { defineConfig } from 'tsup';

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
	dts: false,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	// pptx-viewer-core is a peer of every UI binding; keep it external so the
	// host app dedupes a single copy of the engine. `three` is an optional peer
	// behind the `smartart-3d` entry; never bundle it. `dompurify` (MathML
	// sanitisation) is likewise external: every binding already ships it, so the
	// host app dedupes a single copy rather than inlining it into shared. `ai`
	// (Vercel AI SDK) is an optional peer behind the `ai` entry; each binding
	// keeps it external so the host app owns a single copy of the SDK.
	external: ['pptx-viewer-core', 'three', /^three\//u, 'dompurify', 'ai'],
	treeshake: true,
	platform: 'neutral',
}));
