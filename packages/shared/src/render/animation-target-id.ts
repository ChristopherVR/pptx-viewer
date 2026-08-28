import type { PptxNativeAnimation } from 'pptx-viewer-core';

/** Synthetic state-map suffix for a `p:spTgt/p:bg` background-only target. */
export const BACKGROUND_ANIMATION_ID_SUFFIX = '::pptx-bg';

/**
 * Resolve the view-layer target for an animation.
 *
 * PowerPoint's `p:bg` target animates only the shape paint while its text stays
 * visible. Keeping that state under a synthetic id lets bindings paint a
 * separate background layer without hiding or transforming the whole element.
 */
export function resolveAnimationTargetId(animation: PptxNativeAnimation): string {
	const targetId = animation.targetId ?? '';
	if (targetId && animation.target?.type === 'shape' && animation.target.backgroundOnly === true) {
		return `${targetId}${BACKGROUND_ANIMATION_ID_SUFFIX}`;
	}
	return targetId;
}
