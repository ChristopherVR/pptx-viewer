import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getChartStylePalette } from './chart-helpers';
import { applyChartStylePreset, buildChartStylePresets } from './chart-quick-action-styles';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
		...overrides,
	} as PptxChartData;
}

describe('buildChartStylePresets', () => {
	it('returns six presets, none applied when the chart has no colorPalette', () => {
		const presets = buildChartStylePresets(chart());
		expect(presets).toHaveLength(6);
		expect(presets.every((p) => !p.applied)).toBeTruthy();
		expect(presets.every((p) => p.colors.length > 0)).toBeTruthy();
	});

	it('marks the matching preset applied when colorPalette matches its resolved colours', () => {
		const colorful = getChartStylePalette(2);
		const data = chart({ colorPalette: [...colorful] });
		const presets = buildChartStylePresets(data);
		const applied = presets.filter((p) => p.applied);
		expect(applied).toHaveLength(1);
		expect(applied[0]?.id).toBe('colorful');
	});
});

describe('applyChartStylePreset', () => {
	it('applies a known preset id, writing colorPalette and style.styleId', () => {
		const next = applyChartStylePreset(chart(), 'monochrome');
		expect(next).not.toBeNull();
		expect(next!.colorPalette).toStrictEqual([...getChartStylePalette(10)]);
		expect(next!.style?.styleId).toBe(10);
	});

	it('returns null for an unknown preset id', () => {
		expect(applyChartStylePreset(chart(), 'nonexistent')).toBeNull();
	});

	it('round-trips through buildChartStylePresets as applied', () => {
		const applied = applyChartStylePreset(chart(), 'pastel')!;
		const presets = buildChartStylePresets(applied);
		expect(presets.find((p) => p.id === 'pastel')?.applied).toBeTruthy();
	});

	it('clears an explicit series colour so the new palette is not shadowed (regression: reported as a no-op)', () => {
		// Every real-world chart authors an explicit series colour
		// (`c:ser/c:spPr`), which `seriesColor()` prefers over `colorPalette` -
		// writing only the palette left the whole feature looking broken.
		const data = chart({ series: [{ name: 'S1', values: [1, 2], color: '#00B0F0' }] });
		const next = applyChartStylePreset(data, 'monochrome')!;
		expect(next.series[0]!.color).toBeUndefined();
	});

	it('clears a series marker fill override', () => {
		const data = chart({
			series: [
				{
					name: 'S1',
					values: [1, 2],
					marker: { symbol: 'square', spPr: { fillColor: '#00B0F0', strokeColor: '#ffffff' } },
				},
			],
		});
		const next = applyChartStylePreset(data, 'monochrome')!;
		expect(next.series[0]!.marker!.symbol).toBe('square');
		expect(next.series[0]!.marker!.spPr!.fillColor).toBeUndefined();
		expect(next.series[0]!.marker!.spPr!.strokeColor).toBe('#ffffff');
	});

	it('clears per-point (c:dPt) fill overrides without dropping the rest of the point', () => {
		const data = chart({
			series: [
				{
					name: 'S1',
					values: [1, 2, 3],
					dataPoints: [{ idx: 1, spPr: { fillColor: '#ff0000' }, explosion: 5 }],
				},
			],
		});
		const next = applyChartStylePreset(data, 'monochrome')!;
		const point = next.series[0]!.dataPoints![0]!;
		expect(point.spPr!.fillColor).toBeUndefined();
		expect(point.explosion).toBe(5);
	});
});
