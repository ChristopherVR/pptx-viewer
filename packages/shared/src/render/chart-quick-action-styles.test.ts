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
});
