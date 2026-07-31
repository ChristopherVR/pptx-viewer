/**
 * Hit-testing for the editing layer: map a pointer-event target inside the
 * rendered stage back to the TOP-LEVEL slide element it belongs to.
 *
 * The rule is framework-agnostic ("given a point and a rendered stage, which
 * element is selected?") and was duplicated here, in the Svelte binding, and
 * half-implemented in Angular and Vue, where a grouped child resolved to
 * nothing and a click on it cleared the selection. It now lives once in
 * `pptx-viewer-shared`; this module stays only so the existing import paths
 * keep working.
 *
 * @see `packages/shared/src/render/element-hit-test.ts`
 */

export {
	resolveElementIdChain,
	resolveHitElementId,
	resolveTopLevelElementId,
} from 'pptx-viewer-shared';
