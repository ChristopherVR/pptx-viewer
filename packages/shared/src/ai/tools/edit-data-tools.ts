/**
 * Data-oriented editing tools: table cells, chart series, and deck-wide
 * find-and-replace. Split out of {@link editExecutors} to keep each source file
 * within the repo's per-file size budget.
 */

import type { PptxChartData, TablePptxElement } from 'pptx-viewer-core';

import type { AiToolContext, AiToolExecutor } from './executor-base';
import { requireElement, requireSlide, routeWrite } from './executor-base';

const updateTableCell: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		elementId: string;
		row: number;
		column: number;
		text: string;
	};
	return routeWrite(ctx, `Edit table cell on slide ${p.slideIndex + 1}`, (slides) => {
		const el = requireElement(requireSlide(slides, p.slideIndex), p.elementId);
		if (el.type !== 'table') {
			throw new Error(`Element '${p.elementId}' is not a table.`);
		}
		const table = el as TablePptxElement;
		const cell = table.tableData?.rows[p.row]?.cells[p.column];
		if (!cell) {
			throw new Error(`Cell (${p.row}, ${p.column}) is out of range.`);
		}
		cell.text = p.text;
		return slides;
	});
};

const updateChartData: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		elementId: string;
		seriesIndex: number;
		values?: number[];
		categories?: string[];
	};
	return routeWrite(ctx, `Edit chart data on slide ${p.slideIndex + 1}`, (slides) => {
		const el = requireElement(requireSlide(slides, p.slideIndex), p.elementId);
		if (el.type !== 'chart') {
			throw new Error(`Element '${p.elementId}' is not a chart.`);
		}
		const chart = (el as unknown as { chartData?: PptxChartData }).chartData;
		if (!chart) {
			throw new Error(`Chart '${p.elementId}' has no data.`);
		}
		const series = chart.series[p.seriesIndex];
		if (!series) {
			throw new Error(`Series ${p.seriesIndex} is out of range.`);
		}
		if (p.values) {
			series.values = p.values;
		}
		if (p.categories) {
			chart.categories = p.categories;
		}
		return slides;
	});
};

/** Build a safe replace regex, rejecting oversized / nested-quantifier patterns. */
function replaceRegex(query: string, useRegex: boolean, caseSensitive: boolean): RegExp {
	if (useRegex && (query.length > 200 || /\([^)]*[+*]\)[+*]/u.test(query))) {
		throw new Error('Unsafe or oversized regular expression rejected.');
	}
	const source = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(source, caseSensitive ? 'g' : 'gi');
}

const replaceAll: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		query: string;
		replacement: string;
		useRegex?: boolean;
		caseSensitive?: boolean;
	};
	const regex = replaceRegex(p.query, p.useRegex === true, p.caseSensitive === true);
	let count = 0;
	const result = routeWrite(ctx, `Replace "${p.query}" across deck`, (slides) => {
		for (const slide of slides) {
			for (const el of slide.elements) {
				if ('text' in el && typeof el.text === 'string') {
					count += (el.text.match(regex) ?? []).length;
					const next = el.text.replace(regex, p.replacement);
					if (next !== el.text) {
						(el as { text: string; textSegments?: { text: string; style: unknown }[] }).text = next;
						const holder = el as { textSegments?: { text: string; style: unknown }[] };
						if (holder.textSegments && holder.textSegments.length > 0) {
							holder.textSegments = [{ text: next, style: holder.textSegments[0].style }];
						}
					}
				}
				if (el.type === 'table') {
					const table = el as TablePptxElement;
					for (const rowData of table.tableData?.rows ?? []) {
						for (const cell of rowData.cells) {
							cell.text = cell.text.replace(regex, p.replacement);
						}
					}
				}
			}
			if (slide.notes) {
				slide.notes = slide.notes.replace(regex, p.replacement);
			}
		}
		return slides;
	});
	return { ...result, replacementCount: count };
};

/** Table / chart / replace executors keyed by tool name. */
export const editDataExecutors = {
	update_table_cell: updateTableCell,
	update_chart_data: updateChartData,
	replace_all: replaceAll,
} satisfies Record<string, AiToolExecutor>;
