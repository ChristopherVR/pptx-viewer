import { defineConfig } from 'tsup';

import pkg from './package.json' with { type: 'json' };

export default defineConfig((options) => ({
	entry: ['src/index.ts', 'src/viewer/index.ts', 'src/i18n.ts', 'src/internals.ts'],
	format: ['esm', 'cjs'],
	minify: false,
	// File > Account's About panel reads this to show the installed package
	// version without bundling `package.json` itself.
	define: {
		__PPTX_PACKAGE_VERSION__: JSON.stringify(pkg.version),
	},
	// Inline the .d.ts of the bundled internal workspace packages so the
	// published types resolve standalone: consumers don't need (and for
	// `pptx-viewer-shared`, can't get) those packages from npm. Mirrors the
	// runtime `noExternal` below and the Vue package's dts `bundledPackages`.
	dts: false,
	splitting: true,
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
	// (`emf-converter` / `mtx-decompressor` are no longer bundled into core's
	// dist (core now imports them from npm) but since they're not listed as
	// external above, they get inlined here too, keeping this package
	// self-contained.)
	noExternal: ['pptx-viewer-core', 'pptx-viewer-shared'],
	treeshake: true,
	platform: 'browser',
}));
