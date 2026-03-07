import type {
  PptxData,
  PptxElement,
  PptxSlide,
  TextSegment,
} from "../../types";

/**
 * Fluent interface for navigating and mutating a {@link PptxData} structure.
 * Provides method-chaining access to slides, elements, and notes.
 */
export interface IPptxXmlBuilder {
  /** Navigate to a slide by zero-based index (Pascal-case alias). */
  Slides(index: number): PptxSlideBuilder;
  /** Navigate to a slide by zero-based index. */
  slide(index: number): PptxSlideBuilder;
  /** Navigate to a slide by zero-based index (plural alias). */
  slides(index: number): PptxSlideBuilder;
  /** Return the underlying presentation data. */
  project(): PptxData;
}

/**
 * Root builder of the fluent PPTX editing API.
 *
 * Wraps a {@link PptxData} object and provides chainable accessors
 * to navigate into slides, elements, and notes for in-place mutation.
 */
export class PptxXmlBuilder implements IPptxXmlBuilder {
  /** The presentation data being mutated. */
  private readonly data: PptxData;

  /** @param data - The presentation data to wrap. */
  public constructor(data: PptxData) {
    this.data = data;
  }

  /**
   * Factory method to create a builder from presentation data.
   * @param data - The presentation data to wrap.
   * @returns A new {@link PptxXmlBuilder} instance.
   */
  public static from(data: PptxData): PptxXmlBuilder {
    return new PptxXmlBuilder(data);
  }

  /** @inheritdoc */
  public Slides(index: number): PptxSlideBuilder {
    return this.slide(index);
  }

  /**
   * Navigate to a slide by zero-based index.
   * @param index - Zero-based slide index.
   * @returns A {@link PptxSlideBuilder} for the requested slide.
   * @throws Error if index is not an integer or is out of range.
   */
  public slide(index: number): PptxSlideBuilder {
    if (!Number.isInteger(index)) {
      throw new Error(`Slide index must be an integer. Received: ${index}`);
    }
    if (index < 0 || index >= this.data.slides.length) {
      throw new Error(
        `Slide index ${index} is out of range (0-${Math.max(this.data.slides.length - 1, 0)}).`,
      );
    }

    return new PptxSlideBuilder(this.data.slides[index], this);
  }

  /** @inheritdoc */
  public slides(index: number): PptxSlideBuilder {
    return this.slide(index);
  }

  /** Return the underlying {@link PptxData}. */
  public project(): PptxData {
    return this.data;
  }

  /** Pascal-case alias for {@link project}. */
  public Project(): PptxData {
    return this.project();
  }
}

/**
 * Fluent builder scoped to a single slide.
 * Provides navigation to the slide's elements and notes.
 */
export class PptxSlideBuilder {
  /** The slide being operated on. */
  private readonly slideValue: PptxSlide;

  /** Reference back to the root builder for chaining. */
  private readonly rootBuilder: PptxXmlBuilder;

  /**
   * @param slideValue - The slide data.
   * @param rootBuilder - The parent builder.
   */
  public constructor(slideValue: PptxSlide, rootBuilder: PptxXmlBuilder) {
    this.slideValue = slideValue;
    this.rootBuilder = rootBuilder;
  }

  /** Navigate to the slide's notes builder (getter). */
  public get Notes(): PptxSlideNotesBuilder {
    return new PptxSlideNotesBuilder(this.slideValue, this);
  }

  /** Navigate to the slide's notes builder. */
  public notes(): PptxSlideNotesBuilder {
    return new PptxSlideNotesBuilder(this.slideValue, this);
  }

  /** Navigate to the slide's elements builder. */
  public elements(): PptxSlideElementsBuilder {
    return new PptxSlideElementsBuilder(this.slideValue, this);
  }

  /** Return the underlying slide data. */
  public project(): PptxSlide {
    return this.slideValue;
  }

  /** Pascal-case alias for {@link project}. */
  public Project(): PptxSlide {
    return this.project();
  }

  /** Navigate back to the root builder. */
  public done(): PptxXmlBuilder {
    return this.rootBuilder;
  }

  /** Pascal-case alias for {@link done}. */
  public Done(): PptxXmlBuilder {
    return this.done();
  }
}

/**
 * Fluent builder for manipulating the elements array of a single slide.
 * Supports adding, removing, and updating elements by ID.
 */
export class PptxSlideElementsBuilder {
  private readonly slideValue: PptxSlide;

  private readonly slideBuilder: PptxSlideBuilder;

  /**
   * @param slideValue - The slide whose elements are being modified.
   * @param slideBuilder - The parent slide builder for chaining.
   */
  public constructor(slideValue: PptxSlide, slideBuilder: PptxSlideBuilder) {
    this.slideValue = slideValue;
    this.slideBuilder = slideBuilder;
  }

  /**
   * Append an element to the slide's element list.
   * @param element - The element to add.
   * @returns This builder for chaining.
   */
  public add(element: PptxElement): this {
    this.slideValue.elements = [...this.slideValue.elements, element];
    return this;
  }

  /**
   * Remove an element from the slide by its ID.
   * @param elementId - The ID of the element to remove.
   * @returns This builder for chaining.
   */
  public removeById(elementId: string): this {
    const normalizedId = String(elementId).trim();
    if (normalizedId.length === 0) return this;

    this.slideValue.elements = this.slideValue.elements.filter((element) => {
      return String(element.id).trim() !== normalizedId;
    });
    return this;
  }

  /**
   * Update an element in-place by ID using a transform function.
   * @param elementId - The ID of the element to update.
   * @param updater - A function that receives the current element and returns the replacement.
   * @returns This builder for chaining.
   */
  public updateById(
    elementId: string,
    updater: (current: PptxElement) => PptxElement,
  ): this {
    const normalizedId = String(elementId).trim();
    if (normalizedId.length === 0) return this;

    this.slideValue.elements = this.slideValue.elements.map((element) => {
      if (String(element.id).trim() !== normalizedId) return element;
      return updater(element);
    });
    return this;
  }

  /** Return the current elements array. */
  public project(): PptxElement[] {
    return this.slideValue.elements;
  }

  /** Navigate back to the slide builder. */
  public done(): PptxSlideBuilder {
    return this.slideBuilder;
  }
}

/**
 * Fluent builder for manipulating speaker notes on a single slide.
 * Supports adding, setting, clearing, and retrieving notes text.
 */
export class PptxSlideNotesBuilder {
  private readonly slideValue: PptxSlide;

  private readonly slideBuilder: PptxSlideBuilder;

  /**
   * @param slideValue - The slide whose notes are being modified.
   * @param slideBuilder - The parent slide builder for chaining.
   */
  public constructor(slideValue: PptxSlide, slideBuilder: PptxSlideBuilder) {
    this.slideValue = slideValue;
    this.slideBuilder = slideBuilder;
  }

  /**
   * Append text to existing notes (separated by newline).
   * @param text - The text to append.
   * @returns This builder for chaining.
   */
  public add(text: string): this {
    const nextText = String(text);
    if (nextText.length === 0) return this;

    const currentText = this.slideValue.notes || "";
    this.slideValue.notes =
      currentText.length > 0 ? `${currentText}\n${nextText}` : nextText;
    this.syncSegmentsFromNotes();
    return this;
  }

  /** Pascal-case alias for {@link add}. */
  public Add(text: string): this {
    return this.add(text);
  }

  /**
   * Replace all notes with the given text.
   * @param text - The replacement notes text. Empty string clears notes.
   * @returns This builder for chaining.
   */
  public set(text: string): this {
    const nextText = String(text);
    this.slideValue.notes = nextText.length > 0 ? nextText : undefined;
    this.syncSegmentsFromNotes();
    return this;
  }

  /** Pascal-case alias for {@link set}. */
  public Set(text: string): this {
    return this.set(text);
  }

  /** Remove all notes from the slide. */
  public clear(): this {
    this.slideValue.notes = undefined;
    this.slideValue.notesSegments = undefined;
    return this;
  }

  /** Pascal-case alias for {@link clear}. */
  public Clear(): this {
    return this.clear();
  }

  /** Return the current notes text, or `undefined` if none. */
  public get(): string | undefined {
    return this.slideValue.notes;
  }

  /** Pascal-case alias for {@link get}. */
  public Get(): string | undefined {
    return this.get();
  }

  /** Navigate back to the slide builder. */
  public done(): PptxSlideBuilder {
    return this.slideBuilder;
  }

  /** Pascal-case alias for {@link done}. */
  public Done(): PptxSlideBuilder {
    return this.done();
  }

  /**
   * Synchronize the `notesSegments` array from the plain-text notes string.
   * Splits text on newlines and creates corresponding {@link TextSegment} entries
   * with paragraph break markers between lines.
   */
  private syncSegmentsFromNotes(): void {
    const notesText = this.slideValue.notes || "";
    if (notesText.length === 0) {
      this.slideValue.notesSegments = undefined;
      return;
    }

    const lineValues = notesText.split("\n");
    const segments: TextSegment[] = [];

    lineValues.forEach((lineValue, index) => {
      segments.push({ text: lineValue, style: {} });
      if (index < lineValues.length - 1) {
        segments.push({ text: "\n", isParagraphBreak: true, style: {} });
      }
    });

    this.slideValue.notesSegments = segments;
  }
}
