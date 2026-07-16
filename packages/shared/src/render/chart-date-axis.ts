import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';

import { chartAxisTextStyle, chartLineStyle } from './chart-axis-style';
import type { PlotLayout, SvgLine, SvgText } from './chart-view-model';

const DAY_MS = 86_400_000;

export interface DateAxisPlan {
	sourceIndices: number[];
	xPositions: number[];
	labels: SvgText[];
	tickMarks: SvgLine[];
}

export function excelSerialToDate(serial: number, date1904 = false): Date {
	const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, serial < 60 ? 31 : 30);
	return new Date(epoch + serial * DAY_MS);
}

function primaryDateAxis(chartData: PptxChartData): PptxChartAxisFormatting | undefined {
	return (
		chartData.axes?.find((axis) => axis.axisType === 'dateAx' && axis.axPos !== 't') ??
		chartData.axes?.find((axis) => axis.axisType === 'dateAx')
	);
}

function serialToX(serial: number, min: number, max: number, layout: PlotLayout): number {
	const ratio = max === min ? 0.5 : (serial - min) / (max - min);
	return layout.plotLeft + ratio * layout.plotWidth;
}

function addUnit(date: Date, amount: number, unit: 'days' | 'months' | 'years'): Date {
	const next = new Date(date);
	if (unit === 'days') {
		next.setUTCDate(next.getUTCDate() + amount);
	} else if (unit === 'months') {
		next.setUTCMonth(next.getUTCMonth() + amount);
	} else {
		next.setUTCFullYear(next.getUTCFullYear() + amount);
	}
	return next;
}

function formatDate(date: Date, unit: 'days' | 'months' | 'years', format?: string): string {
	const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
	const year = String(date.getUTCFullYear());
	const day = String(date.getUTCDate());
	if (format?.toLowerCase().includes('yyyy')) {
		return format.toLowerCase().includes('d') ? `${day} ${month} ${year}` : `${month} ${year}`;
	}
	if (unit === 'years') {
		return year;
	}
	if (unit === 'months') {
		return `${month} ${year}`;
	}
	return `${day} ${month}`;
}

function tickLine(
	x: number,
	y: number,
	axis: PptxChartAxisFormatting,
	minor: boolean,
): SvgLine | undefined {
	const placement = minor ? axis.minorTickMark : axis.majorTickMark;
	if (!placement || placement === 'none') {
		return undefined;
	}
	const length = minor ? 2.5 : 4;
	const direction = axis.axPos === 't' ? 1 : -1;
	const inward = direction * length;
	const outward = -inward;
	const [start, end] =
		placement === 'cross' ? [-length, length] : placement === 'in' ? [0, inward] : [0, outward];
	return {
		kind: 'line',
		x1: x,
		y1: y + start,
		x2: x,
		y2: y + end,
		...chartLineStyle(axis.spPr),
	};
}

function calendarTicks(
	min: number,
	max: number,
	date1904: boolean,
	unit: 'days' | 'months' | 'years',
	step: number,
): number[] {
	const result: number[] = [];
	let date = excelSerialToDate(min, date1904);
	for (
		let guard = 0;
		guard < 1000 && date.getTime() <= excelSerialToDate(max, date1904).getTime();
		guard++
	) {
		result.push(min + (date.getTime() - excelSerialToDate(min, date1904).getTime()) / DAY_MS);
		date = addUnit(date, step, unit);
	}
	return result;
}

/** Build a continuous calendar scale for classic ChartML date categories. */
export function buildDateAxisPlan(
	chartData: PptxChartData,
	layout: PlotLayout,
	selectedAxis?: PptxChartAxisFormatting,
	axisY?: number,
): DateAxisPlan | undefined {
	const dates = chartData.dateCategories;
	const axis = selectedAxis ?? primaryDateAxis(chartData);
	if (!dates || !axis || dates.values.length === 0) {
		return undefined;
	}
	const indexed = dates.values
		.map((value, index) => ({ value, index }))
		.sort((a, b) => a.value - b.value);
	const dataMin = indexed[0]?.value ?? 0;
	const dataMax = indexed[indexed.length - 1]?.value ?? dataMin;
	const min = axis.min ?? dataMin;
	const max = axis.max ?? dataMax;
	const visible = indexed.filter(({ value }) => value >= min && value <= max);
	if (axis.orientation === 'maxMin') {
		visible.reverse();
	}
	const sourceIndices = visible.map(({ index }) => index);
	const xPositions = visible.map(({ value }) => {
		const x = serialToX(value, min, max, layout);
		return axis.orientation === 'maxMin'
			? layout.plotLeft + layout.plotWidth - (x - layout.plotLeft)
			: x;
	});
	const unit = axis.majorTimeUnit ?? axis.baseTimeUnit ?? 'days';
	const ticks = calendarTicks(
		min,
		max,
		dates.date1904 ?? false,
		unit,
		Math.max(1, axis.majorUnit ?? 1),
	);
	const y = axisY ?? (axis.axPos === 't' ? layout.plotTop : layout.plotBottom);
	const offset = 4 + 8 * ((axis.labelOffset ?? 100) / 100);
	const labelsAbove =
		axis.tickLblPos === 'high' || (axis.tickLblPos !== 'low' && axis.axPos === 't');
	const labelY =
		axis.tickLblPos === 'high' ? layout.plotTop : axis.tickLblPos === 'low' ? layout.plotBottom : y;
	const labelSkip = Math.max(1, axis.tickLabelSkip ?? 1);
	const labels =
		axis.deleted || axis.tickLblPos === 'none'
			? []
			: ticks.flatMap((serial, index) => {
					if (index % labelSkip !== 0) {
						return [];
					}
					let x = serialToX(serial, min, max, layout);
					if (axis.orientation === 'maxMin') {
						x = layout.plotLeft + layout.plotWidth - (x - layout.plotLeft);
					}
					return [
						{
							kind: 'text' as const,
							x,
							y: labelsAbove ? labelY - offset : labelY + offset,
							text: formatDate(
								excelSerialToDate(serial, dates.date1904),
								unit,
								axis.numFmt?.formatCode ?? dates.formatCode,
							),
							...chartAxisTextStyle(axis),
							textAnchor: 'middle' as const,
						},
					];
				});
	const tickMarks = axis.deleted
		? []
		: ticks.flatMap((serial, index) => {
				if (index % Math.max(1, axis.tickMarkSkip ?? 1) !== 0) {
					return [];
				}
				let x = serialToX(serial, min, max, layout);
				if (axis.orientation === 'maxMin') {
					x = layout.plotLeft + layout.plotWidth - (x - layout.plotLeft);
				}
				const line = tickLine(x, y, axis, false);
				return line ? [line] : [];
			});
	if (!axis.deleted && axis.spPr) {
		tickMarks.unshift({
			kind: 'line',
			x1: layout.plotLeft,
			y1: y,
			x2: layout.plotRight,
			y2: y,
			...chartLineStyle(axis.spPr),
		});
	}
	if (!axis.deleted && axis.minorTickMark && axis.minorTickMark !== 'none') {
		const minorUnit = axis.minorTimeUnit ?? axis.baseTimeUnit ?? unit;
		for (const serial of calendarTicks(
			min,
			max,
			dates.date1904 ?? false,
			minorUnit,
			Math.max(1, axis.minorUnit ?? 1),
		)) {
			let x = serialToX(serial, min, max, layout);
			if (axis.orientation === 'maxMin') {
				x = layout.plotLeft + layout.plotWidth - (x - layout.plotLeft);
			}
			const line = tickLine(x, y, axis, true);
			if (line) {
				tickMarks.push(line);
			}
		}
	}
	return { sourceIndices, xPositions, labels, tickMarks };
}
