import type { PptxChartSeries } from '../core/types/chart';
import type {
	ChartPptxElement,
	ContentPartPptxElement,
	MediaPptxElement,
	Model3DPptxElement,
	OlePptxElement,
	SmartArtPptxElement,
	ZoomPptxElement,
} from '../core/types/elements';
import type { PptxSmartArtDrawingShape } from '../core/types/smart-art';
import { relayoutSmartArt } from '../core/utils';
import { renderFunnelChartSvg } from './svg-chart-extended';

function esc(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function color(series: PptxChartSeries, index: number): string {
	const palette = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
	return series.color ?? palette[index % palette.length];
}

function chartValues(element: ChartPptxElement): number[] {
	return element.chartData?.series.flatMap((series) => series.values).filter(Number.isFinite) ?? [];
}

function renderBars(element: ChartPptxElement, x: number, y: number, w: number, h: number): string {
	const data = element.chartData!;
	const values = chartValues(element);
	const min = Math.min(0, ...values);
	const max = Math.max(0, ...values);
	const span = max - min || 1;
	const zeroY = y + (max / span) * h;
	const categoryCount = Math.max(
		data.categories.length,
		...data.series.map((s) => s.values.length),
		1,
	);
	const clusterWidth = w / categoryCount;
	const barWidth = (clusterWidth * 0.72) / Math.max(data.series.length, 1);
	const parts = [`<line x1="${x}" y1="${zeroY}" x2="${x + w}" y2="${zeroY}" stroke="#666666" />`];
	data.series.forEach((series, seriesIndex) => {
		series.values.forEach((value, categoryIndex) => {
			const valueY = y + ((max - value) / span) * h;
			parts.push(
				`<rect data-chart-mark="bar" x="${x + categoryIndex * clusterWidth + clusterWidth * 0.14 + seriesIndex * barWidth}" y="${Math.min(valueY, zeroY)}" width="${Math.max(barWidth - 1, 1)}" height="${Math.max(Math.abs(zeroY - valueY), 0.5)}" fill="${esc(color(series, seriesIndex))}" />`,
			);
		});
	});
	return parts.join('');
}

function renderLines(
	element: ChartPptxElement,
	x: number,
	y: number,
	w: number,
	h: number,
): string {
	const data = element.chartData!;
	const values = chartValues(element);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	return data.series
		.map((series, seriesIndex) => {
			const denominator = Math.max(series.values.length - 1, 1);
			const points = series.values
				.map((value, index) => `${x + (index / denominator) * w},${y + ((max - value) / span) * h}`)
				.join(' ');
			return `<polyline data-chart-mark="line" points="${points}" fill="none" stroke="${esc(color(series, seriesIndex))}" stroke-width="2" />`;
		})
		.join('');
}

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
	const radians = ((angle - 90) * Math.PI) / 180;
	return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

function renderPie(element: ChartPptxElement, x: number, y: number, w: number, h: number): string {
	const series = element.chartData!.series[0];
	if (!series) {
		return '';
	}
	const values = series.values.map((value) => Math.max(value, 0));
	const total = values.reduce((sum, value) => sum + value, 0);
	if (total <= 0) {
		return '';
	}
	const cx = x + w / 2;
	const cy = y + h / 2;
	const radius = Math.max(Math.min(w, h) / 2, 1);
	let angle = 0;
	return values
		.map((value, index) => {
			const sweep = (value / total) * 360;
			const [sx, sy] = polar(cx, cy, radius, angle);
			const [ex, ey] = polar(cx, cy, radius, angle + sweep);
			const pointColor = series.dataPoints?.find((point) => point.idx === index)?.spPr?.fillColor;
			const path = `<path data-chart-mark="slice" d="M ${cx} ${cy} L ${sx} ${sy} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${ex} ${ey} Z" fill="${esc(color({ ...series, color: pointColor ?? series.color }, index))}" />`;
			angle += sweep;
			return path;
		})
		.join('');
}

export function renderChartSvg(element: ChartPptxElement): string | null {
	const data = element.chartData;
	if (!data || data.series.length === 0 || chartValues(element).length === 0) {
		return null;
	}
	const titleHeight = data.title ? Math.min(element.height * 0.16, 28) : 0;
	const x = Math.max(element.width * 0.08, 8);
	const y = titleHeight + Math.max(element.height * 0.06, 6);
	const w = Math.max(element.width - x * 1.5, 1);
	const h = Math.max(element.height - y - Math.max(element.height * 0.1, 10), 1);
	const pie =
		data.chartType === 'pie' || data.chartType === 'pie3D' || data.chartType === 'doughnut';
	const line =
		data.chartType === 'line' || data.chartType === 'line3D' || data.chartType === 'scatter';
	const marks =
		data.chartType === 'funnel'
			? renderFunnelChartSvg(element, x, y, w, h)
			: pie
				? renderPie(element, x, y, w, h)
				: line
					? renderLines(element, x, y, w, h)
					: renderBars(element, x, y, w, h);
	const title = data.title
		? `<text x="${element.width / 2}" y="${Math.max(titleHeight * 0.75, 14)}" text-anchor="middle" font-family="Arial" font-size="14" fill="#222222">${esc(data.title)}</text>`
		: '';
	return `<g data-pptx-element="chart" data-chart-type="${esc(data.chartType)}"><rect width="${element.width}" height="${element.height}" fill="#FFFFFF" />${title}${marks}</g>`;
}

function renderSmartArtShape(shape: PptxSmartArtDrawingShape): string {
	const fill = esc(shape.fillColor ?? '#4472C4');
	const stroke = esc(shape.strokeColor ?? '#FFFFFF');
	const transform = shape.rotation
		? ` transform="rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})"`
		: '';
	let geometry: string;
	if (shape.shapeType === 'ellipse') {
		geometry = `<ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${shape.width / 2}" ry="${shape.height / 2}" fill="${fill}" stroke="${stroke}" />`;
	} else if (shape.shapeType === 'diamond') {
		geometry = `<polygon points="${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height / 2} ${shape.x + shape.width / 2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height / 2}" fill="${fill}" stroke="${stroke}" />`;
	} else {
		geometry = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.shapeType === 'roundRect' ? Math.min(shape.width, shape.height) * 0.12 : 0}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.strokeWidth ?? 1}" />`;
	}
	const text = shape.text
		? `<text x="${shape.x + shape.width / 2}" y="${shape.y + shape.height / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial" font-size="${shape.fontSize ?? 12}" fill="${esc(shape.fontColor ?? '#FFFFFF')}">${esc(shape.text)}</text>`
		: '';
	return `<g data-smartart-shape="${esc(shape.id)}"${transform}>${geometry}${text}</g>`;
}

export function renderSmartArtSvg(element: SmartArtPptxElement): string | null {
	const data = element.smartArtData;
	if (!data) {
		return null;
	}
	const shapes = data.drawingShapes?.length
		? data.drawingShapes
		: relayoutSmartArt(data, element.width, element.height);
	if (shapes.length === 0) {
		return null;
	}
	const chrome = data.chrome;
	const background = chrome?.backgroundColor
		? `<rect width="${element.width}" height="${element.height}" fill="${esc(chrome.backgroundColor)}" stroke="${esc(chrome.outlineColor ?? 'none')}" stroke-width="${chrome.outlineWidth ?? 0}" />`
		: '';
	return `<g data-pptx-element="smartArt">${background}${shapes.map(renderSmartArtShape).join('')}</g>`;
}

function previewImage(
	source: string | undefined,
	kind: string,
	width: number,
	height: number,
): string | null {
	if (!source || !source.startsWith('data:image/')) {
		return null;
	}
	return `<image data-pptx-element="${kind}" width="${width}" height="${height}" preserveAspectRatio="none" href="${esc(source)}" />`;
}

export function renderMediaPreviewSvg(element: MediaPptxElement): string | null {
	return previewImage(element.posterFrameData, 'media', element.width, element.height);
}

export function renderOlePreviewSvg(element: OlePptxElement): string | null {
	return previewImage(
		element.previewImageData ?? element.previewImage,
		'ole',
		element.width,
		element.height,
	);
}

export function renderModel3DPreviewSvg(element: Model3DPptxElement): string | null {
	return previewImage(
		element.posterImage ?? element.svgData ?? element.imageData,
		'model3d',
		element.width,
		element.height,
	);
}

export function renderContentPartSvg(element: ContentPartPptxElement): string | null {
	if (!element.inkStrokes?.length) {
		return null;
	}
	const strokes = element.inkStrokes
		.map(
			(stroke) =>
				`<path data-content-part="ink" d="${esc(stroke.path)}" fill="none" stroke="${esc(stroke.color)}" stroke-width="${stroke.width}" stroke-opacity="${stroke.opacity}" stroke-linecap="round" stroke-linejoin="round" />`,
		)
		.join('');
	return `<g data-pptx-element="contentPart">${strokes}</g>`;
}

export function renderZoomPreviewSvg(element: ZoomPptxElement): string | null {
	return previewImage(element.svgData ?? element.imageData, 'zoom', element.width, element.height);
}
