import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';

import { elementHitTargetStyle, shouldRenderHitTarget } from '../internal/shared';
import { getContainerStyle, getShapeFillStrokeStyle } from './element-style';
import type { StyleMap } from './element-style';
import { showsTemplateAffordance } from './template-mode';

/**
 * Element kinds dispatched to `ElementRendererGraphicsComponent` by
 * `ElementRendererComponent.isGraphicsElement`. Kept here (rather than inline
 * in that component) so the component file, which touches the ~300 LOC
 * guideline, stays under it.
 */
export const GRAPHICS_ELEMENT_TYPES = new Set<PptxElement['type']>([
	'ink',
	'contentPart',
	'zoom',
	'model3d',
	'smartArt',
	'ole',
	'chart',
	'table',
	'media',
]);

/**
 * Outline ring + slight transparency applied to inherited template
 * (master/layout) elements while editTemplateMode is on. Empty otherwise, so
 * normal rendering is never altered.
 *
 * Shared by `ElementRendererComponent` (the `group` branch) and
 * `ElementRendererShapeComponent` (the `text`/`shape` branch) so the merge
 * logic is worked out in exactly one place even though each component
 * derives its own container style independently.
 */
export function buildTemplateAffordanceStyle(
	element: PptxElement,
	editTemplateMode: boolean,
): StyleMap {
	if (!showsTemplateAffordance(element, editTemplateMode)) {
		return {};
	}
	return {
		outline: '1px dashed #f59e0b',
		'outline-offset': '1px',
		opacity: '0.95',
	};
}

/** Absolute container style, folding in the template-affordance outline. */
export function buildElementContainerStyle(
	element: PptxElement,
	zIndex: number,
	editTemplateMode: boolean,
): StyleMap {
	return {
		...getContainerStyle(element, zIndex),
		...buildTemplateAffordanceStyle(element, editTemplateMode),
	};
}

/**
 * Fill/stroke/effects container style for the `text`/`shape` and `group`
 * branches: composes (rather than clobbers) a 3D `a:scene3d` camera
 * transform with the container's own rotation/flip transform, exactly as the
 * Vue binding does, then folds in the template-affordance outline.
 */
export function buildShapeContainerStyle(
	element: PptxElement,
	zIndex: number,
	parentGroupFill: ShapeStyle | undefined,
	animatesFill: boolean | undefined,
	animatesStroke: boolean | undefined,
	editTemplateMode: boolean,
): StyleMap {
	const container = getContainerStyle(element, zIndex);
	const shape = getShapeFillStrokeStyle(element, parentGroupFill, animatesFill, animatesStroke);
	const merged: StyleMap = {
		...container,
		...shape,
		...buildTemplateAffordanceStyle(element, editTemplateMode),
	};
	if (container['transform'] && shape['transform']) {
		merged['transform'] = `${String(container['transform'])} ${String(shape['transform'])}`;
	}
	return merged;
}

/**
 * Interaction-only hit-target overlay for a degenerate (sub-`MIN_ELEMENT_SIZE`)
 * element: editable and not on the live presentation stage. See
 * `ElementRendererShapeComponent.hitTargetStyle`'s fuller doc (issue #285).
 * Extracted here (rather than inlined per caller) so `ElementRendererComponent`
 * and `ElementRendererGraphicsComponent`, both already near the file-size
 * guideline, need only one line each.
 */
export function buildHitTargetOverlayStyle(
	element: PptxElement,
	editable: boolean,
	presenting: boolean,
): StyleMap | undefined {
	return shouldRenderHitTarget(editable, presenting) ? elementHitTargetStyle(element) : undefined;
}

/** `text`/`shape` elements, routed to `ElementRendererShapeComponent`. */
export function isShapeLikeElement(element: PptxElement): boolean {
	return element.type === 'text' || element.type === 'shape';
}

/** `picture`/`image` elements, routed to `ImageRendererComponent`. */
export function isImageLikeElement(element: PptxElement): boolean {
	return element.type === 'picture' || element.type === 'image';
}
