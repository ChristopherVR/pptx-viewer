import { describe, it, expect } from 'vitest';

import {
	findDataPoint,
	resolveDataPointExplosion,
	resolveDataPointFill,
	resolveDataPointMarker,
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

		// Regression for a real-world stacked line chart: two series with a
		// `c:marker` present but no `c:symbol` (PowerPoint's "automatic" marker
		// authoring), carrying NON-SEQUENTIAL `c:idx` (1 and 2, not 0 and 1). Real
		// PowerPoint (COM-measured, `SeriesCollection(i).MarkerStyle` read back
		// after save/reopen) resolved idx 1 to Square and idx 2 to Triangle,
		// matching `AUTOMATIC_MARKER_CYCLE`'s [1]/[2] entries.
		describe('automatic marker-symbol cycling (c:marker present, no c:symbol)', () => {
			it('cycles by the series c:idx, not by array position', () => {
				const seriesA = { marker: { symbol: 'auto' as const }, idx: 1 };
				const seriesB = { marker: { symbol: 'auto' as const }, idx: 2 };
				expect(resolveDataPointMarker(seriesA, 0, 0).symbol).toBe('square');
				expect(resolveDataPointMarker(seriesB, 0, 1).symbol).toBe('triangle');
			});

			it('falls back to the array position when the series has no c:idx', () => {
				expect(resolveDataPointMarker({ marker: { symbol: 'auto' as const } }, 0, 0).symbol).toBe(
					'diamond',
				);
				expect(resolveDataPointMarker({ marker: { symbol: 'auto' as const } }, 0, 5).symbol).toBe(
					'circle',
				);
			});

			it('treats a marker present with no symbol at all the same as an explicit auto', () => {
				const autoSeries = { marker: {}, idx: 2 };
				expect(resolveDataPointMarker(autoSeries, 0, 0).symbol).toBe('triangle');
			});

			it('does NOT cycle a series with no marker element at all (no marker intended)', () => {
				expect(resolveDataPointMarker({ idx: 1 }, 0, 0).symbol).toBeUndefined();
			});

			it('a per-point dPt marker present with no symbol also cycles off the series idx', () => {
				// The point's own empty `c:dPt/c:marker` (present, but no `c:symbol`)
				// requests automatic just like a series-level one would; there is no
				// series-level marker here to fall back to, so this only passes if
				// the point marker's OWN presence, not the series', drives the cycle.
				const pointMarkerSeries = { idx: 2, dataPoints: [{ idx: 4, marker: {} }] };
				expect(resolveDataPointMarker(pointMarkerSeries, 4, 0).symbol).toBe('triangle');
			});
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
});

// Picture-fill resolution (resolveDataPointPictureFill,
// resolveActiveDataPointPicture, resolveBarFaceTargets) now lives in
// chart-datapoint-picture-resolve.test.ts, alongside the module it tests.
