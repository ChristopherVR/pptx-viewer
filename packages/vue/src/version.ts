/**
 * The published `pptx-vue-viewer` package version, shown in File > Account > About.
 *
 * Injected by `vite.config.ts` (and `vitest.config.ts`, for tests) as a
 * build-time `define`, `__PPTX_PACKAGE_VERSION__`, sourced from `package.json`
 * so it can never drift from what actually ships.
 *
 * Guarded via `typeof` (never throws on an undeclared identifier) so a
 * consumer bundling this source with some other build tool that doesn't
 * inject the define degrades to `undefined` instead of crashing; the About
 * section then just omits the version line.
 */
declare const __PPTX_PACKAGE_VERSION__: string | undefined;

export const PPTX_VUE_VIEWER_VERSION: string | undefined =
	typeof __PPTX_PACKAGE_VERSION__ === 'string' ? __PPTX_PACKAGE_VERSION__ : undefined;
