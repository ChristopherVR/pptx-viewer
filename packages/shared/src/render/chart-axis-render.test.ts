/**
 * Tests for the value-axis gridline/label primitive builders in
 * `chart-axis-render.ts` (log scale, display units, secondary axis), and the
 * assertion that the linear no-units `buildPrimaryAxis` output matches the
 * original `buildGridlinesAndLabels` byte-for-byte.
 */
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildPrimaryAxis, buildSecondaryAxis } from './chart-axis-render';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { buildGridlinesAndLabels } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 48,
	plotTop: 8,
	plotRight: 392,
	plotBottom: 276,
	plotWidth: 344,
	plotHeight: 268,
};

describe('buildPrimaryAxis linear default', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };

	it('matches buildGridlinesAndLabels exactly when no log/units', () => {
		const legacy = buildGridlinesAndLabels(range, layout);
		const fresh = buildPrimaryAxis(range, layout, undefined);
		expect(fresh.gridlines).toStrictEqual(legacy.gridlines);
		expect(fresh.axisLabels).toStrictEqual(legacy.axisLabels);
	});

	it('is unaffected by an axis with no log/display-unit fields', () => {
		const legacy = buildGridlinesAndLabels(range, layout);
		const axis: PptxChartAxisFormatting = { axisType: 'valAx', axPos: 'l' };
		const fresh = buildPrimaryAxis(range, layout, axis);
		expect(fresh.axisLabels).toStrictEqual(legacy.axisLabels);
	});
});

describe('buildPrimaryAxis log scale', () => {
	const logRange: ValueRange = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };

	it('produces one gridline per power of the base', () => {
		const { gridlines } = buildPrimaryAxis(logRange, layout, {
			axisType: 'valAx',
			logScale: true,
			logBase: 10,
		});
		expect(gridlines).toHaveLength(4);
	});

	it('labels powers of the base (1, 10, 100, 1000 -> 1K)', () => {
		const { axisLabels } = buildPrimaryAxis(logRange, layout, {
			axisType: 'valAx',
			logScale: true,
			logBase: 10,
		});
		const texts = axisLabels.map((l) => l.text);
		expect(texts).toContain('1');
		expect(texts).toContain('100');
	});
});

describe('buildPrimaryAxis display units', () => {
	const range: ValueRange = { min: 0, max: 4000, span: 4000 };
	const axis: PptxChartAxisFormatting = {
		axisType: 'valAx',
		axPos: 'l',
		displayUnits: 'thousands',
	};

	it('scales labels by the divisor', () => {
		const { axisLabels } = buildPrimaryAxis(range, layout, axis);
		expect(axisLabels.some((l) => l.text === '4')).toBeTruthy();
	});

	it('emits a rotated "Thousands" caption', () => {
		const { axisLabels } = buildPrimaryAxis(range, layout, axis);
		const cap = axisLabels.find((l) => l.text === 'Thousands');
		expect(cap?.transform).toContain('rotate(-90');
	});

	it('uses text from a typed display-units label', () => {
		const { axisLabels } = buildPrimaryAxis(range, layout, {
			...axis,
			displayUnitsLabel: { text: 'K' },
		});
		expect(axisLabels.some((label) => label.text === 'K')).toBeTruthy();
	});

	it('omits the caption for an explicitly removed label', () => {
		const { axisLabels } = buildPrimaryAxis(range, layout, {
			...axis,
			displayUnitsLabel: null,
		});
		expect(axisLabels.some((label) => label.text === 'Thousands')).toBeFalsy();
	});
});

describe('buildPrimaryAxis explicit tick units and direction', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100, reverseOrder: true };
	const axis: PptxChartAxisFormatting = {
		axisType: 'valAx',
		orientation: 'maxMin',
		majorUnit: 20,
		minorUnit: 10,
		minorGridlines: true,
	};

	it('uses majorUnit labels and minorUnit gridlines', () => {
		const { gridlines, axisLabels } = buildPrimaryAxis(range, layout, axis);
		expect(axisLabels.map((label) => label.text)).toStrictEqual([
			'0',
			'20',
			'40',
			'60',
			'80',
			'100',
		]);
		expect(gridlines).toHaveLength(11);
	});

	it('places the minimum at the top for maxMin orientation', () => {
		const { axisLabels } = buildPrimaryAxis(range, layout, axis);
		expect(axisLabels.find((label) => label.text === '0')?.y).toBe(layout.plotTop);
		expect(axisLabels.find((label) => label.text === '100')?.y).toBe(layout.plotBottom);
	});

	it('renders explicit major and minor tick marks on the requested side', () => {
		const { gridlines } = buildPrimaryAxis(range, layout, {
			...axis,
			minorGridlines: false,
			majorTickMark: 'out',
			minorTickMark: 'in',
		});
		const outwardMajorTicks = gridlines.filter(
			(line) => line.x1 === layout.plotLeft && line.x2 === layout.plotLeft - 4,
		);
		const inwardMinorTicks = gridlines.filter(
			(line) => line.x1 === layout.plotLeft && line.x2 === layout.plotLeft + 2.5,
		);
		expect(outwardMajorTicks).toHaveLength(6);
		expect(inwardMinorTicks).toHaveLength(5);
	});

	it('honors high and none tick-label positions', () => {
		const high = buildPrimaryAxis(range, layout, { ...axis, tickLblPos: 'high' });
		expect(high.axisLabels.every((label) => label.x === layout.plotRight + 4)).toBeTruthy();
		expect(high.axisLabels.every((label) => label.textAnchor === 'start')).toBeTruthy();
		const hidden = buildPrimaryAxis(range, layout, { ...axis, tickLblPos: 'none' });
		expect(hidden.axisLabels).toHaveLength(0);
	});
});

describe('buildSecondaryAxis', () => {
	const range: ValueRange = { min: 0, max: 50, span: 50 };

	it('places numeric labels with start anchor to the right of plotRight', () => {
		const { axisLabels } = buildSecondaryAxis(range, layout, undefined);
		const numeric = axisLabels.filter((l) => l.textAnchor === 'start');
		expect(numeric.length).toBeGreaterThan(0);
		for (const l of numeric) {
			expect(l.x).toBeGreaterThan(layout.plotRight);
		}
	});

	it('emits dashed lighter gridlines spanning the plot', () => {
		const { gridlines } = buildSecondaryAxis(range, layout, undefined);
		expect(gridlines.length).toBeGreaterThan(0);
		expect(gridlines[0].dashArray).toBe('2 3');
		expect(gridlines[0].x1).toBe(layout.plotLeft);
		expect(gridlines[0].x2).toBe(layout.plotRight);
	});

	it('includes a rotated secondary axis title when titleText is set', () => {
		const { axisLabels } = buildSecondaryAxis(range, layout, {
			axisType: 'valAx',
			axPos: 'r',
			titleText: 'Growth',
		});
		const title = axisLabels.find((l) => l.text === 'Growth');
		expect(title?.transform).toContain('rotate(-90');
	});

	it('uses power-of-base ticks for a logarithmic secondary range', () => {
		const logRange: ValueRange = {
			min: 1,
			max: 1000,
			span: 3,
			logScale: true,
			logBase: 10,
		};
		const { axisLabels } = buildSecondaryAxis(logRange, layout, {
			axisType: 'valAx',
			axPos: 'r',
			logScale: true,
			logBase: 10,
		});
		expect(axisLabels.map((label) => label.text)).toStrictEqual(['1', '10', '100', '1.0K']);
	});

	it('renders right-axis tick marks and low-side labels', () => {
		const { gridlines, axisLabels } = buildSecondaryAxis(range, layout, {
			axisType: 'valAx',
			axPos: 'r',
			majorTickMark: 'cross',
			tickLblPos: 'low',
		});
		const ticks = gridlines.filter(
			(line) => line.x1 === layout.plotRight + 4 && line.x2 === layout.plotRight - 4,
		);
		expect(ticks).toHaveLength(5);
		expect(axisLabels.every((label) => label.x === layout.plotLeft - 4)).toBeTruthy();
		expect(axisLabels.every((label) => label.textAnchor === 'end')).toBeTruthy();
	});
});
