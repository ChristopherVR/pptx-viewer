/**
 * Fluent builder for {@link ChartPptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing chart elements.
 * The {@link ChartBuilder.build | .build()} method delegates to
 * {@link createChartElement}, so the output is identical to the functional API.
 *
 * @example
 * ```ts
 * const el = ChartBuilder.create("bar")
 *   .categories(["Q1", "Q2", "Q3"])
 *   .addSeries("Revenue", [100, 150, 130], "#4472C4")
 *   .title("Quarterly Revenue")
 *   .legend(true, "b")
 *   .position(100, 150).size(600, 400)
 *   .build();
 * ```
 *
 * @module sdk/ChartBuilder
 */

import type { PptxChartType } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';
import { createChartElement } from './ElementFactory';
import type { ChartInput, ChartOptions } from './types';

/**
 * Fluent builder for {@link ChartPptxElement} instances.
 *
 * @example
 * ```ts
 * const el = ChartBuilder.create("bar")
 *   .categories(["Q1", "Q2", "Q3"])
 *   .addSeries("Revenue", [100, 150, 130], "#4472C4")
 *   .title("Quarterly Revenue")
 *   .legend(true, "b")
 *   .position(100, 150).size(600, 400)
 *   .build();
 * ```
 */
export class ChartBuilder {
	private _chartType: PptxChartType;
	private _input: ChartInput;
	private _options: ChartOptions = {};

	private constructor(chartType: PptxChartType) {
		this._chartType = chartType;
		this._input = { series: [], categories: [] };
	}

	/**
	 * Create a new ChartBuilder for the given chart type.
	 *
	 * @param chartType - One of the supported {@link PptxChartType} values
	 *   (e.g. "bar", "line", "pie", "doughnut", "area", "scatter").
	 * @returns A new {@link ChartBuilder} instance.
	 */
	static create(chartType: PptxChartType): ChartBuilder {
		return new ChartBuilder(chartType);
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

	// -- Chart data ---------------------------------------------------------

	/**
	 * Set the category labels for the chart axis.
	 *
	 * @param cats - An array of category label strings.
	 */
	categories(cats: string[]): this {
		this._input.categories = cats;
		return this;
	}

	/**
	 * Add a data series to the chart.
	 *
	 * @param name - The series name (shown in the legend).
	 * @param values - The numeric data values for this series.
	 * @param color - Optional color hex string for the series.
	 */
	addSeries(name: string, values: number[], color?: string): this {
		this._input.series.push({ name, values, color });
		return this;
	}

	/**
	 * Set the chart title.
	 *
	 * @param title - The title text displayed above the chart.
	 */
	title(title: string): this {
		this._input.title = title;
		return this;
	}

	/**
	 * Configure the chart legend visibility and position.
	 *
	 * @param show - Whether to show the legend.
	 * @param position - Legend position: "t" (top), "b" (bottom), "l" (left),
	 *   "r" (right), or "tr" (top-right).
	 */
	legend(show: boolean, position?: 't' | 'b' | 'l' | 'r' | 'tr'): this {
		this._input.hasLegend = show;
		if (position !== undefined) {
			this._input.legendPosition = position;
		}
		return this;
	}

	/**
	 * Set the bar/column grouping mode.
	 *
	 * @param mode - One of "clustered", "stacked", or "percentStacked".
	 */
	grouping(mode: 'clustered' | 'stacked' | 'percentStacked'): this {
		this._input.grouping = mode;
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link ChartPptxElement}.
	 *
	 * Delegates to {@link createChartElement} with the accumulated data and options.
	 *
	 * @returns A fully constructed chart element ready for insertion into a slide.
	 */
	build(): ChartPptxElement {
		return createChartElement(this._chartType, this._input, this._options);
	}
}
