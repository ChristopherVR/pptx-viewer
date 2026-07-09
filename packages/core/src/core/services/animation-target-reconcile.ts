/**
 * Animation-target reconciliation.
 *
 * PowerPoint targets an animation at a shape by the shape's native OOXML id
 * (`p:cNvPr/@id`), written into `p:spTgt/@spid`. The loader, however, assigns
 * every element a synthetic *positional* identity (`${slidePath}-shape-${index}`,
 * see `PptxHandlerRuntimeSpTreeParsing`) as its `element.id`, because that id is
 * load-bearing for selection, undo/redo and template tracking. The two id
 * spaces never coincide: a native animation's `targetId` is the integer cNvPr
 * id (e.g. `"3"`) while the element it animates has `id` `"…-shape-1"`.
 *
 * Without reconciliation the in-memory model has no link between an animation
 * and its element, so playback (which keys element state by `element.id` but
 * animation steps by `targetId`) never animates anything, in every binding.
 *
 * This module runs once per slide at load time. It:
 *   1. Captures each element's `cNvPr/@id` onto `element.shapeId`.
 *   2. Rewrites every animation's shape references (`targetId` /
 *      `triggerShapeId` on native animations, `elementId` / `triggerShapeId`
 *      on editor animations) from the native cNvPr id to the positional
 *      `element.id`, so consumers can match animations to elements by
 *      `element.id`.
 *
 * References that do not resolve to a known cNvPr id (text-build sub-ids,
 * already-positional ids from decks this app previously authored, etc.) are
 * left untouched, so the pass is idempotent and backward compatible.
 *
 * @module services/animation-target-reconcile
 */
import type { PptxElement, PptxElementAnimation, PptxNativeAnimation, XmlObject } from '../types';

/** Non-visual property containers that hold a `p:cNvPr`. */
const NV_CONTAINERS = [
	'p:nvSpPr',
	'p:nvPicPr',
	'p:nvCxnSpPr',
	'p:nvGraphicFramePr',
	'p:nvGrpSpPr',
] as const;

/** Read the `p:cNvPr/@id` from an element's raw shape XML, if present. */
function readCnvPrId(rawXml: XmlObject | undefined): string | undefined {
	if (!rawXml) {
		return undefined;
	}
	for (const nvKey of NV_CONTAINERS) {
		const nv = rawXml[nvKey] as XmlObject | undefined;
		const cNvPr = nv?.['p:cNvPr'] as XmlObject | undefined;
		const id = cNvPr?.['@_id'];
		if (id !== undefined && id !== null && String(id).length > 0) {
			return String(id);
		}
	}
	return undefined;
}

/** Whether an element id denotes an inherited template (layout/master) shape. */
function isTemplateElementId(elementId: string): boolean {
	return elementId.startsWith('layout-') || elementId.startsWith('master-');
}

/**
 * Walk an element tree (following group children), stamp each element's
 * `shapeId` from its `cNvPr/@id`, and build a `cNvPr id -> element.id` map.
 *
 * Template (layout/master) elements are stamped but excluded from the map:
 * slide animations only ever target slide-authored shapes, and a template
 * shape's cNvPr id lives in a separate id space that could otherwise shadow a
 * slide shape sharing the same numeric id.
 */
function collectShapeIdMap(elements: readonly PptxElement[]): Map<string, string> {
	const map = new Map<string, string>();
	const walk = (els: readonly PptxElement[]): void => {
		for (const el of els) {
			const cnvId = readCnvPrId(el.rawXml as XmlObject | undefined);
			if (cnvId) {
				el.shapeId = cnvId;
				if (!isTemplateElementId(el.id)) {
					map.set(cnvId, el.id);
				}
			}
			if (el.type === 'group' && Array.isArray(el.children)) {
				walk(el.children);
			}
		}
	};
	walk(elements);
	return map;
}

/**
 * Reconcile a slide's animation target references against its elements.
 *
 * Mutates `element.shapeId`, and mutates the animation arrays' shape-reference
 * fields in place, rewriting native cNvPr ids to positional `element.id`s.
 */
export function reconcileAnimationTargets(
	elements: readonly PptxElement[],
	nativeAnimations: PptxNativeAnimation[] | undefined,
	editorAnimations: PptxElementAnimation[] | undefined,
): void {
	const map = collectShapeIdMap(elements);
	if (map.size === 0) {
		return;
	}

	if (nativeAnimations) {
		for (const anim of nativeAnimations) {
			if (anim.targetId !== undefined) {
				const resolved = map.get(anim.targetId);
				if (resolved) {
					anim.targetId = resolved;
				}
			}
			if (anim.triggerShapeId !== undefined) {
				const resolved = map.get(anim.triggerShapeId);
				if (resolved) {
					anim.triggerShapeId = resolved;
				}
			}
		}
	}

	if (editorAnimations) {
		for (const anim of editorAnimations) {
			const resolvedElement = map.get(anim.elementId);
			if (resolvedElement) {
				anim.elementId = resolvedElement;
			}
			if (anim.triggerShapeId !== undefined) {
				const resolvedTrigger = map.get(anim.triggerShapeId);
				if (resolvedTrigger) {
					anim.triggerShapeId = resolvedTrigger;
				}
			}
		}
	}
}
