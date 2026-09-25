import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	CHART_COLOR_PALETTES,
	chartPaletteColors,
	findChartColorPalette,
	withinLinearTransform,
} from './chart-color-palette-catalog';
import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';
import { OFFICE_THEME_COLORS } from './gallery-theme';

function chart(seriesCount = 4, extra: Partial<PptxChartData> = {}): PptxElement {
	const chartData: PptxChartData = {
		chartType: 'bar',
		barDirection: 'col',
		categories: ['a', 'b', 'c'],
		series: Array.from({ length: seriesCount }, (_, i) => ({
			name: `S${i}`,
			values: [1, 2, 3],
			color: '#123456',
			dataPoints: [{ idx: 0, spPr: { fillColor: '#FF0000' } }],
		})),
		...extra,
	};
	return { id: 'c1', type: 'chart', x: 0, y: 0, width: 300, height: 200, chartData } as PptxElement;
}

/** COM `Format.Fill.ForeColor.RGB` (0xBBGGRR) -> `#RRGGBB`. */
function comHex(rgb: number): string {
	const r = rgb & 0xff;
	const g = (rgb >> 8) & 0xff;
	const b = (rgb >> 16) & 0xff;
	return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function channelDistance(a: string, b: string): number {
	const parse = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
	const [x, y] = [parse(a), parse(b)];
	return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}

/** Read back from PowerPoint (scripts/capture-data-galleries-com.ps1, Office theme). */
const COM_SERIES_RGB: Record<number, number[]> = {
	10: [8544277, 3305961, 2386713, 13999631],
	11: [8544277, 2386713, 9644960, 5126669],
	13: [3057486, 9644960, 13999631, 1860655],
	15: [2447287, 3041754, 7508460, 11648755],
	20: [6250335, 11776947, 9013641, 2171169],
	22: [11648755, 7508460, 3041754, 2447287],
};

describe('chart Colors palettes', () => {
	it('lists Colorful 1-4 and Monochromatic 1-13 (ChartColor 10..26)', () => {
		expect(CHART_COLOR_PALETTES.map((p) => p.id)).toStrictEqual(
			Array.from({ length: 17 }, (_, i) => 10 + i),
		);
		const descriptor = buildRibbonGallery('chartColors', { element: chart() });
		expect(descriptor.sections.map((s) => s.items.length)).toStrictEqual([4, 13]);
	});

	it('spreads a monochromatic palette the way PowerPoint writes it', () => {
		expect([0, 1, 2, 3].map((i) => withinLinearTransform(i, 4))).toStrictEqual([
			{ shade: 58000 },
			{ shade: 86000 },
			{ tint: 86000 },
			{ tint: 58000 },
		]);
		expect([0, 1, 2].map((i) => withinLinearTransform(i, 3))).toStrictEqual([
			{ shade: 65000 },
			{},
			{ tint: 65000 },
		]);
		expect([0, 4, 5, 9].map((i) => withinLinearTransform(i, 10))).toStrictEqual([
			{ shade: 42000 },
			{ shade: 93000 },
			{ tint: 94000 },
			{ tint: 43000 },
		]);
	});

	it('matches the series colours PowerPoint shows for the Office theme', () => {
		for (const [id, rgbs] of Object.entries(COM_SERIES_RGB)) {
			const palette = findChartColorPalette(Number(id));
			if (!palette) {
				throw new Error(`no palette ${id}`);
			}
			const colors = chartPaletteColors(palette, 4, { ...OFFICE_THEME_COLORS });
			rgbs.forEach((rgb, i) => {
				expect(
					channelDistance(colors[i], comHex(rgb)),
					`palette ${id} series ${i}`,
				).toBeLessThanOrEqual(3);
			});
		}
	});

	it('pins every series colour, clears point overrides and marks the pick applied', () => {
		const result = applyRibbonGalleryItem('chartColors', '15', { element: chart() });
		if (result?.kind !== 'element') {
			throw new Error('expected an element patch');
		}
		const data = (result.patch as { chartData: PptxChartData }).chartData;
		expect(data.series.every((s) => s.color && s.color !== '#123456')).toBeTruthy();
		expect(data.series[0].dataPoints?.[0].spPr?.fillColor).toBeUndefined();
		expect(data.colorMethod).toBe('withinLinear');
		expect(data.colorPalette).toStrictEqual([OFFICE_THEME_COLORS.accent2]);
		const rebuilt = buildRibbonGallery('chartColors', {
			element: { ...chart(), chartData: data } as PptxElement,
		});
		const applied = rebuilt.sections.flatMap((s) => s.items).filter((i) => i.applied);
		expect(applied.map((i) => i.id)).toStrictEqual(['15']);
		expect(applyRibbonGalleryItem('chartColors', '9', { element: chart() })).toBeNull();
	});

	it('colours a pie by category', () => {
		const pie = chart(1, { chartType: 'pie', varyColors: true });
		const result = applyRibbonGalleryItem('chartColors', '10', { element: pie });
		if (result?.kind !== 'element') {
			throw new Error('expected an element patch');
		}
		const data = (result.patch as { chartData: PptxChartData }).chartData;
		expect(data.series[0].color).toBeUndefined();
		expect(data.colorPalette).toHaveLength(3);
	});
});

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/chart-gallery.pptx', import.meta.url),
);

describe('chart Colors round trip', () => {
	it('saves the new series fills and colour-style palette through the core handler', async () => {
		const buf = readFileSync(FIXTURE);
		const handler = new PptxHandler();
		const data = await handler.load(
			buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
		);
		const index = 8; // 3-series stacked column
		const slide = data.slides[index];
		const element = slide.elements.find((e) => e.type === 'chart') ?? null;
		const ctx = { element, themeColorMap: data.themeColorMap };
		const result = applyRibbonGalleryItem('chartColors', '12', ctx);
		if (!element || result?.kind !== 'element') {
			throw new Error('expected a chart');
		}
		const expected = (result.patch as { chartData: PptxChartData }).chartData.series.map(
			(s) => s.color,
		);
		const next = { ...element, ...result.patch } as PptxElement;
		const slides = data.slides.map((s, i) =>
			i === index ? { ...s, elements: s.elements.map((e) => (e.id === element.id ? next : e)) } : s,
		);
		const bytes = await handler.save(slides);
		const zip = await JSZip.loadAsync(bytes);
		const chartPath = Object.keys(zip.files).find(
			(p) =>
				/^ppt\/charts\/chart\d+\.xml$/u.test(p) &&
				next.type === 'chart' &&
				next.chartData?.chartPartPath === p,
		);
		const xml = await zip.file(chartPath ?? '')!.async('string');
		for (const color of expected) {
			expect(xml).toContain(`<a:srgbClr val="${color?.slice(1)}"`);
		}
		const reloaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const chart2 = reloaded.slides[index].elements.find((e) => e.type === 'chart');
		expect(chart2?.type === 'chart' && chart2.chartData?.series.map((s) => s.color)).toStrictEqual(
			expected,
		);
	});
});
