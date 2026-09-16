import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeLayoutOptions,
	hasSecondaryCategoryAxis,
	isPrimaryCategoryAxisAtTop,
} from './chart-axis';

// Real-world repro: a single-series clustered bar chart whose ONLY `c:catAx`
// carries `c:axPos val="t"` (no bottom counterpart at all). PowerPoint draws
// this axis's tick labels above the plot. This is NOT a secondary category
// axis (that requires a genuine second `c:catAx`/`c:dateAx`), it is the
// chart's one and only category axis, just relocated.
const TOP_ONLY_CAT_AXIS: PptxChartAxisFormatting[] = [
	{ axisType: 'catAx', axisId: 1, axPos: 't' },
	{ axisType: 'valAx', axisId: 2, axPos: 'l' },
];

// A combo chart with a genuine primary (bottom) + secondary (top) category
// axis pair.
const DUAL_CAT_AXES: PptxChartAxisFormatting[] = [
	{ axisType: 'catAx', axisId: 1, axPos: 'b' },
	{ axisType: 'catAx', axisId: 2, axPos: 't' },
	{ axisType: 'valAx', axisId: 3, axPos: 'l' },
];

const BOTTOM_CAT_AXIS: PptxChartAxisFormatting[] = [
	{ axisType: 'catAx', axisId: 1, axPos: 'b' },
	{ axisType: 'valAx', axisId: 2, axPos: 'l' },
];

describe('isPrimaryCategoryAxisAtTop', () => {
	it('is true when the only category axis is positioned at the top', () => {
		expect(isPrimaryCategoryAxisAtTop(TOP_ONLY_CAT_AXIS)).toBeTruthy();
	});

	it('is false for the default bottom-positioned category axis', () => {
		expect(isPrimaryCategoryAxisAtTop(BOTTOM_CAT_AXIS)).toBeFalsy();
	});

	it('is false when a genuine bottom + top pair exists (the top one is secondary)', () => {
		expect(isPrimaryCategoryAxisAtTop(DUAL_CAT_AXES)).toBeFalsy();
	});

	it('is false when there are no axes at all', () => {
		expect(isPrimaryCategoryAxisAtTop(undefined)).toBeFalsy();
	});
});

describe('hasSecondaryCategoryAxis', () => {
	it('is false for a single category axis positioned at the top (not a secondary axis)', () => {
		expect(hasSecondaryCategoryAxis(TOP_ONLY_CAT_AXIS)).toBeFalsy();
	});

	it('is true for a genuine bottom + top category axis pair', () => {
		expect(hasSecondaryCategoryAxis(DUAL_CAT_AXES)).toBeTruthy();
	});

	it('is false for a single bottom category axis', () => {
		expect(hasSecondaryCategoryAxis(BOTTOM_CAT_AXIS)).toBeFalsy();
	});
});

describe('computeLayoutOptions', () => {
	it('flags categoryAxisAtTop without also flagging hasSecondaryCategoryAxis for a relocated single axis', () => {
		const options = computeLayoutOptions(TOP_ONLY_CAT_AXIS, undefined, 1);
		expect(options.categoryAxisAtTop).toBeTruthy();
		expect(options.hasSecondaryCategoryAxis).toBeFalsy();
	});

	it('flags hasSecondaryCategoryAxis (not categoryAxisAtTop) for a genuine dual-axis combo', () => {
		const options = computeLayoutOptions(DUAL_CAT_AXES, undefined, 1);
		expect(options.hasSecondaryCategoryAxis).toBeTruthy();
		expect(options.categoryAxisAtTop).toBeFalsy();
	});

	it('flags neither for the default bottom-axis layout', () => {
		const options = computeLayoutOptions(BOTTOM_CAT_AXIS, undefined, 1);
		expect(options.categoryAxisAtTop).toBeFalsy();
		expect(options.hasSecondaryCategoryAxis).toBeFalsy();
	});
});
