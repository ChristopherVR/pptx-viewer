/**
 * Top-level fluent API for building and manipulating PowerPoint presentations.
 *
 * Wraps {@link PresentationBuilder} to remove the need for manual array
 * manipulation and `.build()` calls. Slides added via {@link Presentation.addSlide}
 * are automatically tracked in the internal slides array, and element additions
 * through the returned {@link SlideBuilder} mutate the slide in-place.
 *
 * Implementation is split across focused sub-modules:
 * - `Presentation-slides` -- Slide CRUD (add, insert, duplicate, remove, move, etc.)
 * - `Presentation-operations` -- Text, section, merge, template, diff, XML builder
 *
 * @module sdk/Presentation
 *
 * @example
 * ```ts
 * const pptx = await Presentation.create({ title: "My Deck" });
 * pptx.addSlide("Blank")
 *   .addText("Hello", { fontSize: 36, x: 100, y: 100, width: 600, height: 50 })
 *   .addShape("roundRect", { fill: { type: "solid", color: "#4472C4" }, x: 200, y: 200, width: 300, height: 200 });
 * pptx.addSlide("Title Slide")
 *   .addText("Welcome", { fontSize: 44, bold: true, x: 100, y: 100, width: 800, height: 80 });
 * const bytes = await pptx.save();
 * ```
 */

import { PptxHandler } from '../../PptxHandler';
import type { PptxSlide, PptxData, PptxSection } from '../../types/presentation';
import type { PptxXmlBuilder } from '../fluent/PptxXmlBuilder';
import type { PresentationDiff } from './diff-operations';
import type { MergeOptions } from './merge-operations';
import {
	findTextImpl,
	replaceTextImpl,
	replaceTextOnSlideImpl,
	addSectionImpl,
	removeSectionImpl,
	reorderSectionsImpl,
	getSectionForSlideImpl,
	moveSlidesToSectionImpl,
	mergeImpl,
	applyTemplateImpl,
	mailMergeImpl,
	diffImpl,
	xmlBuilderImpl,
} from './Presentation-operations';
import {
	addSlideImpl,
	insertSlideImpl,
	duplicateSlideImpl,
	removeSlideImpl,
	moveSlideImpl,
	swapSlidesImpl,
	reorderSlidesImpl,
	clearSlidesImpl,
	getSlideImpl,
	forEachSlideImpl,
	findSlidesImpl,
} from './Presentation-slides';
import { PresentationBuilder } from './PresentationBuilder';
import type { PresentationBuilderResult } from './PresentationBuilder';
import { SlideBuilder } from './SlideBuilder';
import type { TemplateData } from './template-engine';
import type { FindResult } from './text-operations';
import type { PresentationOptions } from './types';

/**
 * Fluent, high-level API for creating and manipulating PPTX presentations.
 *
 * Unlike the lower-level {@link PresentationBuilder}, this class manages the
 * slides array internally so callers never need to push slides manually or
 * call `.build()`. Slides returned by {@link addSlide} and {@link insertSlide}
 * are live references -- any elements added via the {@link SlideBuilder} chain
 * are immediately reflected in the presentation.
 */
export class Presentation {
	private readonly _handler: PptxHandler;
	private readonly _data: PptxData;
	private readonly _createSlide: (layoutName?: string) => SlideBuilder;

	private constructor(result: PresentationBuilderResult) {
		this._handler = result.handler;
		this._data = result.data;
		this._createSlide = result.createSlide;
	}

	/** Create a new blank presentation. */
	static async create(options?: PresentationOptions): Promise<Presentation> {
		const result = await PresentationBuilder.create(options);
		return new Presentation(result);
	}

	/** Load an existing PPTX file from an ArrayBuffer. */
	static async load(buffer: ArrayBuffer): Promise<Presentation> {
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		return new Presentation({
			handler,
			data,
			createSlide: (layoutName?: string) => {
				const slideNum = data.slides.length + 1;
				return new SlideBuilder(slideNum, undefined, layoutName);
			},
		});
	}

	// -- Slide management ---------------------------------------------------

	/** Add a new slide and return its {@link SlideBuilder} for chaining. */
	addSlide(layoutName?: string): SlideBuilder {
		return addSlideImpl({ data: this._data, createSlide: this._createSlide }, layoutName);
	}

	/** Insert a slide at a specific position. */
	insertSlide(index: number, layoutName?: string): SlideBuilder {
		return insertSlideImpl({ data: this._data, createSlide: this._createSlide }, index, layoutName);
	}

	/** Duplicate an existing slide by index. Returns the new slide's index. */
	duplicateSlide(slideIndex: number): number {
		return duplicateSlideImpl(this._data, slideIndex);
	}

	/** Remove a slide by index. */
	removeSlide(index: number): this {
		removeSlideImpl(this._data, index);
		return this;
	}

	/** Move a slide from one position to another. */
	moveSlide(fromIndex: number, toIndex: number): this {
		moveSlideImpl(this._data, fromIndex, toIndex);
		return this;
	}

	/** Swap two slides by their indices. */
	swapSlides(indexA: number, indexB: number): this {
		swapSlidesImpl(this._data, indexA, indexB);
		return this;
	}

	/** Reorder all slides according to the given index array. */
	reorderSlides(newOrder: number[]): this {
		reorderSlidesImpl(this._data, newOrder);
		return this;
	}

	/** Remove all slides from the presentation. */
	clearSlides(): this {
		clearSlidesImpl(this._data);
		return this;
	}

	/** Iterate over all slides with a callback. */
	forEachSlide(callback: (slide: PptxSlide, index: number) => void): this {
		forEachSlideImpl(this._data, callback);
		return this;
	}

	/** Get all slide indices that match a predicate. */
	findSlides(predicate: (slide: PptxSlide, index: number) => boolean): number[] {
		return findSlidesImpl(this._data, predicate);
	}

	/** Get the number of slides in the presentation. */
	get slideCount(): number {
		return this._data.slides.length;
	}

	/** Get a slide by index. */
	getSlide(index: number): PptxSlide {
		return getSlideImpl(this._data, index);
	}

	// -- Text operations ----------------------------------------------------

	/** Find text across all slides. */
	findText(search: string | RegExp): FindResult[] {
		return findTextImpl(this._data, search);
	}

	/** Replace text across all slides. Returns the replacement count. */
	replaceText(search: string | RegExp, replacement: string): number {
		return replaceTextImpl(this._data, search, replacement);
	}

	/** Replace text on a single slide. Returns the replacement count. */
	replaceTextOnSlide(slideIndex: number, search: string | RegExp, replacement: string): number {
		return replaceTextOnSlideImpl(this._data, slideIndex, search, replacement);
	}

	// -- Section operations -------------------------------------------------

	/** Add a named section grouping specific slides. */
	addSection(name: string, slideIndices: number[]): PptxSection {
		return addSectionImpl(this._data, name, slideIndices);
	}

	/** Remove a section by its ID. */
	removeSection(sectionId: string): boolean {
		return removeSectionImpl(this._data, sectionId);
	}

	/** Reorder sections by their IDs. */
	reorderSections(sectionIds: string[]): this {
		reorderSectionsImpl(this._data, sectionIds);
		return this;
	}

	/** Get the section a slide belongs to. */
	getSectionForSlide(slideIndex: number): PptxSection | undefined {
		return getSectionForSlideImpl(this._data, slideIndex);
	}

	/** Move slides to a different section. */
	moveSlidesToSection(slideIndices: number[], targetSectionId: string): boolean {
		return moveSlidesToSectionImpl(this._data, slideIndices, targetSectionId);
	}

	/** Get all sections in the presentation. */
	get sections(): PptxSection[] {
		return this._data.sections ?? [];
	}

	// -- Merge --------------------------------------------------------------

	/** Merge slides from another presentation into this one. */
	merge(source: Presentation, options?: MergeOptions): number {
		return mergeImpl(this._data, source._data, options);
	}

	// -- Template -----------------------------------------------------------

	/** Apply template substitution to all slides. */
	applyTemplate(templateData: TemplateData): this {
		applyTemplateImpl(this._data, templateData);
		return this;
	}

	/** Generate multiple presentations from template data records. */
	async mailMerge(records: TemplateData[]): Promise<Uint8Array[]> {
		return mailMergeImpl(this._handler, this._data, records);
	}

	// -- Diff ---------------------------------------------------------------

	/** Compare this presentation with another and return a structured diff. */
	diff(other: Presentation): PresentationDiff {
		return diffImpl(this._data, other._data);
	}

	// -- Metadata -----------------------------------------------------------

	/** Get the presentation title. */
	get title(): string | undefined {
		return this._data.coreProperties?.title;
	}

	/** Get the presentation creator/author. */
	get creator(): string | undefined {
		return this._data.coreProperties?.creator;
	}

	// -- Dimensions ---------------------------------------------------------

	/** Get the presentation width in EMU. */
	get width(): number {
		return this._data.widthEmu ?? this._data.width ?? 12192000;
	}

	/** Get the presentation height in EMU. */
	get height(): number {
		return this._data.heightEmu ?? this._data.height ?? 6858000;
	}

	// -- XML builder --------------------------------------------------------

	/** Get a fluent XML builder for low-level slide mutation. */
	xmlBuilder(): PptxXmlBuilder {
		return xmlBuilderImpl(this._data);
	}

	// -- Access to internals ------------------------------------------------

	/** Get the underlying {@link PptxHandler}. */
	get handler(): PptxHandler {
		return this._handler;
	}

	/** Get the underlying {@link PptxData} (live reference). */
	get data(): PptxData {
		return this._data;
	}

	/** Get the slides array (live reference). */
	get slides(): PptxSlide[] {
		return this._data.slides;
	}

	// -- Save ---------------------------------------------------------------

	/** Save the presentation to a Uint8Array. */
	async save(): Promise<Uint8Array> {
		return this._handler.save(this._data.slides);
	}

	/** Save the presentation with password encryption. */
	async saveEncrypted(password: string): Promise<Uint8Array> {
		return this._handler.saveEncrypted(this._data.slides, password);
	}

	/** Dispose of handler resources. */
	dispose(): void {
		this._handler.dispose();
	}
}
