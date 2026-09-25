/**
 * Text-run picture-fill (`a:rPr > a:blipFill`) path resolution, mirroring
 * {@link collectTableCellImagePaths}/{@link applyTableCellImagePatches} in
 * `load-content-helpers.ts` for the per-CELL equivalent.
 *
 * Core resolves a run's `a:blipFill` only down to an archive-relative path
 * (`TextStyle.textFillBlipUrl`, set at parse time when the relationship and
 * slide path are both known) - the same "sync parse, lazy resolve" split
 * every other image fill in this codebase uses. A load pipeline collects
 * every such path across all slides, resolves it to a displayable URL
 * exactly like any other image, and patches the tree back immutably via
 * {@link applyTextFillBlipPatches}.
 *
 * Split into its own module (rather than grown into `load-content-helpers.ts`,
 * already at the file-size ceiling) for the same reason
 * `table-style-image-paths.ts` was.
 *
 * @module loader/text-fill-image-paths
 */
import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { walkAndPatchElements } from './element-patch-walker';
import { isExternalUrl } from './is-external-url';

/** A text run whose picture-fill path needs Blob URL resolution. */
export interface TextFillBlipRef {
	/** The element the run belongs to (patched by `element.id`). */
	element: PptxElement;
	segmentIndex: number;
	path: string;
}

/**
 * Collect every text run picture-fill path (`a:rPr > a:blipFill`, parsed onto
 * `segment.style.textFillBlipUrl`) across all slides that needs resolving to
 * a displayable URL, mirroring {@link collectImagePaths} for picture elements.
 */
export function collectTextFillBlipPaths(slides: readonly PptxSlide[]): {
	paths: Set<string>;
	refs: TextFillBlipRef[];
} {
	const paths = new Set<string>();
	const refs: TextFillBlipRef[] = [];

	const walkElements = (elements: PptxElement[]) => {
		for (const el of elements) {
			if (hasTextProperties(el) && el.textSegments) {
				el.textSegments.forEach((segment, segmentIndex) => {
					const path = segment.style?.textFillBlipUrl;
					if (path && !isExternalUrl(path)) {
						paths.add(path);
						refs.push({ element: el, segmentIndex, path });
					}
				});
			}
			if (el.type === 'group' && el.children?.length) {
				walkElements(el.children);
			}
		}
	};

	for (const slide of slides) {
		walkElements(slide.elements);
	}

	return { paths, refs };
}

/**
 * Apply resolved text-run picture-fill URLs (from
 * {@link collectTextFillBlipPaths} plus a path -> URL map) back onto the
 * element tree, immutably. Returns the same `elements` array reference when
 * nothing changed.
 */
export function applyTextFillBlipPatches(
	elements: PptxElement[],
	resolvedMap: Map<string, string>,
	refs: TextFillBlipRef[],
): PptxElement[] {
	const patchesByElementId = new Map<string, Array<{ segmentIndex: number; url: string }>>();
	for (const ref of refs) {
		const url = resolvedMap.get(ref.path);
		if (!url) {
			continue;
		}
		const list = patchesByElementId.get(ref.element.id) ?? [];
		list.push({ segmentIndex: ref.segmentIndex, url });
		patchesByElementId.set(ref.element.id, list);
	}
	if (patchesByElementId.size === 0) {
		return elements;
	}

	return walkAndPatchElements(elements, (el) => {
		const segmentPatches = patchesByElementId.get(el.id);
		if (!segmentPatches || !hasTextProperties(el) || !el.textSegments) {
			return el;
		}
		const newSegments: TextSegment[] = el.textSegments.map((segment, segmentIndex) => {
			const patch = segmentPatches.find((p) => p.segmentIndex === segmentIndex);
			if (!patch || !segment.style) {
				return segment;
			}
			return { ...segment, style: { ...segment.style, textFillBlipUrl: patch.url } };
		});
		return { ...el, textSegments: newSegments };
	});
}
