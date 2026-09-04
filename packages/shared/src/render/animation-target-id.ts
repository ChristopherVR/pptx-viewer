import type { PptxNativeAnimation } from 'pptx-viewer-core';

/** Synthetic state-map suffix for a `p:spTgt/p:bg` background-only target. */
export const BACKGROUND_ANIMATION_ID_SUFFIX = '::pptx-bg';

/**
 * Resolve the view-layer target for an animation.
 *
 * PowerPoint's `p:bg` target animates only the shape paint while its text stays
 * visible. Keeping that state under a synthetic id lets bindings paint a
 * separate background layer without hiding or transforming the whole element.
 *
 * A `p:spTgt/p:subSp` target (a shape animated while nested inside a group,
 * authored by selecting a group member in PowerPoint's Animation Pane without
 * ungrouping it) names the descendant shape's id on `subShapeId`; that leaf id
 * is the real playback target, so it wins over the parse layer's `targetId`
 * (which core keeps pointed at the same leaf already, but a caller reading the
 * full `target` object should still prefer `subShapeId` explicitly here).
 */
export function resolveAnimationTargetId(animation: PptxNativeAnimation): string {
	const targetId =
		(animation.target?.type === 'shape' ? animation.target.subShapeId : undefined) ??
		animation.targetId ??
		'';
	if (targetId && animation.target?.type === 'shape' && animation.target.backgroundOnly === true) {
		return `${targetId}${BACKGROUND_ANIMATION_ID_SUFFIX}`;
	}
	return targetId;
}
