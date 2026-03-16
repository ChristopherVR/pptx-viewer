/**
 * Pure helper functions extracted from useLoadContent to keep hook file lean.
 */
import type {
	MediaPptxElement,
	PicturePptxElement,
	PptxElement,
	PptxDrawingGuide,
	PptxSlide,
} from 'pptx-viewer-core';
import { guideEmuToPx } from 'pptx-viewer-core';

export interface GuideEntry {
	id: string;
	axis: 'h' | 'v';
	position: number;
}

/** An element that may carry an image path needing Blob URL resolution. */
export interface ImagePathElement {
	element: PptxElement;
	field: 'imageData' | 'svgData' | 'posterFrameData';
	path: string;
}

/**
 * Recursively walks an element tree and pushes every media element
 * into the supplied collector array.
 */
export function collectMediaElements(elements: PptxElement[], collector: MediaPptxElement[]): void {
	for (const element of elements) {
		if (element.type === 'media') {
			collector.push(element);
			continue;
		}
		if (element.type === 'group' && element.children?.length) {
			collectMediaElements(element.children, collector);
		}
	}
}

/**
 * Collect all unique image archive paths across all slides that need
 * to be resolved to displayable URLs (Blob URLs).
 *
 * This covers:
 * - Picture elements (`imageData`, `svgData`)
 * - Media poster frames (`posterFrameData`)
 * - Background images (`slide.backgroundImage`)
 *
 * Returns a Map of unique archive paths → MIME types, plus a list of
 * element/field references that need to be updated.
 */
export function collectImagePaths(slides: PptxSlide[]): {
	paths: Set<string>;
	refs: ImagePathElement[];
} {
	const paths = new Set<string>();
	const refs: ImagePathElement[] = [];

	const walkElements = (elements: PptxElement[]) => {
		for (const el of elements) {
			if (el.type === 'picture' || el.type === 'image') {
				const pic = el as PicturePptxElement;
				if (pic.imagePath && !pic.imageData && !isExternalUrl(pic.imagePath)) {
					paths.add(pic.imagePath);
					refs.push({ element: el, field: 'imageData', path: pic.imagePath });
				}
				if (pic.svgPath && !pic.svgData && !isExternalUrl(pic.svgPath)) {
					paths.add(pic.svgPath);
					refs.push({ element: el, field: 'svgData', path: pic.svgPath });
				}
			}
			if (el.type === 'media') {
				const media = el as MediaPptxElement;
				if (
					media.posterFramePath &&
					!media.posterFrameData &&
					!isExternalUrl(media.posterFramePath)
				) {
					paths.add(media.posterFramePath);
					refs.push({
						element: el,
						field: 'posterFrameData',
						path: media.posterFramePath,
					});
				}
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

function isExternalUrl(path: string): boolean {
	return (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('data:') ||
		path.startsWith('blob:')
	);
}

/**
 * Converts raw EMU-based drawing guides from the parsed presentation
 * and the first slide into pixel-based `GuideEntry` objects.
 */
export function buildInitialGuides(
	presentationGuides: PptxDrawingGuide[] | undefined,
	firstSlideGuides: PptxDrawingGuide[] | undefined,
): GuideEntry[] {
	const guides: GuideEntry[] = [];
	if (presentationGuides) {
		for (const g of presentationGuides) {
			guides.push({
				id: g.id,
				axis: g.orientation === 'horz' ? 'h' : 'v',
				position: guideEmuToPx(g.positionEmu),
			});
		}
	}
	if (firstSlideGuides) {
		for (const g of firstSlideGuides) {
			guides.push({
				id: g.id,
				axis: g.orientation === 'horz' ? 'h' : 'v',
				position: guideEmuToPx(g.positionEmu),
			});
		}
	}
	return guides;
}
