import { describe, expect, it } from 'vitest';

import { chartAxisTextStyle } from './chart-axis-style';
import {
	CHART_PX_PER_PT,
	DEFAULT_CHART_DATA_LABEL_PX,
	DEFAULT_CHART_TEXT_PX,
	chartFontPx,
} from './chart-font';

// Regression for issue #132: core parses chart text sizes in POINTS
// (sz="1195" -> 11.95 pt), and the view-model must render them in slide-px
// (pt * 4/3). Emitting the parsed number directly drew all chart text at 75%.
describe('chartFontPx (pt -> px boundary)', () => {
	it('converts points to px at 4/3 (96 dpi / 72 dpi)', () => {
		expect(CHART_PX_PER_PT).toBeCloseTo(4 / 3, 12);
		expect(chartFontPx(12)).toBe(16);
		expect(chartFontPx(9)).toBe(12);
	});

	it('renders the issue #132 deck axis size 11.95 pt as 15.93(3) px', () => {
		expect(chartFontPx(11.95)).toBeCloseTo(15.9333, 3);
	});

	it('exposes PowerPoint chart text defaults in px', () => {
		expect(DEFAULT_CHART_TEXT_PX).toBeCloseTo(13.3333, 3); // 10 pt body text
		expect(DEFAULT_CHART_DATA_LABEL_PX).toBe(12); // 9 pt data labels
	});
});

describe('chartAxisTextStyle font-size unit', () => {
	it('converts a parsed axis fontSize (points) to px', () => {
		const style = chartAxisTextStyle({ axisType: 'valAx', fontSize: 11.95 });
		expect(style.fontSize).toBeCloseTo(15.9333, 3);
	});

	it('falls back to the 10 pt PowerPoint default (already px, not converted again)', () => {
		expect(chartAxisTextStyle(undefined).fontSize).toBe(DEFAULT_CHART_TEXT_PX);
		expect(chartAxisTextStyle({ axisType: 'catAx' }).fontSize).toBe(DEFAULT_CHART_TEXT_PX);
	});
});
