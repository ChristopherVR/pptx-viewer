/**
 * High-level operations for the {@link Presentation} class.
 *
 * Contains text search/replace, section management, merge, template,
 * diff, and metadata operations. These are standalone functions that
 * operate on PptxData, keeping the main Presentation class focused
 * on orchestration.
 *
 * @module sdk/Presentation-operations
 */

import { PptxHandler } from '../../PptxHandler';
import type { PptxData, PptxSection } from '../../types/presentation';
import { PptxXmlBuilder } from '../fluent/PptxXmlBuilder';
import { diffPresentations } from './diff-operations';
import type { PresentationDiff } from './diff-operations';
import { mergePresentation } from './merge-operations';
import type { MergeOptions } from './merge-operations';
import {
	addSection,
	removeSection,
	reorderSections,
	getSectionForSlide,
	moveSlidesToSection,
} from './section-operations';
import { applyTemplate, mailMerge } from './template-engine';
import type { TemplateData } from './template-engine';
import { findText, replaceText, replaceTextInSlide } from './text-operations';
import type { FindResult } from './text-operations';

// -----------------------------------------------------------------------
// Text operations
// -----------------------------------------------------------------------

/**
 * Find text across all slides.
 *
 * @param data - The presentation data.
 * @param search - Plain string or RegExp to search for.
 * @returns Array of match results with slide and element location info.
 */
export function findTextImpl(data: PptxData, search: string | RegExp): FindResult[] {
	return findText(data.slides, search);
}

/**
 * Replace text across all slides.
 *
 * @param data - The presentation data.
 * @param search - Plain string or RegExp to search for.
 * @param replacement - The replacement string.
 * @returns The total number of replacements made.
 */
export function replaceTextImpl(
	data: PptxData,
	search: string | RegExp,
	replacement: string,
): number {
	return replaceText(data.slides, search, replacement);
}

/**
 * Replace text on a single slide.
 *
 * @param data - The presentation data.
 * @param slideIndex - 0-based index of the slide to modify.
 * @param search - Plain string or RegExp to search for.
 * @param replacement - The replacement string.
 * @returns The number of replacements made on the slide.
 * @throws {RangeError} If the slide index is out of range.
 */
export function replaceTextOnSlideImpl(
	data: PptxData,
	slideIndex: number,
	search: string | RegExp,
	replacement: string,
): number {
	if (slideIndex < 0 || slideIndex >= data.slides.length) {
		throw new RangeError(`Slide index ${slideIndex} is out of range`);
	}
	return replaceTextInSlide(data.slides[slideIndex], search, replacement);
}

// -----------------------------------------------------------------------
// Section operations
// -----------------------------------------------------------------------

/**
 * Add a named section grouping specific slides.
 *
 * @param data - The presentation data.
 * @param name - Display name for the section.
 * @param slideIndices - 0-based indices of slides to include.
 * @returns The created {@link PptxSection}.
 */
export function addSectionImpl(data: PptxData, name: string, slideIndices: number[]): PptxSection {
	return addSection(data, name, slideIndices);
}

/**
 * Remove a section by its ID.
 *
 * @param data - The presentation data.
 * @param sectionId - The section ID to remove.
 * @returns `true` if the section was found and removed.
 */
export function removeSectionImpl(data: PptxData, sectionId: string): boolean {
	return removeSection(data, sectionId);
}

/**
 * Reorder sections by their IDs.
 *
 * @param data - The presentation data.
 * @param sectionIds - Ordered array of section IDs defining the new order.
 */
export function reorderSectionsImpl(data: PptxData, sectionIds: string[]): void {
	reorderSections(data, sectionIds);
}

/**
 * Get the section a slide belongs to.
 *
 * @param data - The presentation data.
 * @param slideIndex - 0-based index of the slide.
 * @returns The section the slide belongs to, or `undefined`.
 */
export function getSectionForSlideImpl(
	data: PptxData,
	slideIndex: number,
): PptxSection | undefined {
	return getSectionForSlide(data, slideIndex);
}

/**
 * Move slides to a different section.
 *
 * @param data - The presentation data.
 * @param slideIndices - 0-based indices of slides to move.
 * @param targetSectionId - The section ID to move slides to.
 * @returns `true` if the target section was found and slides were moved.
 */
export function moveSlidesToSectionImpl(
	data: PptxData,
	slideIndices: number[],
	targetSectionId: string,
): boolean {
	return moveSlidesToSection(data, slideIndices, targetSectionId);
}

// -----------------------------------------------------------------------
// Merge
// -----------------------------------------------------------------------

/**
 * Merge slides from another presentation's data into this one.
 *
 * @param targetData - The target presentation data.
 * @param sourceData - The source presentation data to merge from.
 * @param options - Controls which slides to take and where to insert.
 * @returns The number of slides merged.
 */
export function mergeImpl(
	targetData: PptxData,
	sourceData: PptxData,
	options?: MergeOptions,
): number {
	return mergePresentation(targetData, sourceData, options);
}

// -----------------------------------------------------------------------
// Template
// -----------------------------------------------------------------------

/**
 * Apply template substitution to all slides.
 *
 * @param data - The presentation data.
 * @param templateData - The data record to substitute.
 */
export function applyTemplateImpl(data: PptxData, templateData: TemplateData): void {
	applyTemplate(data, templateData);
}

/**
 * Generate multiple presentations from template data records.
 *
 * @param handler - The PptxHandler instance.
 * @param data - The presentation data (used as template).
 * @param records - Array of data records.
 * @returns An array of serialised PPTX files.
 */
export function mailMergeImpl(
	handler: PptxHandler,
	data: PptxData,
	records: TemplateData[],
): Promise<Uint8Array[]> {
	return mailMerge(handler, data, records);
}

// -----------------------------------------------------------------------
// Diff
// -----------------------------------------------------------------------

/**
 * Compare two presentations and return a structured diff.
 *
 * @param dataA - The first presentation data.
 * @param dataB - The second presentation data.
 * @returns A diff describing all differences.
 */
export function diffImpl(dataA: PptxData, dataB: PptxData): PresentationDiff {
	return diffPresentations(dataA, dataB);
}

// -----------------------------------------------------------------------
// XML builder
// -----------------------------------------------------------------------

/**
 * Get a fluent XML builder for low-level slide mutation.
 *
 * @param data - The presentation data.
 * @returns A PptxXmlBuilder wrapping the data.
 */
export function xmlBuilderImpl(data: PptxData): PptxXmlBuilder {
	return PptxXmlBuilder.from(data);
}
