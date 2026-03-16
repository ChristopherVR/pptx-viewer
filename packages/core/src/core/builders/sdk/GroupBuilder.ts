/**
 * Fluent builder for {@link GroupPptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing group
 * elements that contain child elements. The {@link GroupBuilder.build | .build()}
 * method delegates to {@link createGroupElement}, so the output is identical
 * to the functional API.
 *
 * @example
 * ```ts
 * const el = GroupBuilder.create()
 *   .addChild(ShapeBuilder.create("rect").solidFill("#FF0000").build())
 *   .addChild(TextBuilder.create("Label").fontSize(18).build())
 *   .position(100, 100).size(400, 300)
 *   .build();
 * ```
 *
 * @module sdk/GroupBuilder
 */

import type { GroupPptxElement, PptxElement } from '../../types/elements';
import { createGroupElement } from './ElementFactory';
import type { GroupOptions } from './types';

/**
 * Fluent builder for {@link GroupPptxElement} instances.
 *
 * @example
 * ```ts
 * const el = GroupBuilder.create()
 *   .addChild(ShapeBuilder.create("rect").solidFill("#FF0000").build())
 *   .addChildBuilder(TextBuilder.create("Label").fontSize(18))
 *   .position(100, 100).size(400, 300)
 *   .build();
 * ```
 */
export class GroupBuilder {
	private _children: PptxElement[] = [];
	private _options: GroupOptions = {};

	private constructor() {}

	/**
	 * Create a new empty GroupBuilder.
	 *
	 * @returns A new {@link GroupBuilder} instance with no children.
	 *
	 * @example
	 * ```ts
	 * const group = GroupBuilder.create()
	 *   .addChild(someElement)
	 *   .build();
	 * ```
	 */
	static create(): GroupBuilder {
		return new GroupBuilder();
	}

	// -- Position & size ----------------------------------------------------

	/**
	 * Set the element position (top-left corner) in pixels.
	 *
	 * @param x - Horizontal offset from the left edge of the slide.
	 * @param y - Vertical offset from the top edge of the slide.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * GroupBuilder.create().position(50, 100).build();
	 * ```
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
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * GroupBuilder.create().size(400, 300).build();
	 * ```
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
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * GroupBuilder.create().bounds(50, 100, 400, 300).build();
	 * ```
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
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * GroupBuilder.create().rotation(45).build();
	 * ```
	 */
	rotation(degrees: number): this {
		this._options.rotation = degrees;
		return this;
	}

	// -- Children -----------------------------------------------------------

	/**
	 * Add a pre-built element as a child.
	 *
	 * @param element - A fully constructed {@link PptxElement} to include in the group.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * const shape = ShapeBuilder.create("rect").solidFill("#FF0000").build();
	 * GroupBuilder.create().addChild(shape).build();
	 * ```
	 */
	addChild(element: PptxElement): this {
		this._children.push(element);
		return this;
	}

	/**
	 * Add a child from any element builder (calls `.build()` for you).
	 *
	 * Accepts any object with a `build()` method that returns a {@link PptxElement},
	 * such as {@link TextBuilder}, {@link ShapeBuilder}, {@link ImageBuilder}, etc.
	 *
	 * @param builder - An element builder with a `.build()` method.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * GroupBuilder.create()
	 *   .addChildBuilder(TextBuilder.create("Hello").fontSize(24))
	 *   .addChildBuilder(ShapeBuilder.create("rect").solidFill("#00FF00"))
	 *   .build();
	 * ```
	 */
	addChildBuilder(builder: { build(): PptxElement }): this {
		this._children.push(builder.build());
		return this;
	}

	/**
	 * Add multiple pre-built elements as children.
	 *
	 * @param elements - An array of {@link PptxElement} instances to include in the group.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * const shapes = [shape1, shape2, shape3];
	 * GroupBuilder.create().addChildren(shapes).build();
	 * ```
	 */
	addChildren(elements: PptxElement[]): this {
		this._children.push(...elements);
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link GroupPptxElement}.
	 *
	 * Delegates to {@link createGroupElement} with the accumulated children and options.
	 *
	 * @returns A fully constructed group element ready for insertion into a slide.
	 *
	 * @example
	 * ```ts
	 * const el = GroupBuilder.create()
	 *   .addChildBuilder(ShapeBuilder.create("ellipse").solidFill("#4472C4"))
	 *   .addChildBuilder(TextBuilder.create("Label").fontSize(14))
	 *   .position(100, 100).size(400, 300)
	 *   .build();
	 * ```
	 */
	build(): GroupPptxElement {
		return createGroupElement(this._children, this._options);
	}
}
