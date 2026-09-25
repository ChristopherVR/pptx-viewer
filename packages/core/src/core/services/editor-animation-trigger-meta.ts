/**
 * The interactive-trigger half of the `pptx:editorMeta` animation entry: which
 * shape an `onShapeClick` effect waits for, and which media bookmark an
 * `onMediaBookmark` effect waits for.
 *
 * Neither used to be recorded, so an effect authored with either trigger
 * reloaded as a plain click step with no target, and the next save moved it
 * out of its interactive sequence. The shape id is written in the slide's
 * native `p:cNvPr/@id` space (the save path remaps editor ids before the meta
 * is written) and mapped back to the positional element id on load by
 * `reconcileAnimationTargets`, exactly like `elementId`.
 *
 * @module services/editor-animation-trigger-meta
 */
import type { PptxElementAnimation, XmlObject } from '../types';

/** Whether a trigger names another shape it waits on. */
function namesTriggerShape(trigger: PptxElementAnimation['trigger']): boolean {
	return trigger === 'onShapeClick' || trigger === 'onMediaBookmark';
}

/** Read `@triggerShapeId` / `@triggerBookmark` off a parsed meta node. */
export function interactiveTriggerFields(
	node: XmlObject | undefined,
): Pick<PptxElementAnimation, 'triggerShapeId' | 'triggerBookmark'> {
	const shapeId = String(node?.['@_triggerShapeId'] ?? '').trim();
	const bookmark = String(node?.['@_triggerBookmark'] ?? '');
	return {
		...(shapeId ? { triggerShapeId: shapeId } : {}),
		...(bookmark ? { triggerBookmark: bookmark } : {}),
	};
}

/** Attributes recording an animation's interactive trigger target, if any. */
export function interactiveTriggerAttributes(animation: PptxElementAnimation): XmlObject {
	if (!namesTriggerShape(animation.trigger) || !animation.triggerShapeId) {
		return {};
	}
	return {
		'@_triggerShapeId': animation.triggerShapeId,
		...(animation.trigger === 'onMediaBookmark' && animation.triggerBookmark
			? { '@_triggerBookmark': animation.triggerBookmark }
			: {}),
	};
}
