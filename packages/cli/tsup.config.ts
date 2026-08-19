import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/cli.ts'],
	format: ['esm', 'cjs'],
	dts: false,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	// `src/index.ts` re-exports `pptx-react-viewer` so this package can be
	// imported as a drop-in for it; keep that (and its peers) external so the
	// installer bundle doesn't inline React or the viewer component.
	external: [
		'pptx-react-viewer',
		'@ai-sdk/react',
		'ai',
		'fast-xml-parser',
		'framer-motion',
		'i18next',
		'jspdf',
		'jszip',
		'lucide-react',
		'react',
		'react-dom',
		'react-i18next',
		'react-icons',
	],
	platform: 'node',
}));
