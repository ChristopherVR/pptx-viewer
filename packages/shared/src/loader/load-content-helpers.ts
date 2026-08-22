/**
 * Pure helper functions for the viewer load pipeline.
 *
 * Framework-agnostic — shared by the React, Vue, and Angular bindings. These
 * were duplicated verbatim across `packages/react` and `packages/vue`; this is
 * now the single canonical copy.
 */
import type {
	MediaPptxElement,
	Model3DPptxElement,
	PicturePptxElement,
	PptxElement,
	PptxDrawingGuide,
	PptxSlide,
	TablePptxElement,
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
	field: 'imageData' | 'svgData' | 'posterFrameData' | 'modelData' | 'posterImage';
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
 * Collect every unique `p:stSnd` sound archive path referenced by a native
 * animation across all slides, so a binding's media-resolution pass can
 * pre-populate its `mediaDataUrls` map with them the same way it does for
 * embedded media elements.
 *
 * `PptxNativeAnimation.soundPath` is only ever set for a sound that ALSO
 * happens to back a visible `p:audio`/`p:video` element (already covered by
 * {@link collectMediaElements}) or, more commonly, a sound from PowerPoint's
 * animation sound library that backs no element on the slide at all. Without
 * this, that second case had no entry in `mediaDataUrls`, so a binding whose
 * action-sound playback only does a map lookup (rather than fetching on
 * demand) silently failed to play it.
 */
export function collectAnimationSoundPaths(slides: readonly PptxSlide[]): string[] {
	const paths = new Set<string>();
	for (const slide of slides) {
		for (const anim of slide.nativeAnimations ?? []) {
			if (anim.soundPath && !isExternalUrl(anim.soundPath)) {
				paths.add(anim.soundPath);
			}
		}
	}
	return [...paths];
}

/**
 * Collect all unique image archive paths across all slides that need
 * to be resolved to displayable URLs (Blob URLs).
 *
 * This covers:
 * - Picture elements (`imageData`, `svgData`)
 * - Media poster frames (`posterFrameData`)
 *
 * Returns the set of unique archive paths, plus a list of element/field
 * references that need to be updated once each path resolves.
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
			if (el.type === 'model3d') {
				const model = el as Model3DPptxElement;
				if (model.modelPath && !model.modelData && !isExternalUrl(model.modelPath)) {
					paths.add(model.modelPath);
					refs.push({ element: el, field: 'modelData', path: model.modelPath });
				}
				const posterNeedsResolution = model.posterImage
					? !isExternalUrl(model.posterImage)
					: !model.imageData;
				if (model.imagePath && posterNeedsResolution && !isExternalUrl(model.imagePath)) {
					paths.add(model.imagePath);
					refs.push({ element: el, field: 'posterImage', path: model.imagePath });
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

/** A table cell whose image fill path needs Blob URL resolution. */
export interface TableCellImageRef {
	/** The table element the cell belongs to (patched by `element.id`). */
	element: PptxElement;
	rowIndex: number;
	cellIndex: number;
	path: string;
}

/**
 * Collect every table cell image-fill path (`a:tcPr/a:blipFill`, parsed onto
 * `cell.style.backgroundImageFillPath`) across all slides that needs
 * resolving to a displayable URL, mirroring {@link collectImagePaths} for
 * picture elements. Table parsing is fully synchronous (see core's
 * `resolveTableCellImagePath`), so this path is always a raw archive path
 * (or an already-external URL) until a load pipeline resolves it here.
 */
export function collectTableCellImagePaths(slides: PptxSlide[]): {
	paths: Set<string>;
	refs: TableCellImageRef[];
} {
	const paths = new Set<string>();
	const refs: TableCellImageRef[] = [];

	const walkElements = (elements: PptxElement[]) => {
		for (const el of elements) {
			if (el.type === 'table') {
				const rows = (el as TablePptxElement).tableData?.rows ?? [];
				rows.forEach((row, rowIndex) => {
					row.cells.forEach((cell, cellIndex) => {
						const path = cell.style?.backgroundImageFillPath;
						if (path && !cell.style?.backgroundImageFillData && !isExternalUrl(path)) {
							paths.add(path);
							refs.push({ element: el, rowIndex, cellIndex, path });
						}
					});
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
 * Apply resolved table-cell image URLs (from {@link collectTableCellImagePaths}
 * plus a path -> URL map) back onto the element tree, immutably. Returns the
 * same `elements` array reference when nothing changed, so callers can skip a
 * state update exactly like the flat-field patch path does.
 */
export function applyTableCellImagePatches(
	elements: PptxElement[],
	resolvedMap: Map<string, string>,
	refs: TableCellImageRef[],
): PptxElement[] {
	const patchesByElementId = new Map<
		string,
		Array<{ rowIndex: number; cellIndex: number; url: string }>
	>();
	for (const ref of refs) {
		const url = resolvedMap.get(ref.path);
		if (!url) {
			continue;
		}
		const list = patchesByElementId.get(ref.element.id) ?? [];
		list.push({ rowIndex: ref.rowIndex, cellIndex: ref.cellIndex, url });
		patchesByElementId.set(ref.element.id, list);
	}
	if (patchesByElementId.size === 0) {
		return elements;
	}

	const patchElements = (els: PptxElement[]): PptxElement[] => {
		let mutated = false;
		const next = els.map((el) => {
			let updated: PptxElement = el;
			const cellPatches = patchesByElementId.get(el.id);
			if (cellPatches && el.type === 'table') {
				const table = el as TablePptxElement;
				const tableData = table.tableData;
				if (tableData) {
					const newRows = tableData.rows.map((row, rowIndex) => {
						const rowPatches = cellPatches.filter((p) => p.rowIndex === rowIndex);
						if (rowPatches.length === 0) {
							return row;
						}
						const newCells = row.cells.map((cell, cellIndex) => {
							const patch = rowPatches.find((p) => p.cellIndex === cellIndex);
							if (!patch || !cell.style) {
								return cell;
							}
							return {
								...cell,
								style: { ...cell.style, backgroundImageFillData: patch.url },
							};
						});
						return { ...row, cells: newCells };
					});
					updated = { ...table, tableData: { ...tableData, rows: newRows } };
				}
			}
			if (updated.type === 'group' && updated.children?.length) {
				const newChildren = patchElements(updated.children);
				if (newChildren !== updated.children) {
					updated = { ...updated, children: newChildren };
				}
			}
			if (updated !== el) {
				mutated = true;
			}
			return updated;
		});
		return mutated ? next : els;
	};

	return patchElements(elements);
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
