import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	minify: true,
	// Inline the .d.ts of the bundled internal workspace packages so the
	// published types resolve standalone: consumers don't need (and for
	// `pptx-viewer-shared`, can't get) those packages from npm. Mirrors the
	// React package's tsup config and the Vue package's dts `bundledPackages`.
	dts: false,
	splitting: false,
	sourcemap: false,
	clean: !options.watch,
	external: [
		'jszip',
		'fast-xml-parser',
		'dompurify',
		// Optional three.js surface reachable through the shared render barrel
		// (Model3D / SmartArt 3D). The vanilla viewer never imports it, but keep
		// it external so no accidental re-export drags it into the bundle.
		'three',
		/^three\//u,
		// PNG/PDF export libraries: both are dynamically `import()`-ed only when
		// export is actually used (see viewer/export/render-to-canvas.ts and
		// export-controller.ts). Kept external so `splitting: false` doesn't
		// collapse the dynamic import into an eager one.
		'html2canvas-pro',
		'jspdf',
		// Real-time collaboration transports: dynamically `import()`-ed only when
		// a collaboration session actually starts (see collab/collaboration-*.ts).
		// Optional peer deps kept external so a host that never collaborates does
		// not pay for (or need to install) yjs.
		'yjs',
		'y-webrtc',
		'y-websocket',
	],
	// Bundle the internal workspace packages so consumers can install just
	// `pptx-vanilla-viewer` without also pulling `pptx-viewer-core` from npm.
	noExternal: [/^pptx-viewer-core(?:\/|$)/u, /^pptx-viewer-shared(?:\/|$)/u],
	treeshake: true,
	platform: 'browser',
}));
