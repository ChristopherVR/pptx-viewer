import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/viewer/index.ts'],
	format: ['esm', 'cjs'],
	minify: true,
	// Inline the .d.ts of the bundled internal workspace packages so the
	// published types resolve standalone — consumers don't need (and for
	// `pptx-viewer-shared`, can't get) those packages from npm. Mirrors the
	// runtime `noExternal` below and the Vue package's dts `bundledPackages`.
	dts: { resolve: ['pptx-viewer-core', 'pptx-viewer-shared'] },
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	external: [
		'react',
		'react-dom',
		'framer-motion',
		'lucide-react',
		'react-icons',
		'html2canvas-pro',
		'jspdf',
		'jszip',
		'fast-xml-parser',
		'clsx',
		'tailwind-merge',
		'i18next',
		'react-i18next',
	],
	// Bundle the internal workspace packages so consumers can install just
	// `pptx-react-viewer` without also pulling `pptx-viewer-core` from npm.
	// (`emf-converter` / `mtx-decompressor` are already inlined into core's dist.)
	noExternal: ['pptx-viewer-core', 'pptx-viewer-shared'],
	treeshake: true,
	platform: 'browser',
}));
