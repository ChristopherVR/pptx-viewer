/**
 * Save-side animation shape-id assignment.
 *
 * The inverse of `animation-target-reconcile`. Editor animations key their
 * target by the positional `element.id` the loader assigns (see that module for
 * why the two id spaces differ). To emit a file real PowerPoint can bind, the
 * serialized `p:spTgt/@spid` (and the app's own `pptx:editorMeta`) must instead
 * reference the target shape's native OOXML `p:cNvPr/@id`.
 *
 * This module maps each editor animation's `element.id` reference back to the
 * target element's `shapeId` (its cNvPr id), minting a fresh unique id for
 * SDK-created elements that never carried one, and returns a remapped animation
 * list whose `elementId` / `triggerShapeId` are the native cNvPr ids. On the
 * next load, `reconcileAnimationTargets` maps them back to positional element
 * ids, so the round trip is symmetric.
 *
 * @module services/animation-shape-id-assign
 */
import type { PptxElement, PptxElementAnimation } from '../types';
import { createShapeIdResolver } from './shape-id-resolver';

/**
 * Remap a slide's editor animations so their shape references use native cNvPr
 * ids. Mutates `element.shapeId` for elements that need a freshly minted id.
 *
 * @param elements - The slide's elements (group children are traversed).
 * @param animations - Editor animations keyed by positional `element.id`.
 * @param reservedMaxId - Largest cNvPr id already reserved elsewhere in the
 *        slide's shape tree (e.g. the implicit `<p:spTree>` group's own
 *        `p:cNvPr/@id`, conventionally `1`). Freshly minted ids start above both
 *        this and any existing element `shapeId`, so a minted id can never
 *        collide with a reserved id and survive the save-side id validator.
 * @returns A new animation array with `elementId` / `triggerShapeId` rewritten
 *          to native cNvPr ids where the target element could be resolved.
 */
export function remapEditorAnimationsToShapeIds(
	elements: readonly PptxElement[],
	animations: readonly PptxElementAnimation[],
	reservedMaxId: number = 0,
): PptxElementAnimation[] {
	const resolve = createShapeIdResolver(elements, reservedMaxId);

	return animations.map((anim) => {
		const resolvedElement = resolve(anim.elementId);
		const resolvedTrigger =
			anim.triggerShapeId !== undefined ? resolve(anim.triggerShapeId) : undefined;
		if (resolvedElement === undefined && resolvedTrigger === undefined) {
			return anim;
		}
		return {
			...anim,
			elementId: resolvedElement ?? anim.elementId,
			triggerShapeId: resolvedTrigger ?? anim.triggerShapeId,
		};
	});
}
