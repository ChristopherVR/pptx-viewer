/**
 * Lazy table-cell / table-style image URL resolution orchestration.
 *
 * Both functions here follow the same three-step shape every "resolve lazy
 * X" pipeline in this codebase repeats: collect archive paths + refs, resolve
 * each path to a displayable URL, then patch the result back in immutably.
 * Svelte's `state/loader-helpers.ts` (`resolveLazyTableCellImages` /
 * `resolveLazyTableStyleImages`) and Vanilla's `load/load-presentation.ts`
 * (`resolveTableCellImageUrls` / `resolveTableStyleImageUrls`) each hand-rolled
 * an identical copy against a concrete `PptxHandler`; this is the one copy,
 * parameterised over a `getImageData` callback so it has no core/handler
 * dependency of its own.
 *
 * @module loader/lazy-image-resolution
 */
import type { ParsedTableStyleMap, PptxSlide } from 'pptx-viewer-core';

import { applyTableCellImagePatches, collectTableCellImagePaths } from './load-content-helpers';
import {
	applyTableStyleImagePatches,
	collectTableStyleImagePaths,
} from './table-style-image-paths';

/** Resolve a single archive path to a displayable URL, or `undefined`. */
export type GetImageData = (path: string) => Promise<string | undefined>;

/**
 * Resolve lazily-loaded table cell image-fill URLs (`a:tcPr/a:blipFill`) and
 * patch them into the slide tree immutably. Returns the input `slides` array
 * reference unchanged when there is nothing to resolve.
 */
export async function resolveTableCellImageUrls(
	slides: PptxSlide[],
	getImageData: GetImageData,
): Promise<PptxSlide[]> {
	const { paths, refs } = collectTableCellImagePaths(slides);
	if (paths.size === 0) {
		return slides;
	}

	const resolvedMap = new Map<string, string>();
	await Promise.all(
		Array.from(paths).map(async (path) => {
			try {
				const url = await getImageData(path);
				if (url) {
					resolvedMap.set(path, url);
				}
			} catch {
				// Non-critical: the cell falls back to no image fill.
			}
		}),
	);
	if (resolvedMap.size === 0) {
		return slides;
	}

	return slides.map((slide) => {
		const newElements = applyTableCellImagePatches(slide.elements, resolvedMap, refs);
		return newElements === slide.elements ? slide : { ...slide, elements: newElements };
	});
}

/**
 * Resolve lazily-loaded whole-table-STYLE image-fill URLs
 * (`a:tcStyle/a:fill/a:blipFill` on `ppt/tableStyles.xml`) and patch them
 * into the table style map immutably. Same lazy-load story as
 * {@link resolveTableCellImageUrls}, but for a presentation-level style
 * section fill rather than a per-cell one.
 */
export async function resolveTableStyleImageUrls(
	tableStyleMap: ParsedTableStyleMap | undefined,
	getImageData: GetImageData,
): Promise<ParsedTableStyleMap | undefined> {
	const { paths, refs } = collectTableStyleImagePaths(tableStyleMap);
	if (paths.size === 0 || !tableStyleMap) {
		return tableStyleMap;
	}

	const resolvedMap = new Map<string, string>();
	await Promise.all(
		Array.from(paths).map(async (path) => {
			try {
				const url = await getImageData(path);
				if (url) {
					resolvedMap.set(path, url);
				}
			} catch {
				// Non-critical: the style section falls back to no image fill.
			}
		}),
	);
	if (resolvedMap.size === 0) {
		return tableStyleMap;
	}

	return applyTableStyleImagePatches(tableStyleMap, resolvedMap, refs);
}
