import { describe, expect, it } from 'vitest';

import {
	resolveBarBoxFaceFills,
	resolveBarRoundFaceFills,
	uniformBoxColor,
	uniformRoundColor,
} from './bar-chart-3d-face-fill';
import type { BarChart3DBox } from './bar-chart-3d-layout';
import { resolveUntargetedBarFaceFill } from './chart-bar3d-face-picture';
import type { ChartSeriesLike } from './chart-datapoint-style';

function makeBox(
	overrides: Partial<BarChart3DBox> = {},
): Pick<BarChart3DBox, 'seriesIndex' | 'categoryIndex' | 'color' | 'shape' | 'size' | 'value'> {
	return {
		seriesIndex: 0,
		categoryIndex: 0,
		color: '#4472C4',
		size: [0.4, 1, 0.5],
		value: 10,
		...overrides,
	};
}

describe('resolveBarBoxFaceFills', () => {
	it('returns the plain box colour on all six faces with no series data at all', () => {
		const fills = resolveBarBoxFaceFills(makeBox(), []);
		for (const face of ['posX', 'negX', 'posY', 'negY', 'posZ', 'negZ'] as const) {
			expect(fills[face]).toStrictEqual({ kind: 'color', color: '#4472C4' });
		}
	});

	it('returns the plain box colour on all six faces when the point has no picture at all', () => {
		const series: ChartSeriesLike[] = [{ color: '#4472C4' }];
		const fills = resolveBarBoxFaceFills(makeBox(), series);
		expect(fills.posZ).toStrictEqual({ kind: 'color', color: '#4472C4' });
		expect(fills.posX).toStrictEqual({ kind: 'color', color: '#4472C4' });
		expect(fills.posY).toStrictEqual({ kind: 'color', color: '#4472C4' });
	});

	it('skips box face targeting entirely for a non-box shape', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { applyToFront: true, applyToSides: true, applyToEnd: true, imageUrl: 'x.png' },
			},
		];
		const fills = resolveBarBoxFaceFills(makeBox({ shape: 'cylinder' }), series);
		for (const face of ['posX', 'negX', 'posY', 'negY', 'posZ', 'negZ'] as const) {
			expect(fills[face]).toStrictEqual({ kind: 'color', color: '#4472C4' });
		}
	});

	it('paints front/sides/end with the picture when no applyTo* flags are set (defaults to all)', () => {
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'data:image/png;base64,AAA' } }];
		const fills = resolveBarBoxFaceFills(makeBox(), series);
		expect(fills.posZ).toMatchObject({ kind: 'picture', imageUrl: 'data:image/png;base64,AAA' });
		expect(fills.posX).toMatchObject({ kind: 'picture' });
		expect(fills.negX).toStrictEqual(fills.posX);
		expect(fills.posY).toMatchObject({ kind: 'picture' });
	});

	it('never targets back (-z) or bottom (-y): they stay the plain box colour', () => {
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png' } }];
		const fills = resolveBarBoxFaceFills(makeBox(), series);
		expect(fills.negZ).toStrictEqual({ kind: 'color', color: '#4472C4' });
		expect(fills.negY).toStrictEqual({ kind: 'color', color: '#4472C4' });
	});

	it('leaves an untargeted front face at the plain box colour (never tinted, matching the SVG front fallback)', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { applyToFront: false, applyToSides: true, applyToEnd: true, imageUrl: 'x.png' },
			},
		];
		const fills = resolveBarBoxFaceFills(makeBox(), series);
		expect(fills.posZ).toStrictEqual({ kind: 'color', color: '#4472C4' });
	});

	it('tints/shades an untargeted side/end face, matching the SVG renderer fallback', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { applyToFront: true, applyToSides: false, applyToEnd: false, imageUrl: 'x.png' },
			},
		];
		const fills = resolveBarBoxFaceFills(makeBox(), series);
		expect(fills.posX).toStrictEqual({
			kind: 'color',
			color: resolveUntargetedBarFaceFill('side', '#4472C4'),
		});
		expect(fills.posY).toStrictEqual({
			kind: 'color',
			color: resolveUntargetedBarFaceFill('end', '#4472C4'),
		});
	});

	it('a per-point c:dPt picture wins outright over the series-level picture', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { imageUrl: 'series.png' },
				dataPoints: [{ idx: 0, picture: { imageUrl: 'point.png' } }],
			},
		];
		const fills = resolveBarBoxFaceFills(makeBox(), series);
		expect(fills.posZ).toMatchObject({ imageUrl: 'point.png' });
	});

	it('stretch always repeats 1x1', () => {
		const series: ChartSeriesLike[] = [
			{ picture: { imageUrl: 'x.png', pictureFormat: 'stretch' } },
		];
		const fills = resolveBarBoxFaceFills(makeBox({ size: [0.4, 3, 0.5], value: 30 }), series);
		expect(fills.posZ).toMatchObject({ repeatX: 1, repeatY: 1 });
	});

	it('stack with no pictureStackUnit repeats 1x1 (one tile, matching the SVG pattern default)', () => {
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png', pictureFormat: 'stack' } }];
		const fills = resolveBarBoxFaceFills(makeBox({ size: [0.4, 3, 0.5], value: 30 }), series);
		expect(fills.posZ).toMatchObject({ repeatX: 1, repeatY: 1 });
	});

	it('stack with a pictureStackUnit repeats value/pictureStackUnit times, exact in value space', () => {
		const series: ChartSeriesLike[] = [
			{ picture: { imageUrl: 'x.png', pictureFormat: 'stack', pictureStackUnit: 6 } },
		];
		// Both boxes share the SAME world-height-per-value-unit ratio (0.1), as
		// every box in one chart does (`layoutBarChart3D`'s linear scale): 3/0.3
		// and 12/1.2 both give 0.1, matching a real chart's boxes.
		const shortBox = resolveBarBoxFaceFills(makeBox({ size: [0.4, 0.3, 0.5], value: 3 }), series);
		const tallBox = resolveBarBoxFaceFills(makeBox({ size: [0.4, 1.2, 0.5], value: 12 }), series);
		const shortRepeat = shortBox.posZ.kind === 'picture' ? shortBox.posZ.repeatY : 0;
		const tallRepeat = tallBox.posZ.kind === 'picture' ? tallBox.posZ.repeatY : 0;
		// value / pictureStackUnit: 3/6 = 0.5 -> clamped to the 1-tile floor; 12/6 = 2.
		expect(shortRepeat).toBe(1);
		expect(tallRepeat).toBe(2);
	});

	it('a zero box value never divides by zero (falls back to 1 tile)', () => {
		const series: ChartSeriesLike[] = [
			{ picture: { imageUrl: 'x.png', pictureFormat: 'stack', pictureStackUnit: 6 } },
		];
		const fills = resolveBarBoxFaceFills(makeBox({ value: 0 }), series);
		expect(fills.posZ).toMatchObject({ repeatX: 1, repeatY: 1 });
	});
});

describe('resolveBarRoundFaceFills', () => {
	it('returns the plain box colour on all three groups with no picture at all', () => {
		const series: ChartSeriesLike[] = [{ color: '#4472C4' }];
		const fills = resolveBarRoundFaceFills(makeBox({ shape: 'cylinder' }), series);
		expect(fills.side).toStrictEqual({ kind: 'color', color: '#4472C4' });
		expect(fills.end).toStrictEqual({ kind: 'color', color: '#4472C4' });
		expect(fills.bottom).toStrictEqual({ kind: 'color', color: '#4472C4' });
	});

	it('maps applyToSides onto the lateral surface and applyToEnd onto the top cap', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { applyToFront: true, applyToSides: true, applyToEnd: false, imageUrl: 'x.png' },
			},
		];
		const fills = resolveBarRoundFaceFills(makeBox({ shape: 'cylinder' }), series);
		expect(fills.side).toMatchObject({ kind: 'picture', imageUrl: 'x.png' });
		// end untargeted: tinted/shaded fallback, same as the box shape's own end face.
		expect(fills.end).toStrictEqual({
			kind: 'color',
			color: resolveUntargetedBarFaceFill('end', '#4472C4'),
		});
	});

	it('never targets the bottom cap: it always stays the plain box colour', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { applyToSides: true, applyToEnd: true, imageUrl: 'x.png' },
			},
		];
		const fills = resolveBarRoundFaceFills(makeBox({ shape: 'cone' }), series);
		expect(fills.bottom).toStrictEqual({ kind: 'color', color: '#4472C4' });
	});

	it('a per-point c:dPt picture wins outright over the series-level picture', () => {
		const series: ChartSeriesLike[] = [
			{
				picture: { imageUrl: 'series.png' },
				dataPoints: [{ idx: 0, picture: { imageUrl: 'point.png' } }],
			},
		];
		const fills = resolveBarRoundFaceFills(makeBox({ shape: 'cylinder' }), series);
		expect(fills.side).toMatchObject({ imageUrl: 'point.png' });
	});
});

describe('uniformBoxColor / uniformRoundColor', () => {
	it('uniformBoxColor returns the shared colour when every face matches', () => {
		const fills = resolveBarBoxFaceFills(makeBox(), [{ color: '#4472C4' }]);
		expect(uniformBoxColor(fills)).toBe('#4472C4');
	});

	it('uniformBoxColor returns undefined once any face resolves a picture', () => {
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png' } }];
		expect(uniformBoxColor(resolveBarBoxFaceFills(makeBox(), series))).toBeUndefined();
	});

	it('uniformRoundColor returns the shared colour when every group matches', () => {
		const fills = resolveBarRoundFaceFills(makeBox({ shape: 'cylinder' }), [{ color: '#4472C4' }]);
		expect(uniformRoundColor(fills)).toBe('#4472C4');
	});

	it('uniformRoundColor returns undefined once any group resolves a picture', () => {
		const series: ChartSeriesLike[] = [{ picture: { imageUrl: 'x.png' } }];
		expect(
			uniformRoundColor(resolveBarRoundFaceFills(makeBox({ shape: 'cylinder' }), series)),
		).toBeUndefined();
	});
});
