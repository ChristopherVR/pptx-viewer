import { resolve } from 'node:path';

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

import { buildStamp } from '../build-stamp';

/**
 * Vite + Angular dev server / build for the pptx-angular-viewer demo.
 *
 * Uses @analogjs/vite-plugin-angular so the demo (and the partial-compiled
 * `pptx-angular-viewer` library) are compiled by the Angular compiler inside
 * Vite — mirroring how the React demo/ uses @vitejs/plugin-react.
 *
 * `pptx-angular-viewer` is built by ng-packagr into its `dist/` (Angular
 * Package Format), so we alias the bare specifier to that built output. The
 * `/styles` alias maps to the emitted CSS asset. (Published consumers resolve
 * these via the generated `dist/package.json` `exports` instead.)
 *
 * jit: true is required because Vite 8 / Rolldown transpiles @Component with
 * standard TypeScript decorators instead of running the Angular AOT compiler
 * on local demo components, so no ɵcmp factory is emitted and Angular must
 * fall back to JIT at runtime. Enabling jit mode bundles @angular/compiler
 * so that fallback works. The published pptx-angular-viewer library is still
 * fully AOT-compiled by ng-packagr and is unaffected by this setting.
 */
const angularLibDist = resolve(__dirname, '../../packages/angular/dist');

export default defineConfig({
	// Served from a subpath (e.g. /pptx-viewer/demo-angular/) on GitHub Pages.
	// CI sets DEMO_BASE so the demo's asset URLs resolve under that subpath.
	base: process.env.DEMO_BASE ?? '/',
	plugins: [
		angular({ tsconfig: './tsconfig.json', jit: true }),
		buildStamp(resolve(__dirname, '../../packages/angular/package.json')),
	],
	resolve: {
		alias: [
			{
				find: /^pptx-angular-viewer\/styles(?<css>\.css)?$/u,
				replacement: resolve(angularLibDist, 'pptx-angular-viewer.css'),
			},
			{ find: 'pptx-angular-viewer', replacement: angularLibDist },
			{
				find: 'pptx-viewer-locales',
				replacement: resolve(__dirname, '../../packages/locales/src/index.ts'),
			},
		],
	},
	server: {
		port: 4174,
	},
	optimizeDeps: {
		include: ['@angular/common', '@angular/core', 'pptx-viewer-core'],
	},
});
