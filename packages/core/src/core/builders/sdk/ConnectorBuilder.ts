/**
 * Fluent builder for {@link ConnectorPptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing connector elements.
 * The {@link ConnectorBuilder.build | .build()} method delegates to
 * {@link createConnectorElement}, so the output is identical to the functional API.
 *
 * @example
 * ```ts
 * const el = ConnectorBuilder.create()
 *   .type("curved")
 *   .stroke({ color: "#FF0000", width: 2 })
 *   .endArrow("triangle")
 *   .from("shp_1", 2).to("shp_2", 0)
 *   .position(100, 100).size(300, 0)
 *   .build();
 * ```
 *
 * @module sdk/ConnectorBuilder
 */

import type { ConnectorArrowType } from '../../types/common';
import type { ConnectorPptxElement } from '../../types/elements';
import { createConnectorElement } from './ElementFactory';
import type { ConnectorOptions, StrokeInput } from './types';

/**
 * Fluent builder for {@link ConnectorPptxElement} instances.
 *
 * @example
 * ```ts
 * const el = ConnectorBuilder.create()
 *   .type("curved")
 *   .stroke({ color: "#FF0000", width: 2 })
 *   .endArrow("triangle")
 *   .from("shp_1", 2).to("shp_2", 0)
 *   .position(100, 100).size(300, 0)
 *   .build();
 * ```
 */
export class ConnectorBuilder {
	private _options: ConnectorOptions = {};

	private constructor() {}

	/**
	 * Create a new ConnectorBuilder.
	 *
	 * @returns A new {@link ConnectorBuilder} instance.
	 */
	static create(): ConnectorBuilder {
		return new ConnectorBuilder();
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
	 * For connectors, the width and height define the bounding box of the line.
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

	// -- Connector-specific -------------------------------------------------

	/**
	 * Set the connector line type.
	 *
	 * @param connType - One of "straight", "bent", or "curved".
	 */
	type(connType: 'straight' | 'bent' | 'curved'): this {
		this._options.type = connType;
		return this;
	}

	/**
	 * Set the connector line stroke style.
	 *
	 * @param input - A {@link StrokeInput} descriptor.
	 */
	stroke(input: StrokeInput): this {
		this._options.stroke = input;
		return this;
	}

	/**
	 * Set the arrowhead at the start of the connector.
	 *
	 * @param arrow - The arrow type (e.g. "triangle", "stealth", "oval", "none").
	 */
	startArrow(arrow: ConnectorArrowType): this {
		this._options.startArrow = arrow;
		return this;
	}

	/**
	 * Set the arrowhead at the end of the connector.
	 *
	 * @param arrow - The arrow type (e.g. "triangle", "stealth", "oval", "none").
	 */
	endArrow(arrow: ConnectorArrowType): this {
		this._options.endArrow = arrow;
		return this;
	}

	/**
	 * Connect the start of the connector to a shape.
	 *
	 * @param elementId - The ID of the target element.
	 * @param site - The connection site index on the target shape.
	 */
	from(elementId: string, site: number): this {
		this._options.from = { elementId, site };
		return this;
	}

	/**
	 * Connect the end of the connector to a shape.
	 *
	 * @param elementId - The ID of the target element.
	 * @param site - The connection site index on the target shape.
	 */
	to(elementId: string, site: number): this {
		this._options.to = { elementId, site };
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link ConnectorPptxElement}.
	 *
	 * Delegates to {@link createConnectorElement} with the accumulated options.
	 *
	 * @returns A fully constructed connector element ready for insertion into a slide.
	 */
	build(): ConnectorPptxElement {
		return createConnectorElement(this._options);
	}
}
