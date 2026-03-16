/**
 * Fluent builder for {@link TablePptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing table elements.
 * The {@link TableBuilder.build | .build()} method delegates to
 * {@link createTableElement}, so the output is identical to the functional API.
 *
 * @example
 * ```ts
 * const el = TableBuilder.create()
 *   .headerRow(["Name", "Score"])
 *   .addRow(["Alice", "95"])
 *   .addRow(["Bob", "87"])
 *   .bandRows()
 *   .position(50, 150).size(860, 200)
 *   .build();
 * ```
 *
 * @module sdk/TableBuilder
 */

import type { TablePptxElement } from '../../types/elements';
import { createTableElement } from './ElementFactory';
import type { TableInput, TableCellInput, TableOptions } from './types';

/**
 * Fluent builder for {@link TablePptxElement} instances.
 *
 * @example
 * ```ts
 * const el = TableBuilder.create()
 *   .headerRow(["Name", "Score"])
 *   .addRow(["Alice", "95"])
 *   .addRow(["Bob", "87"])
 *   .bandRows()
 *   .position(50, 150).size(860, 200)
 *   .build();
 * ```
 */
export class TableBuilder {
	private _input: TableInput;
	private _options: TableOptions = {};

	private constructor() {
		this._input = { rows: [] };
	}

	/**
	 * Create a new empty TableBuilder.
	 *
	 * @returns A new {@link TableBuilder} instance with no rows.
	 */
	static create(): TableBuilder {
		return new TableBuilder();
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

	// -- Table rows ---------------------------------------------------------

	/**
	 * Add a data row to the table.
	 *
	 * String cells are automatically converted to {@link TableCellInput} objects.
	 *
	 * @param cells - An array of cell values (strings or {@link TableCellInput} objects).
	 */
	addRow(cells: (string | TableCellInput)[]): this {
		this._input.rows.push({
			cells: cells.map((c) => (typeof c === 'string' ? { text: c } : c)),
		});
		return this;
	}

	/**
	 * Add a header row and enable the `firstRow` table flag.
	 *
	 * This is a convenience method that marks the table as having a header row
	 * and adds the row in one step. Typically called once before any
	 * {@link addRow} calls.
	 *
	 * @param cells - An array of header cell values.
	 */
	headerRow(cells: (string | TableCellInput)[]): this {
		this._input.firstRow = true;
		return this.addRow(cells);
	}

	/**
	 * Set explicit column widths. Values are treated as proportions and
	 * normalized internally.
	 *
	 * @param widths - An array of numeric width proportions (one per column).
	 */
	columnWidths(widths: number[]): this {
		this._input.columnWidths = widths;
		return this;
	}

	/**
	 * Enable or disable alternating row banding.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 */
	bandRows(enabled: boolean = true): this {
		this._input.bandRows = enabled;
		return this;
	}

	/**
	 * Enable or disable alternating column banding.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 */
	bandColumns(enabled: boolean = true): this {
		this._input.bandColumns = enabled;
		return this;
	}

	/**
	 * Enable or disable last-row highlighting.
	 *
	 * When enabled, the table renderer applies special styling to the
	 * last row (e.g. bold text, border emphasis).
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * TableBuilder.create()
	 *   .headerRow(["Name", "Score"])
	 *   .addRow(["Alice", "95"])
	 *   .addRow(["Total", "95"])
	 *   .lastRow()
	 *   .build();
	 * ```
	 */
	lastRow(enabled?: boolean): this {
		this._input.lastRow = enabled ?? true;
		return this;
	}

	/**
	 * Enable or disable first-column highlighting.
	 *
	 * When enabled, the table renderer applies special styling to the
	 * first column (e.g. bold text).
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * TableBuilder.create()
	 *   .addRow(["Category", "Value"])
	 *   .addRow(["Sales", "100"])
	 *   .firstCol()
	 *   .build();
	 * ```
	 */
	firstCol(enabled?: boolean): this {
		this._input.firstCol = enabled ?? true;
		return this;
	}

	/**
	 * Enable or disable last-column highlighting.
	 *
	 * When enabled, the table renderer applies special styling to the
	 * last column (e.g. bold text, border emphasis).
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * TableBuilder.create()
	 *   .addRow(["Name", "Q1", "Total"])
	 *   .addRow(["Alice", "95", "95"])
	 *   .lastCol()
	 *   .build();
	 * ```
	 */
	lastCol(enabled?: boolean): this {
		this._input.lastCol = enabled ?? true;
		return this;
	}

	/**
	 * Set the table style identifier.
	 *
	 * @param styleId - A table style ID string (e.g. from the OOXML table style catalog).
	 */
	style(styleId: string): this {
		this._input.style = styleId;
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link TablePptxElement}.
	 *
	 * Delegates to {@link createTableElement} with the accumulated input and options.
	 *
	 * @returns A fully constructed table element ready for insertion into a slide.
	 */
	build(): TablePptxElement {
		return createTableElement(this._input, this._options);
	}
}
