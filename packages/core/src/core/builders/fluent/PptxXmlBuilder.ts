import type {
  PptxData,
  PptxElement,
  PptxSlide,
  TextSegment,
} from "../../types";

export interface IPptxXmlBuilder {
  Slides(index: number): PptxSlideBuilder;
  slide(index: number): PptxSlideBuilder;
  slides(index: number): PptxSlideBuilder;
  project(): PptxData;
}

export class PptxXmlBuilder implements IPptxXmlBuilder {
  private readonly data: PptxData;

  public constructor(data: PptxData) {
    this.data = data;
  }

  public static from(data: PptxData): PptxXmlBuilder {
    return new PptxXmlBuilder(data);
  }

  public Slides(index: number): PptxSlideBuilder {
    return this.slide(index);
  }

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

  public slides(index: number): PptxSlideBuilder {
    return this.slide(index);
  }

  public project(): PptxData {
    return this.data;
  }

  public Project(): PptxData {
    return this.project();
  }
}

export class PptxSlideBuilder {
  private readonly slideValue: PptxSlide;

  private readonly rootBuilder: PptxXmlBuilder;

  public constructor(slideValue: PptxSlide, rootBuilder: PptxXmlBuilder) {
    this.slideValue = slideValue;
    this.rootBuilder = rootBuilder;
  }

  public get Notes(): PptxSlideNotesBuilder {
    return new PptxSlideNotesBuilder(this.slideValue, this);
  }

  public notes(): PptxSlideNotesBuilder {
    return new PptxSlideNotesBuilder(this.slideValue, this);
  }

  public elements(): PptxSlideElementsBuilder {
    return new PptxSlideElementsBuilder(this.slideValue, this);
  }

  public project(): PptxSlide {
    return this.slideValue;
  }

  public Project(): PptxSlide {
    return this.project();
  }

  public done(): PptxXmlBuilder {
    return this.rootBuilder;
  }

  public Done(): PptxXmlBuilder {
    return this.done();
  }
}

export class PptxSlideElementsBuilder {
  private readonly slideValue: PptxSlide;

  private readonly slideBuilder: PptxSlideBuilder;

  public constructor(slideValue: PptxSlide, slideBuilder: PptxSlideBuilder) {
    this.slideValue = slideValue;
    this.slideBuilder = slideBuilder;
  }

  public add(element: PptxElement): this {
    this.slideValue.elements = [...this.slideValue.elements, element];
    return this;
  }

  public removeById(elementId: string): this {
    const normalizedId = String(elementId).trim();
    if (normalizedId.length === 0) return this;

    this.slideValue.elements = this.slideValue.elements.filter((element) => {
      return String(element.id).trim() !== normalizedId;
    });
    return this;
  }

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

  public project(): PptxElement[] {
    return this.slideValue.elements;
  }

  public done(): PptxSlideBuilder {
    return this.slideBuilder;
  }
}

export class PptxSlideNotesBuilder {
  private readonly slideValue: PptxSlide;

  private readonly slideBuilder: PptxSlideBuilder;

  public constructor(slideValue: PptxSlide, slideBuilder: PptxSlideBuilder) {
    this.slideValue = slideValue;
    this.slideBuilder = slideBuilder;
  }

  public add(text: string): this {
    const nextText = String(text);
    if (nextText.length === 0) return this;

    const currentText = this.slideValue.notes || "";
    this.slideValue.notes =
      currentText.length > 0 ? `${currentText}\n${nextText}` : nextText;
    this.syncSegmentsFromNotes();
    return this;
  }

  public Add(text: string): this {
    return this.add(text);
  }

  public set(text: string): this {
    const nextText = String(text);
    this.slideValue.notes = nextText.length > 0 ? nextText : undefined;
    this.syncSegmentsFromNotes();
    return this;
  }

  public Set(text: string): this {
    return this.set(text);
  }

  public clear(): this {
    this.slideValue.notes = undefined;
    this.slideValue.notesSegments = undefined;
    return this;
  }

  public Clear(): this {
    return this.clear();
  }

  public get(): string | undefined {
    return this.slideValue.notes;
  }

  public Get(): string | undefined {
    return this.get();
  }

  public done(): PptxSlideBuilder {
    return this.slideBuilder;
  }

  public Done(): PptxSlideBuilder {
    return this.done();
  }

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
