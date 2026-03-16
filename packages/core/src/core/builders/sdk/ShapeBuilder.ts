/**
 * Fluent builder for {@link ShapePptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing shape elements.
 * The {@link ShapeBuilder.build | .build()} method delegates to
 * {@link createShapeElement}, so the output is identical to the functional API.
 *
 * @example
 * ```ts
 * const el = ShapeBuilder.create("roundRect")
 *   .fill({ type: "solid", color: "#4472C4" })
 *   .text("Click me")
 *   .position(200, 200).size(300, 200)
 *   .build();
 * ```
 *
 * @module sdk/ShapeBuilder
 */

import type { ShapePptxElement } from '../../types/elements';
import { createShapeElement } from './ElementFactory';
import type { ShapeOptions, TextStyleInput, FillInput, StrokeInput, ShadowInput } from './types';

/**
 * Fluent builder for {@link ShapePptxElement} instances.
 *
 * @example
 * ```ts
 * const el = ShapeBuilder.create("roundRect")
 *   .fill({ type: "solid", color: "#4472C4" })
 *   .text("Click me")
 *   .position(200, 200).size(300, 200)
 *   .build();
 * ```
 */
export class ShapeBuilder {
	private _shapeType: string;
	private _options: ShapeOptions = {};

	private constructor(shapeType: string) {
		this._shapeType = shapeType;
	}

	/**
	 * Create a new ShapeBuilder for the given preset geometry.
	 *
	 * @param shapeType - Preset geometry name (e.g. "rect", "ellipse", "roundRect").
	 * @returns A new {@link ShapeBuilder} instance.
	 */
	static create(shapeType: string): ShapeBuilder {
		return new ShapeBuilder(shapeType);
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

	// -- Styling ------------------------------------------------------------

	/**
	 * Set the shape fill.
	 *
	 * @param input - A {@link FillInput} descriptor (solid, gradient, pattern, image, or none).
	 */
	fill(input: FillInput): this {
		this._options.fill = input;
		return this;
	}

	/**
	 * Set a solid fill color (convenience for `fill({ type: "solid", color })`).
	 *
	 * @param color - Fill color as a hex string (e.g. `"#4472C4"`).
	 * @param opacity - Optional opacity from 0 (transparent) to 1 (opaque).
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * ShapeBuilder.create("rect")
	 *   .solidFill("#4472C4")
	 *   .build();
	 * ```
	 */
	solidFill(color: string, opacity?: number): this {
		this._options.fill = { type: 'solid', color, opacity };
		return this;
	}

	/**
	 * Remove the fill (transparent shape).
	 *
	 * Sets the fill to `{ type: "none" }`, producing a shape with no
	 * background fill.
	 *
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * ShapeBuilder.create("rect")
	 *   .noFill()
	 *   .stroke({ color: "#000", width: 2 })
	 *   .build();
	 * ```
	 */
	noFill(): this {
		this._options.fill = { type: 'none' };
		return this;
	}

	/**
	 * Set a gradient fill (convenience for `fill({ type: "gradient", ... })`).
	 *
	 * @param stops - Array of color stops, each with a `color` and `position` (0-1).
	 * @param angle - Optional gradient angle in degrees (default direction is top-to-bottom).
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * ShapeBuilder.create("rect")
	 *   .gradientFill(
	 *     [{ color: "#FF0000", position: 0 }, { color: "#0000FF", position: 1 }],
	 *     90,
	 *   )
	 *   .build();
	 * ```
	 */
	gradientFill(stops: Array<{ color: string; position: number }>, angle?: number): this {
		this._options.fill = { type: 'gradient', stops, angle };
		return this;
	}

	/**
	 * Set the shape border stroke.
	 *
	 * @param input - A {@link StrokeInput} descriptor.
	 */
	stroke(input: StrokeInput): this {
		this._options.stroke = input;
		return this;
	}

	/**
	 * Add a drop shadow to the shape.
	 *
	 * @param input - A {@link ShadowInput} descriptor.
	 */
	shadow(input: ShadowInput): this {
		this._options.shadow = input;
		return this;
	}

	// -- Shape-specific -----------------------------------------------------

	/**
	 * Set text content inside the shape.
	 *
	 * @param content - The text string to display inside the shape.
	 */
	text(content: string): this {
		this._options.text = content;
		return this;
	}

	/**
	 * Set the text style for the shape's text content.
	 *
	 * @param style - A partial {@link TextStyleInput} for font, size, color, etc.
	 */
	textStyle(style: Partial<TextStyleInput>): this {
		this._options.textStyle = style;
		return this;
	}

	/**
	 * Set shape geometry adjustment values.
	 *
	 * @param adj - A record of adjustment handle names to numeric values.
	 */
	adjustments(adj: Record<string, number>): this {
		this._options.adjustments = adj;
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link ShapePptxElement}.
	 *
	 * Delegates to {@link createShapeElement} with the accumulated options.
	 *
	 * @returns A fully constructed shape element ready for insertion into a slide.
	 */
	build(): ShapePptxElement {
		return createShapeElement(this._shapeType, this._options);
	}
}
