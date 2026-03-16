/**
 * Fluent builder for {@link ImagePptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing image elements.
 * The {@link ImageBuilder.build | .build()} method delegates to
 * {@link createImageElement}, so the output is identical to the functional API.
 *
 * @example
 * ```ts
 * const el = ImageBuilder.create("data:image/png;base64,...")
 *   .altText("Company logo")
 *   .position(100, 100).size(200, 200)
 *   .build();
 * ```
 *
 * @module sdk/ImageBuilder
 */

import type { ImagePptxElement } from '../../types/elements';
import { createImageElement } from './ElementFactory';
import type { ImageOptions } from './types';

/**
 * Fluent builder for {@link ImagePptxElement} instances.
 *
 * @example
 * ```ts
 * const el = ImageBuilder.create("data:image/png;base64,...")
 *   .altText("Company logo")
 *   .position(100, 100).size(200, 200)
 *   .build();
 * ```
 */
export class ImageBuilder {
	private _source: string;
	private _options: ImageOptions = {};

	private constructor(source: string) {
		this._source = source;
	}

	/**
	 * Create a new ImageBuilder for the given image source.
	 *
	 * @param source - Data URL (`data:image/...;base64,...`) or archive path.
	 * @returns A new {@link ImageBuilder} instance.
	 */
	static create(source: string): ImageBuilder {
		return new ImageBuilder(source);
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

	// -- Image-specific -----------------------------------------------------

	/**
	 * Set the alternative text for accessibility.
	 *
	 * @param text - Descriptive text for the image.
	 */
	altText(text: string): this {
		this._options.altText = text;
		return this;
	}

	/**
	 * Set the crop region as fractional offsets from each edge.
	 *
	 * @param left - Fraction cropped from the left (0 to 1).
	 * @param top - Fraction cropped from the top (0 to 1).
	 * @param right - Fraction cropped from the right (0 to 1).
	 * @param bottom - Fraction cropped from the bottom (0 to 1).
	 */
	crop(left: number, top: number, right: number, bottom: number): this {
		this._options.cropLeft = left;
		this._options.cropTop = top;
		this._options.cropRight = right;
		this._options.cropBottom = bottom;
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link ImagePptxElement}.
	 *
	 * Delegates to {@link createImageElement} with the accumulated options.
	 *
	 * @returns A fully constructed image element ready for insertion into a slide.
	 */
	build(): ImagePptxElement {
		return createImageElement(this._source, this._options);
	}
}
