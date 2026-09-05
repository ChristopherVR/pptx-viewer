import { describe, it, expect } from 'vitest';

import {
	findDataPoint,
	resolveDataPointExplosion,
	resolveDataPointFill,
	resolveDataPointMarker,
	resolveDataPointPictureFill,
	upsertDataPoint,
} from './chart-datapoint-style';

describe('chart-datapoint-style', () => {
	const series = {
		color: '#4472C4',
		explosion: 5,
		dataPoints: [
			{ idx: 1, spPr: { fillColor: '#FF0000' }, explosion: 30 },
			{ idx: 3, explosion: 0 },
		],
	};

	it('finds a data point by idx', () => {
		expect(findDataPoint(series, 1)?.spPr?.fillColor).toBe('#FF0000');
		expect(findDataPoint(series, 2)).toBeUndefined();
	});

	it('resolves per-point fill over the series colour', () => {
		expect(resolveDataPointFill(series, 1)).toBe('#FF0000');
	});

	it('falls back to series colour when no per-point fill', () => {
		expect(resolveDataPointFill(series, 0)).toBe('#4472C4');
	});

	it('falls back to the supplied fallback when nothing is set', () => {
		expect(resolveDataPointFill({}, 0, '#00FF00')).toBe('#00FF00');
		expect(resolveDataPointFill({}, 0)).toBeUndefined();
	});

	it('resolves per-point explosion over the series default', () => {
		expect(resolveDataPointExplosion(series, 1)).toBe(30);
	});

	it('uses the series explosion when no per-point override', () => {
		expect(resolveDataPointExplosion(series, 2)).toBe(5);
	});

	it('honours an explicit zero per-point explosion', () => {
		expect(resolveDataPointExplosion(series, 3)).toBe(0);
	});

	it('defaults to 0 when nothing is set', () => {
		expect(resolveDataPointExplosion({}, 0)).toBe(0);
	});

	describe('resolveDataPointMarker', () => {
		const markerSeries = {
			marker: { symbol: 'circle' as const, size: 6, spPr: { fillColor: '#4472C4' } },
			dataPoints: [
				{ idx: 1, marker: { symbol: 'star' as const, size: 14, spPr: { fillColor: '#FF0000' } } },
				// Symbol-only override: size and fill must still come from the series.
				{ idx: 2, marker: { symbol: 'square' as const } },
				// A `c:dPt` with no marker at all leaves the series marker alone.
				{ idx: 3, spPr: { fillColor: '#00FF00' } },
			],
		};

		it('overrides every marker field for the point that pins them', () => {
			expect(resolveDataPointMarker(markerSeries, 1)).toStrictEqual({
				symbol: 'star',
				size: 14,
				fill: '#FF0000',
			});
		});

		it('falls back per field, so a symbol-only override keeps series size and fill', () => {
			expect(resolveDataPointMarker(markerSeries, 2)).toStrictEqual({
				symbol: 'square',
				size: 6,
				fill: '#4472C4',
			});
		});

		it('uses the series marker for points with no marker override', () => {
			expect(resolveDataPointMarker(markerSeries, 3)).toStrictEqual({
				symbol: 'circle',
				size: 6,
				fill: '#4472C4',
			});
			expect(resolveDataPointMarker(markerSeries, 99)).toStrictEqual({
				symbol: 'circle',
				size: 6,
				fill: '#4472C4',
			});
		});

		it('resolves to all-undefined when neither series nor point sets a marker', () => {
			expect(resolveDataPointMarker({}, 0)).toStrictEqual({
				symbol: undefined,
				size: undefined,
				fill: undefined,
			});
		});

		it('lets a point hide its own marker with symbol none', () => {
			const hidden = {
				marker: { symbol: 'circle' as const },
				dataPoints: [{ idx: 0, marker: { symbol: 'none' as const } }],
			};
			expect(resolveDataPointMarker(hidden, 0).symbol).toBe('none');
		});
	});

	describe('upsertDataPoint', () => {
		it('replaces the override carrying the same c:idx, not the same slot', () => {
			const points = [
				{ idx: 7, spPr: { fillColor: '#FF0000' } },
				{ idx: 2, spPr: { fillColor: '#00FF00' } },
			];
			expect(upsertDataPoint(points, { idx: 2, spPr: { fillColor: '#0000FF' } })).toStrictEqual([
				{ idx: 7, spPr: { fillColor: '#FF0000' } },
				{ idx: 2, spPr: { fillColor: '#0000FF' } },
			]);
		});

		it('appends when no override exists for that point yet', () => {
			expect(upsertDataPoint([{ idx: 0 }], { idx: 4, explosion: 10 })).toStrictEqual([
				{ idx: 0 },
				{ idx: 4, explosion: 10 },
			]);
		});

		it('starts a list when the series has no overrides at all', () => {
			expect(upsertDataPoint(undefined, { idx: 3 })).toStrictEqual([{ idx: 3 }]);
		});

		it('leaves the input array untouched', () => {
			const points = [{ idx: 0, explosion: 5 }];
			upsertDataPoint(points, { idx: 0, explosion: 25 });
			expect(points).toStrictEqual([{ idx: 0, explosion: 5 }]);
		});

		it('round-trips with findDataPoint, so the edit is what the renderer reads', () => {
			const dataPoints = upsertDataPoint([{ idx: 5 }], {
				idx: 1,
				marker: { symbol: 'star' as const },
			});
			expect(findDataPoint({ dataPoints }, 1)?.marker?.symbol).toBe('star');
		});
	});

	// C2-G9 (render half): the picture-fill pattern descriptor a binding needs
	// to paint a data point's c:dPt/c:pictureOptions picture fill.
	describe('resolveDataPointPictureFill', () => {
		it('returns undefined when the point has no picture', () => {
			expect(resolveDataPointPictureFill(series, 1, 0)).toBeUndefined();
		});

		it('returns undefined when the point has picture flags but no resolved imageUrl', () => {
			const withPicture = {
				...series,
				dataPoints: [
					...series.dataPoints,
					{ idx: 4, picture: { pictureFormat: 'stack' as const } },
				],
			};
			expect(resolveDataPointPictureFill(withPicture, 4, 0)).toBeUndefined();
		});

		it('defaults to stretch with no tileHeightPx when pictureFormat is absent', () => {
			const withPicture = {
				...series,
				dataPoints: [...series.dataPoints, { idx: 4, picture: { imageUrl: 'data:image/png;x' } }],
			};
			const fill = resolveDataPointPictureFill(withPicture, 4, 2);
			expect(fill).toStrictEqual({
				patternId: 'chart-dpt-pic-2-4',
				imageUrl: 'data:image/png;x',
				format: 'stretch',
			});
		});

		it('converts pictureStackUnit (points) to tileHeightPx for stack/stackScale', () => {
			const withPicture = {
				...series,
				dataPoints: [
					...series.dataPoints,
					{
						idx: 4,
						picture: {
							imageUrl: 'data:image/png;x',
							pictureFormat: 'stack' as const,
							pictureStackUnit: 36,
						},
					},
				],
			};
			const fill = resolveDataPointPictureFill(withPicture, 4, 0);
			expect(fill?.format).toBe('stack');
			expect(fill?.tileHeightPx).toBeCloseTo(36 * (4 / 3), 5);
		});
	});
});
