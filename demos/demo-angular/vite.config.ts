import { resolve } from 'node:path';

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

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
 */
const angularLibDist = resolve(__dirname, '../../packages/angular/dist');

export default defineConfig({
	plugins: [angular({ tsconfig: './tsconfig.json' })],
	resolve: {
		alias: [
			{
				find: /^pptx-angular-viewer\/styles(?<css>\.css)?$/u,
				replacement: resolve(angularLibDist, 'pptx-angular-viewer.css'),
			},
			{ find: 'pptx-angular-viewer', replacement: angularLibDist },
		],
	},
	server: {
		port: 4174,
	},
	optimizeDeps: {
		include: ['@angular/common', '@angular/core', 'pptx-viewer-core'],
	},
});
