/**
 * Custom show playback utilities.
 *
 * Resolves a named or ID-based custom show into an ordered list of
 * slide indices for presentation-mode playback.
 *
 * @module utils/custom-show-utils
 */

import type { PptxCustomShow, PptxSlide } from '../types/presentation';

/**
 * Find a custom show by name (case-insensitive) or by id.
 */
export function findCustomShow(
	customShows: PptxCustomShow[] | undefined,
	nameOrId: string,
): PptxCustomShow | undefined {
	if (!customShows || customShows.length === 0) {
		return undefined;
	}
	const lower = nameOrId.toLowerCase();
	return (
		customShows.find((s) => s.id === nameOrId) ||
		customShows.find((s) => s.name.toLowerCase() === lower)
	);
}

/**
 * Resolve a custom show's `slideRIds` to 0-based slide indices.
 *
 * @param customShow - The custom show definition.
 * @param slides - The full ordered slide list from `PptxData.slides`.
 * @returns Ordered array of 0-based indices into `slides`, preserving the
 *          custom show's slide order. Unresolvable rIds are skipped.
 */
export function resolveCustomShowSlideIndices(
	customShow: PptxCustomShow,
	slides: PptxSlide[],
): number[] {
	const rIdToIndex = new Map<string, number>();
	for (let i = 0; i < slides.length; i++) {
		rIdToIndex.set(slides[i].rId, i);
	}

	const indices: number[] = [];
	for (const rId of customShow.slideRIds) {
		const idx = rIdToIndex.get(rId);
		if (idx !== undefined) {
			indices.push(idx);
		}
	}
	return indices;
}

/**
 * Get the list of available custom show names.
 */
export function getCustomShowNames(customShows: PptxCustomShow[] | undefined): string[] {
	if (!customShows) {
		return [];
	}
	return customShows.map((s) => s.name);
}

/**
 * Navigate within a custom show's filtered slide list.
 *
 * @param currentSlideIndex - Current 0-based index into the full slide array.
 * @param direction - Navigation direction: 1 for next, -1 for previous.
 * @param filteredIndices - The custom show's resolved slide indices.
 * @param wrap - Whether to wrap around (default false).
 * @returns The next slide index in the full slide array, or `currentSlideIndex` if at boundary.
 */
export function navigateCustomShow(
	currentSlideIndex: number,
	direction: 1 | -1,
	filteredIndices: number[],
	wrap: boolean = false,
): number {
	if (filteredIndices.length === 0) {
		return currentSlideIndex;
	}

	const posInShow = filteredIndices.indexOf(currentSlideIndex);
	if (posInShow === -1) {
		// Current slide not in custom show — jump to the nearest slide in the show
		return filteredIndices[0];
	}

	const nextPos = posInShow + direction;
	if (nextPos < 0) {
		return wrap ? filteredIndices[filteredIndices.length - 1] : currentSlideIndex;
	}
	if (nextPos >= filteredIndices.length) {
		return wrap ? filteredIndices[0] : currentSlideIndex;
	}
	return filteredIndices[nextPos];
}

/**
 * Get the 1-based position label within a custom show (e.g. "3 of 8").
 */
export function getCustomShowPositionLabel(
	currentSlideIndex: number,
	filteredIndices: number[],
): string {
	const pos = filteredIndices.indexOf(currentSlideIndex);
	if (pos === -1) {
		return '';
	}
	return `${pos + 1} of ${filteredIndices.length}`;
}
