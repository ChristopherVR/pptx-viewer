/**
 * Fluent builder for {@link TextPptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing text elements.
 * The {@link TextBuilder.build | .build()} method delegates to
 * {@link createTextElement}, so the output is identical to the functional API.
 *
 * @example
 * ```ts
 * const el = TextBuilder.create("Hello World")
 *   .fontSize(24).bold().color("#333333")
 *   .alignment("center")
 *   .position(50, 50).size(400, 60)
 *   .build();
 * ```
 *
 * @module sdk/TextBuilder
 */

import type { TextPptxElement } from '../../types/elements';
import { createTextElement } from './ElementFactory';
import type { TextOptions, TextSegmentInput, FillInput, StrokeInput, ShadowInput } from './types';

/**
 * Fluent builder for {@link TextPptxElement} instances.
 *
 * @example
 * ```ts
 * const el = TextBuilder.create("Hello World")
 *   .fontSize(24).bold().color("#333333")
 *   .alignment("center")
 *   .position(50, 50).size(400, 60)
 *   .build();
 * ```
 */
export class TextBuilder {
	private _text: string | TextSegmentInput[];
	private _options: TextOptions = {};

	private constructor(text: string | TextSegmentInput[]) {
		this._text = text;
	}

	/**
	 * Create a new TextBuilder for the given plain text or rich text segments.
	 *
	 * @param text - A plain string or an array of {@link TextSegmentInput} for rich text.
	 * @returns A new {@link TextBuilder} instance.
	 */
	static create(text: string | TextSegmentInput[]): TextBuilder {
		return new TextBuilder(text);
	}

	// -- Position & size ----------------------------------------------------

	/**
	 * Set the element position (top-left corner) in pixels.
	 *
	 * @param x - Horizontal offset from the left edge of the slide.
	 * @param y - Vertical offset from the top edge of the slide.
	 */
	position(x: number, y: number): this {
		this._options.x = x;
		this._options.y = y;
		return this;
	}

	/**
	 * Set the element dimensions in pixels.
	 *
	 * @param width - Element width.
	 * @param height - Element height.
	 */
	size(width: number, height: number): this {
		this._options.width = width;
		this._options.height = height;
		return this;
	}

	/**
	 * Set position and size in a single call.
	 *
	 * @param x - Horizontal offset.
	 * @param y - Vertical offset.
	 * @param width - Element width.
	 * @param height - Element height.
	 */
	bounds(x: number, y: number, width: number, height: number): this {
		this._options.x = x;
		this._options.y = y;
		this._options.width = width;
		this._options.height = height;
		return this;
	}

	/**
	 * Set the rotation angle in degrees.
	 *
	 * @param degrees - Clockwise rotation in degrees.
	 */
	rotation(degrees: number): this {
		this._options.rotation = degrees;
		return this;
	}

	/**
	 * Set the element opacity.
	 *
	 * @param value - Opacity from 0 (fully transparent) to 1 (fully opaque).
	 */
	opacity(value: number): this {
		this._options.opacity = value;
		return this;
	}

	// -- Text styling -------------------------------------------------------

	/**
	 * Set the font size in points.
	 *
	 * @param size - Font size (e.g. 12, 24, 36).
	 */
	fontSize(size: number): this {
		this._options.fontSize = size;
		return this;
	}

	/**
	 * Set the font family.
	 *
	 * @param family - Font family name (e.g. "Arial", "Calibri").
	 */
	fontFamily(family: string): this {
		this._options.fontFamily = family;
		return this;
	}

	/**
	 * Enable or disable bold text.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 */
	bold(enabled: boolean = true): this {
		this._options.bold = enabled;
		return this;
	}

	/**
	 * Enable or disable italic text.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 */
	italic(enabled: boolean = true): this {
		this._options.italic = enabled;
		return this;
	}

	/**
	 * Enable or disable underlined text.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 */
	underline(enabled: boolean = true): this {
		this._options.underline = enabled;
		return this;
	}

	/**
	 * Enable or disable strikethrough text.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * TextBuilder.create("Deprecated")
	 *   .strikethrough()
	 *   .build();
	 * ```
	 */
	strikethrough(enabled: boolean = true): this {
		this._options.strikethrough = enabled;
		return this;
	}

	/**
	 * Set the text color.
	 *
	 * @param hex - Color as a hex string (e.g. "#FF0000").
	 */
	color(hex: string): this {
		this._options.color = hex;
		return this;
	}

	/**
	 * Set horizontal text alignment.
	 *
	 * @param align - One of "left", "center", "right", or "justify".
	 */
	alignment(align: 'left' | 'center' | 'right' | 'justify'): this {
		this._options.alignment = align;
		return this;
	}

	/**
	 * Set vertical text alignment within the text box.
	 *
	 * @param align - One of "top", "middle", or "bottom".
	 */
	verticalAlignment(align: 'top' | 'middle' | 'bottom'): this {
		this._options.verticalAlignment = align;
		return this;
	}

	/**
	 * Set the line spacing multiplier.
	 *
	 * @param value - Line spacing value (e.g. 1.5 for 150% spacing).
	 */
	lineSpacing(value: number): this {
		this._options.lineSpacing = value;
		return this;
	}

	// -- Fill / stroke / shadow ---------------------------------------------

	/**
	 * Set the background fill of the text box.
	 *
	 * @param input - A {@link FillInput} descriptor (solid, gradient, pattern, image, or none).
	 */
	fill(input: FillInput): this {
		this._options.fill = input;
		return this;
	}

	/**
	 * Set the border stroke of the text box.
	 *
	 * @param input - A {@link StrokeInput} descriptor.
	 */
	stroke(input: StrokeInput): this {
		this._options.stroke = input;
		return this;
	}

	/**
	 * Add a drop shadow to the text box.
	 *
	 * @param input - A {@link ShadowInput} descriptor.
	 */
	shadow(input: ShadowInput): this {
		this._options.shadow = input;
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link TextPptxElement}.
	 *
	 * Delegates to {@link createTextElement} with the accumulated options.
	 *
	 * @returns A fully constructed text element ready for insertion into a slide.
	 */
	build(): TextPptxElement {
		return createTextElement(this._text, this._options);
	}
}
