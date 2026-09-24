/**
 * pptx-viewer-shared — framework-agnostic viewer logic shared by the
 * React (`pptx-viewer`), Vue (`pptx-vue-viewer`), and Angular
 * (`pptx-angular-viewer`) bindings.
 *
 * Everything exported here is pure TypeScript (no framework imports), so each
 * UI binding consumes one copy instead of duplicating it.
 *
 * Current surface:
 *   - theme:     ViewerTheme types, default palette, CSS-variable helpers.
 *   - loader:    load-pipeline helpers (media/image collection, guides).
 *   - types:     CanvasSize, CollaborationConfig, CollaborationRole.
 *   - constants: scalar viewer defaults (canvas size, fallback colours).
 *   - render:    the bulk of the shared logic (colour/geometry/connector/
 *                animation/table/chart/text/effects/collaboration/i18n).
 *   - export:    export data helpers.
 */
import { registerPptxWebControls } from './web-components';

export * from './theme';
export * from './loader';
export * from './types';
export * from './constants';
export * from './render';
export * from './three-view';
export * from './export';
export * from './web-components';
// All bindings import this internal package, so registration happens once per page.
registerPptxWebControls();

// `slide-transition-cinematic` (the Office 2013+ p15 cinematic transition
// family: cube/box/flip/rotate/orbit/fallOver/drape/curtains/wind/prestige/
// fracture/crush/peelOff/pageCurlSingle/pageCurlDouble/airplane/origami) is
// consumed internally by `render/slide-transition-css` but was never itself
// re-exported from `render/index.ts` (issue #290), so a consumer of this
// module's public surface (via a binding's `internals` entry) could resolve
// the classic/exotic transition families but not this one. Exported directly
// here, alongside the rest of `./render`, without editing files under
// `render/` (out of scope for this change; see the `render/index.ts` barrel
// for the rest of the transition family's exports).
export {
	getCinematicTransitionAnimations,
	CINEMATIC_TRANSITION_KEYFRAMES,
} from './render/slide-transition-cinematic';
