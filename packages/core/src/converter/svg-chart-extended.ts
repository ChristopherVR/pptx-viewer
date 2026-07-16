import type { ChartPptxElement } from '../core/types/elements';

const DEFAULT_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];

function esc(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Render a ChartEx funnel as centered, value-scaled trapezoid stages. */
export function renderFunnelChartSvg(
	element: ChartPptxElement,
	x: number,
	y: number,
	width: number,
	height: number,
): string {
	const series = element.chartData?.series[0];
	if (!series?.values.length) {
		return '';
	}
	const values = series.values.map((value) => Math.max(value, 0));
	const maximum = Math.max(...values, 1);
	const stageHeight = height / values.length;
	const widthFor = (value: number): number => width * Math.max(value / maximum, 0.08);

	return values
		.map((value, index) => {
			const topWidth = widthFor(value);
			const nextValue = values[index + 1] ?? value * 0.72;
			const bottomWidth = widthFor(nextValue);
			const center = x + width / 2;
			const top = y + index * stageHeight;
			const bottom = top + Math.max(stageHeight - 1, 0.5);
			const pointColor = series.dataPoints?.find((point) => point.idx === index)?.spPr?.fillColor;
			const fill = pointColor ?? series.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
			const points = [
				`${center - topWidth / 2},${top}`,
				`${center + topWidth / 2},${top}`,
				`${center + bottomWidth / 2},${bottom}`,
				`${center - bottomWidth / 2},${bottom}`,
			].join(' ');
			return `<polygon data-chart-mark="funnel" data-chart-point="${index}" points="${points}" fill="${esc(fill)}" />`;
		})
		.join('');
}
