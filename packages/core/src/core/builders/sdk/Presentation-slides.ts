/**
 * Slide management methods for the {@link Presentation} class.
 *
 * Contains the core slide CRUD operations: add, insert, duplicate,
 * remove, move, swap, reorder, clear, find, and iterate. These are
 * standalone functions that operate on the presentation data, keeping
 * the main Presentation class focused on orchestration.
 *
 * @module sdk/Presentation-slides
 */

import type { PptxSlide, PptxData } from '../../types/presentation';
import { duplicateSlide } from './slide-operations';
import { SlideBuilder } from './SlideBuilder';

/**
 * Dependencies required for slide management operations.
 */
export interface SlideManagementDeps {
	/** The parsed presentation data containing the slides array. */
	readonly data: PptxData;
	/** Factory function that creates a new SlideBuilder for a given layout. */
	readonly createSlide: (layoutName?: string) => SlideBuilder;
}

/**
 * Add a new slide and return its {@link SlideBuilder} for chaining.
 *
 * @param deps - The presentation data and slide factory.
 * @param layoutName - Layout to use (e.g. `"Blank"`, `"Title Slide"`).
 * @returns A {@link SlideBuilder} for adding elements to the new slide.
 */
export function addSlideImpl(deps: SlideManagementDeps, layoutName?: string): SlideBuilder {
	const builder = deps.createSlide(layoutName);
	deps.data.slides.push(builder.build());
	return builder;
}

/**
 * Insert a slide at a specific position and return its {@link SlideBuilder}.
 *
 * @param deps - The presentation data and slide factory.
 * @param index - 0-based position at which to insert.
 * @param layoutName - Layout to use. Defaults to `"Blank"`.
 * @returns A {@link SlideBuilder} for adding elements to the new slide.
 */
export function insertSlideImpl(
	deps: SlideManagementDeps,
	index: number,
	layoutName?: string,
): SlideBuilder {
	const builder = deps.createSlide(layoutName);
	const clampedIndex = Math.max(0, Math.min(index, deps.data.slides.length));
	deps.data.slides.splice(clampedIndex, 0, builder.build());
	renumberSlides(deps.data);
	return builder;
}

/**
 * Duplicate an existing slide by index.
 *
 * @param data - The presentation data.
 * @param slideIndex - 0-based index of the slide to duplicate.
 * @returns The 0-based index of the newly created slide.
 * @throws {RangeError} If the index is out of range.
 */
export function duplicateSlideImpl(data: PptxData, slideIndex: number): number {
	if (slideIndex < 0 || slideIndex >= data.slides.length) {
		throw new RangeError(`Slide index ${slideIndex} is out of range`);
	}
	const cloned = duplicateSlide(data.slides[slideIndex], data.slides.length + 1);
	data.slides.push(cloned);
	return data.slides.length - 1;
}

/**
 * Remove a slide by index.
 *
 * @param data - The presentation data.
 * @param index - 0-based index of the slide to remove.
 * @throws {RangeError} If the index is out of range.
 */
export function removeSlideImpl(data: PptxData, index: number): void {
	if (index < 0 || index >= data.slides.length) {
		throw new RangeError(`Slide index ${index} is out of range`);
	}
	data.slides.splice(index, 1);
	renumberSlides(data);
}

/**
 * Move a slide from one position to another.
 *
 * @param data - The presentation data.
 * @param fromIndex - Current 0-based index of the slide.
 * @param toIndex - Target 0-based index.
 * @throws {RangeError} If either index is out of range.
 */
export function moveSlideImpl(data: PptxData, fromIndex: number, toIndex: number): void {
	const slides = data.slides;
	if (fromIndex < 0 || fromIndex >= slides.length || toIndex < 0 || toIndex >= slides.length) {
		throw new RangeError('Slide index out of range');
	}
	const [slide] = slides.splice(fromIndex, 1);
	slides.splice(toIndex, 0, slide);
	renumberSlides(data);
}

/**
 * Swap two slides by their indices.
 *
 * @param data - The presentation data.
 * @param indexA - 0-based index of the first slide.
 * @param indexB - 0-based index of the second slide.
 * @throws {RangeError} If either index is out of range.
 */
export function swapSlidesImpl(data: PptxData, indexA: number, indexB: number): void {
	const slides = data.slides;
	if (indexA < 0 || indexA >= slides.length || indexB < 0 || indexB >= slides.length) {
		throw new RangeError('Slide index out of range');
	}
	[slides[indexA], slides[indexB]] = [slides[indexB], slides[indexA]];
	renumberSlides(data);
}

/**
 * Reorder all slides according to the given index array.
 *
 * @param data - The presentation data.
 * @param newOrder - Array of current slide indices defining the new order.
 */
export function reorderSlidesImpl(data: PptxData, newOrder: number[]): void {
	const slides = data.slides;
	const reordered = newOrder.filter((i) => i >= 0 && i < slides.length).map((i) => slides[i]);
	data.slides = reordered;
	renumberSlides(data);
}

/**
 * Remove all slides from the presentation.
 *
 * @param data - The presentation data.
 */
export function clearSlidesImpl(data: PptxData): void {
	data.slides = [];
}

/**
 * Get a slide by index.
 *
 * @param data - The presentation data.
 * @param index - 0-based slide index.
 * @returns The {@link PptxSlide} at the given index.
 * @throws {RangeError} If the index is out of range.
 */
export function getSlideImpl(data: PptxData, index: number): PptxSlide {
	if (index < 0 || index >= data.slides.length) {
		throw new RangeError(`Slide index ${index} is out of range`);
	}
	return data.slides[index];
}

/**
 * Iterate over all slides with a callback.
 *
 * @param data - The presentation data.
 * @param callback - Function invoked for each slide.
 */
export function forEachSlideImpl(
	data: PptxData,
	callback: (slide: PptxSlide, index: number) => void,
): void {
	data.slides.forEach(callback);
}

/**
 * Get all slide indices that match a predicate.
 *
 * @param data - The presentation data.
 * @param predicate - A function that returns `true` for matching slides.
 * @returns An array of 0-based indices of slides that matched.
 */
export function findSlidesImpl(
	data: PptxData,
	predicate: (slide: PptxSlide, index: number) => boolean,
): number[] {
	const results: number[] = [];
	data.slides.forEach((slide, i) => {
		if (predicate(slide, i)) {
			results.push(i);
		}
	});
	return results;
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/**
 * Renumber all slides sequentially starting from 1.
 *
 * @param data - The presentation data.
 */
function renumberSlides(data: PptxData): void {
	for (let i = 0; i < data.slides.length; i++) {
		data.slides[i].slideNumber = i + 1;
	}
}
