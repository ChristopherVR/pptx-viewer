import { describe, it, expect } from 'vitest';

import {
	resolveActiveDataPointPicture,
	resolveBarFaceTargets,
	resolveDataPointPictureFill,
} from './chart-datapoint-picture-resolve';

describe('chart-datapoint-picture-resolve', () => {
	const series = {
		color: '#4472C4',
		explosion: 5,
		dataPoints: [
			{ idx: 1, spPr: { fillColor: '#FF0000' }, explosion: 30 },
			{ idx: 3, explosion: 0 },
		],
	};

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

		// C2-G9 series-level half: c:ser/c:pictureOptions paints every point
		// unless a c:dPt resolves its own picture.
		it('falls back to the series-level picture when the point has none of its own', () => {
			const withSeriesPicture = {
				...series,
				picture: { imageUrl: 'data:image/png;series', pictureFormat: 'stretch' as const },
			};
			const fill = resolveDataPointPictureFill(withSeriesPicture, 0, 0);
			expect(fill?.imageUrl).toBe('data:image/png;series');
		});

		it('lets a point-level picture win outright over the series-level one', () => {
			const withBoth = {
				...series,
				picture: { imageUrl: 'data:image/png;series' },
				dataPoints: [
					...series.dataPoints,
					{ idx: 4, picture: { imageUrl: 'data:image/png;point' } },
				],
			};
			const fill = resolveDataPointPictureFill(withBoth, 4, 0);
			expect(fill?.imageUrl).toBe('data:image/png;point');
		});

		// C2-G9 3-D face-targeting half: c:applyToFront/Sides/End.
		it('gates on the requested face, returning undefined when not targeted', () => {
			const withPicture = {
				...series,
				dataPoints: [
					...series.dataPoints,
					{
						idx: 4,
						picture: {
							imageUrl: 'data:image/png;x',
							applyToFront: true,
							applyToSides: false,
							applyToEnd: false,
						},
					},
				],
			};
			expect(resolveDataPointPictureFill(withPicture, 4, 0, 'front')).toBeDefined();
			expect(resolveDataPointPictureFill(withPicture, 4, 0, 'side')).toBeUndefined();
			expect(resolveDataPointPictureFill(withPicture, 4, 0, 'end')).toBeUndefined();
		});

		it('paints every face when no face argument is given (pre-face-targeting behaviour)', () => {
			const withPicture = {
				...series,
				dataPoints: [
					...series.dataPoints,
					{ idx: 4, picture: { imageUrl: 'data:image/png;x', applyToFront: false } },
				],
			};
			expect(resolveDataPointPictureFill(withPicture, 4, 0)).toBeDefined();
		});

		it('suffixes side/end pattern ids so a point can carry 3 independent patterns', () => {
			const withPicture = {
				...series,
				dataPoints: [...series.dataPoints, { idx: 4, picture: { imageUrl: 'data:image/png;x' } }],
			};
			expect(resolveDataPointPictureFill(withPicture, 4, 0, 'front')?.patternId).toBe(
				'chart-dpt-pic-0-4',
			);
			expect(resolveDataPointPictureFill(withPicture, 4, 0, 'side')?.patternId).toBe(
				'chart-dpt-pic-0-4-side',
			);
			expect(resolveDataPointPictureFill(withPicture, 4, 0, 'end')?.patternId).toBe(
				'chart-dpt-pic-0-4-end',
			);
		});
	});

	describe('resolveActiveDataPointPicture', () => {
		it('returns undefined when neither the point nor the series has a resolved picture', () => {
			expect(resolveActiveDataPointPicture(series, 0)).toBeUndefined();
		});

		it('ignores a point picture with no resolved imageUrl, falling back to the series', () => {
			const withBoth = {
				...series,
				picture: { imageUrl: 'data:image/png;series' },
				dataPoints: [...series.dataPoints, { idx: 4, picture: { applyToFront: true } }],
			};
			expect(resolveActiveDataPointPicture(withBoth, 4)?.imageUrl).toBe('data:image/png;series');
		});

		// A bare c:ser/c:spPr/a:blipFill with no c:pictureOptions sibling: the
		// real-world "hill silhouette" bug (core parsing synthesizes
		// impliedPicture in that case; this covers the render-side fallback).
		it('falls back to a series-level impliedPicture when there is no explicit picture at all', () => {
			const withImplied = {
				...series,
				impliedPicture: { imageUrl: 'data:image/png;implied', pictureFormat: 'stretch' as const },
			};
			expect(resolveActiveDataPointPicture(withImplied, 0)?.imageUrl).toBe(
				'data:image/png;implied',
			);
		});

		it('prefers an explicit series picture over an implied one', () => {
			const withBoth = {
				...series,
				picture: { imageUrl: 'data:image/png;explicit' },
				impliedPicture: { imageUrl: 'data:image/png;implied' },
			};
			expect(resolveActiveDataPointPicture(withBoth, 0)?.imageUrl).toBe('data:image/png;explicit');
		});

		it('lets a point-level impliedPicture win outright over the series (explicit or implied)', () => {
			const withPointImplied = {
				...series,
				picture: { imageUrl: 'data:image/png;series' },
				dataPoints: [
					...series.dataPoints,
					{ idx: 4, impliedPicture: { imageUrl: 'data:image/png;point-implied' } },
				],
			};
			expect(resolveActiveDataPointPicture(withPointImplied, 4)?.imageUrl).toBe(
				'data:image/png;point-implied',
			);
		});
	});

	describe('resolveDataPointPictureFill opacity (a:alphaModFix)', () => {
		it('carries the resolved opacity through to the pattern descriptor', () => {
			const withOpacity = {
				...series,
				impliedPicture: {
					imageUrl: 'data:image/png;x',
					pictureFormat: 'stretch' as const,
					opacity: 0.6,
				},
			};
			expect(resolveDataPointPictureFill(withOpacity, 0, 0)?.opacity).toBeCloseTo(0.6, 6);
		});

		it('leaves opacity undefined (fully opaque) when the blip has no alphaModFix', () => {
			const withPicture = {
				...series,
				picture: { imageUrl: 'data:image/png;x', pictureFormat: 'stretch' as const },
			};
			expect(resolveDataPointPictureFill(withPicture, 0, 0)?.opacity).toBeUndefined();
		});
	});

	describe('resolveBarFaceTargets', () => {
		it('targets no face when there is no picture', () => {
			expect(resolveBarFaceTargets(undefined)).toStrictEqual({
				front: false,
				side: false,
				end: false,
			});
		});

		it('defaults to every face when no applyTo* flag is set (COM-verified ground truth)', () => {
			expect(resolveBarFaceTargets({ imageUrl: 'x', pictureFormat: 'stretch' })).toStrictEqual({
				front: true,
				side: true,
				end: true,
			});
		});

		it('treats an omitted flag as false once at least one flag is present', () => {
			expect(resolveBarFaceTargets({ imageUrl: 'x', applyToFront: true })).toStrictEqual({
				front: true,
				side: false,
				end: false,
			});
		});
	});
});
