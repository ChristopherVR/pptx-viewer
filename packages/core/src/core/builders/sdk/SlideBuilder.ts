/**
 * Fluent builder for constructing slides with elements.
 *
 * Provides a chainable API for adding elements, setting slide properties,
 * and building a complete {@link PptxSlide}.
 *
 * @module sdk/SlideBuilder
 */

import type { PptxSlide } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import type { PptxChartType } from "../../types/chart";
import type {
	TextOptions,
	TextSegmentInput,
	ShapeOptions,
	ImageOptions,
	TableInput,
	TableOptions,
	ChartInput,
	ChartOptions,
	ConnectorOptions,
	MediaOptions,
	GroupOptions,
	BackgroundInput,
	TransitionInput,
	AnimationInput,
} from "./types";
import {
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createImageElement,
	createTableElement,
	createChartElement,
	createMediaElement,
	createGroupElement,
} from "./ElementFactory";

/**
 * Fluent builder for a single slide.
 *
 * @example
 * ```ts
 * const slide = new SlideBuilder(1)
 *   .addText("Hello World", { fontSize: 36, bold: true, x: 100, y: 50 })
 *   .addShape("roundRect", { fill: { type: "solid", color: "#4472C4" } })
 *   .setNotes("Remember to mention key points")
 *   .setBackground({ type: "solid", color: "#F5F5F5" })
 *   .build();
 * ```
 */
export class SlideBuilder {
	private readonly slide: PptxSlide;

	/**
	 * @param slideNumber - 1-based slide number.
	 * @param layoutPath - Optional layout archive path.
	 * @param layoutName - Optional layout display name.
	 */
	constructor(
		slideNumber: number,
		layoutPath?: string,
		layoutName?: string,
	) {
		this.slide = {
			id: `slide${slideNumber}`,
			rId: `rId${slideNumber + 1}`,
			slideNumber,
			elements: [],
			layoutPath: layoutPath ?? "ppt/slideLayouts/slideLayout1.xml",
			layoutName: layoutName ?? "Title Slide",
		};
	}

	/** Add a text box to the slide. */
	addText(
		text: string | TextSegmentInput[],
		options?: TextOptions,
	): this {
		this.slide.elements.push(createTextElement(text, options));
		return this;
	}

	/** Add a shape to the slide. */
	addShape(shapeType: string, options?: ShapeOptions): this {
		this.slide.elements.push(createShapeElement(shapeType, options));
		return this;
	}

	/** Add a connector (line) to the slide. */
	addConnector(options?: ConnectorOptions): this {
		this.slide.elements.push(createConnectorElement(options));
		return this;
	}

	/** Add an image to the slide. */
	addImage(source: string, options?: ImageOptions): this {
		this.slide.elements.push(createImageElement(source, options));
		return this;
	}

	/** Add a table to the slide. */
	addTable(input: TableInput, options?: TableOptions): this {
		this.slide.elements.push(createTableElement(input, options));
		return this;
	}

	/** Add a chart to the slide. */
	addChart(
		chartType: PptxChartType,
		input: ChartInput,
		options?: ChartOptions,
	): this {
		this.slide.elements.push(createChartElement(chartType, input, options));
		return this;
	}

	/** Add a media element (video or audio) to the slide. */
	addMedia(
		mediaType: "video" | "audio",
		source: string,
		options?: MediaOptions,
	): this {
		this.slide.elements.push(
			createMediaElement(mediaType, source, options),
		);
		return this;
	}

	/** Add a group of elements to the slide. */
	addGroup(children: PptxElement[], options?: GroupOptions): this {
		this.slide.elements.push(createGroupElement(children, options));
		return this;
	}

	/** Add a pre-built element directly. */
	addElement(element: PptxElement): this {
		this.slide.elements.push(element);
		return this;
	}

	/** Set slide background. */
	setBackground(bg: BackgroundInput): this {
		switch (bg.type) {
			case "solid":
				this.slide.backgroundColor = bg.color;
				break;
			case "gradient": {
				const stops = bg.stops
					.map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
					.join(", ");
				this.slide.backgroundGradient = `linear-gradient(${bg.angle ?? 180}deg, ${stops})`;
				break;
			}
			case "image":
				this.slide.backgroundImage = bg.source;
				break;
		}
		return this;
	}

	/** Set slide transition. */
	setTransition(input: TransitionInput): this {
		this.slide.transition = {
			type: input.type,
			durationMs: input.duration ?? 500,
			direction: input.direction as
				| "l"
				| "r"
				| "u"
				| "d"
				| undefined,
			advanceAfterMs: input.advanceAfterMs,
		};
		return this;
	}

	/** Add an animation to an element on this slide. */
	addAnimation(elementId: string, input: AnimationInput): this {
		if (!this.slide.animations) {
			this.slide.animations = [];
		}
		this.slide.animations.push({
			elementId,
			entrance: input.preset,
			trigger: input.trigger ?? "onClick",
			durationMs: input.duration ?? 500,
			delayMs: input.delay ?? 0,
		});
		return this;
	}

	/** Set speaker notes. */
	setNotes(text: string): this {
		this.slide.notes = text;
		return this;
	}

	/** Mark the slide as hidden. */
	setHidden(hidden: boolean): this {
		this.slide.hidden = hidden;
		return this;
	}

	/** Assign the slide to a section. */
	setSection(name: string, id?: string): this {
		this.slide.sectionName = name;
		this.slide.sectionId = id;
		return this;
	}

	/** Return the built {@link PptxSlide}. */
	build(): PptxSlide {
		return this.slide;
	}
}
