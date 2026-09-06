import type { GroupPptxElement, PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import {
	buildParagraphs,
	getComputedEffectStyle,
	getContainerStyle,
	getGroupChildParentFill,
	getImageFitStyle,
	getImageSrc,
	resolveGroupChildFill,
} from 'pptx-viewer-shared';
import type { ComputedFillStyle } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import { getShapeFillStrokeStyle, getTextBlockStyle } from '../element-styles';
import {
	renderShapeFillOverlay,
	renderShapeFilterDefs,
	renderShapeSubpathFillOverlay,
	renderStrokeOutline,
} from './shape-filter-defs';
import { renderTextBlock } from './text-block';

/**
 * `a:grpFill` inheritance for a mirrored group child: paints the resolved fill
 * onto the already-built node, mirroring `group.ts`'s `applyGroupChildFill`
 * (vanilla's `getShapeFillStrokeStyle` takes no `parentGroupFill`, unlike the
 * other four bindings, so this is applied as a post-build patch there too).
 */
function applyInheritedFill(node: HTMLElement, fill: ComputedFillStyle): void {
	if (fill.backgroundColor !== undefined) {
		node.style.backgroundColor = fill.backgroundColor;
	}
	if (fill.backgroundImage !== undefined) {
		node.style.backgroundImage = fill.backgroundImage;
	}
	if (fill.backgroundRepeat !== undefined) {
		node.style.backgroundRepeat = fill.backgroundRepeat;
	}
	if (fill.backgroundSize !== undefined) {
		node.style.backgroundSize = fill.backgroundSize;
	}
}

/**
 * Append a nested `a:reflection` mirror of `element` into `host`, unless
 * `element` is the SAME element this whole mirror is already being built for
 * (`suppressOwnReflection`).
 *
 * Mirrors `shape-filter-defs.ts`'s `renderReflectionOverlay` (the live-render
 * entry point), but is called from INSIDE `buildReflectionMirrorContent`
 * itself rather than imported from `shape-filter-defs.ts`, to avoid a
 * circular import (that module already imports
 * {@link buildReflectionMirrorContent} from this one).
 *
 * PowerPoint composites a reflected group from the group's fully-rendered
 * content, which already includes each child's own reflection where one is
 * set, so a child (or nested group) that carries its OWN `a:reflection` must
 * show it a SECOND time here, nested inside the parent's mirror - see
 * `reflection-content-parity.spec.ts`'s nested-reflection case.
 */
function appendOwnReflection(
	doc: Document,
	host: HTMLElement,
	element: PptxElement,
	mediaDataUrls: ReadonlyMap<string, string>,
	suppressOwnReflection: boolean,
): void {
	if (suppressOwnReflection) {
		return;
	}
	const wrapperStyle = getComputedEffectStyle(element).reflection;
	if (!wrapperStyle) {
		return;
	}
	const layer = createEl(doc, 'div', 'pptxv-reflection', { ...wrapperStyle });
	layer.setAttribute('aria-hidden', 'true');
	layer.appendChild(buildReflectionMirrorContent(doc, element, mediaDataUrls, undefined, true));
	host.appendChild(layer);
}

/**
 * Build the mirrored CONTENT painted inside a `pptxv-reflection` wrapper (see
 * `shape-filter-defs.ts`'s `renderReflectionOverlay`): the element's own fill,
 * outline, text body and - for a group - its children, not just its resolved
 * fill the way `-webkit-box-reflect` and this app's earlier reflection
 * wrapper both only ever managed.
 *
 * Reuses the SAME pure style builders and DOM assemblers the element's real
 * render uses (`getShapeFillStrokeStyle`, `getTextBlockStyle`,
 * `buildParagraphs`, `renderTextBlock`, plus the other `shape-filter-defs.ts`
 * overlays), so the mirror never drifts from what is actually on screen.
 * Everything here is `aria-hidden`/inert: no `data-element-id`, no
 * interactive handlers, no text-build `elementId` (what a live animation
 * keys off), so a mirror never doubles up in accessibility, hit-testing,
 * collaboration or selection code that counts or targets elements by id.
 *
 * @param suppressOwnReflection - `true` only when this call is building the
 *   mirror FOR `element` itself (from `renderReflectionOverlay`), so its own
 *   content must not also grow another nested mirror of itself. `false`
 *   (the default) for every recursive descendant, so a child (or nested
 *   group) that carries its OWN `a:reflection` still shows it.
 */
export function buildReflectionMirrorContent(
	doc: Document,
	element: PptxElement,
	mediaDataUrls: ReadonlyMap<string, string>,
	parentGroupFill?: ShapeStyle,
	suppressOwnReflection = false,
): HTMLElement {
	if (element.type === 'group') {
		const wrap = createEl(doc, 'div', undefined, {
			position: 'relative',
			width: '100%',
			height: '100%',
			// A group paints no fill/outline of its own, but `p:grpSpPr/a:effectLst`
			// DOES carry a shadow/glow/soft-edge for the group's own composite
			// raster (see shared `getComputedEffectStyle`).
			...getShapeFillStrokeStyle(element),
		});
		const groupFilterDefs = renderShapeFilterDefs(doc, element);
		if (groupFilterDefs) {
			wrap.appendChild(groupFilterDefs);
		}
		const childParentFill = getGroupChildParentFill(element, parentGroupFill);
		for (const child of (element as GroupPptxElement).children ?? []) {
			const childWrap = createEl(doc, 'div', undefined, getContainerStyle(child, 0));
			// `suppressOwnReflection` defaults to `false`: a child is not the
			// element being mirrored, so its own reflection (if it has one) is
			// appended by this SAME recursive call, at the end of its own branch.
			childWrap.appendChild(
				buildReflectionMirrorContent(doc, child, mediaDataUrls, childParentFill),
			);
			wrap.appendChild(childWrap);
		}
		appendOwnReflection(doc, wrap, element, mediaDataUrls, suppressOwnReflection);
		return wrap;
	}

	const box = createEl(doc, 'div', undefined, {
		width: '100%',
		height: '100%',
		...getShapeFillStrokeStyle(element),
	});
	const inheritedFill = resolveGroupChildFill(element, parentGroupFill);
	if (inheritedFill) {
		applyInheritedFill(box, inheritedFill);
	}

	const subpathFill = renderShapeSubpathFillOverlay(doc, element);
	if (subpathFill) {
		box.appendChild(subpathFill);
	}
	const filterDefs = renderShapeFilterDefs(doc, element);
	if (filterDefs) {
		box.appendChild(filterDefs);
	}
	const fillOverlay = renderShapeFillOverlay(doc, element);
	if (fillOverlay) {
		box.appendChild(fillOverlay);
	}
	const gradientOutline = renderStrokeOutline(doc, element);
	if (gradientOutline) {
		box.appendChild(gradientOutline);
	}

	if (isImageLikeElement(element)) {
		const src = getImageSrc(element, new Map(mediaDataUrls));
		if (src) {
			const img = createEl(doc, 'img', undefined, {
				width: '100%',
				height: '100%',
				...getImageFitStyle(element),
			});
			img.setAttribute('src', src);
			img.setAttribute('alt', '');
			img.setAttribute('draggable', 'false');
			box.appendChild(img);
		}
		appendOwnReflection(doc, box, element, mediaDataUrls, suppressOwnReflection);
		return box;
	}

	const paragraphs = buildParagraphs(element);
	const hasText = paragraphs.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined);
	if (hasText) {
		box.appendChild(renderTextBlock(doc, paragraphs, getTextBlockStyle(element)));
	}
	appendOwnReflection(doc, box, element, mediaDataUrls, suppressOwnReflection);
	return box;
}
