import { describe, expect, it } from 'vitest';

import { calculateViewportFit, resolveViewportFitOptions } from './viewport-fit';

const size = { viewportWidth: 960, viewportHeight: 540, canvasWidth: 960, canvasHeight: 540 };
const defaults = { fitPadding: { horizontal: 4, vertical: 16 }, maxFitScale: 1 };

describe('viewport fit policy', () => {
	it.each([
		[4, 16, 508 / 540],
		[8, 16, 508 / 540],
		[24, 24, 492 / 540],
		[16, 16, 508 / 540],
	])('preserves per-binding padding %i/%i', (horizontal, vertical, expected) => {
		expect(
			calculateViewportFit(size, { fitPadding: { horizontal, vertical }, maxFitScale: 1 }).scale,
		).toBeCloseTo(expected);
	});

	it('allows explicit full contain without mutating authored dimensions', () => {
		const input = Object.freeze({
			...size,
			viewportWidth: 1920,
			viewportHeight: 1080,
			fitPadding: 0,
			maxFitScale: null,
		});
		expect(calculateViewportFit(input, defaults)).toStrictEqual({
			scale: 2,
			availableWidth: 1920,
			availableHeight: 1080,
		});
		expect(input.canvasWidth).toBe(960);
		expect(calculateViewportFit({ ...input, maxFitScale: undefined }, defaults).scale).toBe(1);
		expect(calculateViewportFit({ ...input, maxFitScale: 1.5 }, defaults).scale).toBe(1.5);
	});

	it('constrains each axis and retains separate ruler gutters', () => {
		expect(calculateViewportFit({ ...size, viewportWidth: 480, fitPadding: 0 }).scale).toBe(0.5);
		expect(calculateViewportFit({ ...size, viewportHeight: 270, fitPadding: 0 }).scale).toBe(0.5);
		expect(
			calculateViewportFit({ ...size, fitPadding: 0, horizontalGutter: 40, verticalGutter: 20 }),
		).toStrictEqual({ scale: 920 / 960, availableWidth: 920, availableHeight: 520 });
	});

	it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid padding %s',
		(fitPadding) => {
			expect(resolveViewportFitOptions({ fitPadding }, defaults).fitPadding).toStrictEqual(
				defaults.fitPadding,
			);
			expect(
				resolveViewportFitOptions({ fitPadding: { horizontal: 0, vertical: fitPadding } }, defaults)
					.fitPadding,
			).toStrictEqual({ horizontal: 0, vertical: 16 });
		},
	);

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid cap %s',
		(maxFitScale) => {
			expect(resolveViewportFitOptions({ maxFitScale }, defaults).maxFitScale).toBe(1);
		},
	);

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		'uses a positive fallback for unavailable measurements %s',
		(invalid) => {
			expect(
				calculateViewportFit({ ...size, viewportWidth: invalid, fallbackScale: 0.7 }).scale,
			).toBe(0.7);
			expect(calculateViewportFit({ ...size, canvasHeight: invalid }).scale).toBe(1);
		},
	);

	it('does not produce a negative scale when padding consumes the viewport', () => {
		expect(calculateViewportFit({ ...size, fitPadding: 1000 }).scale).toBe(1);
		expect(resolveViewportFitOptions({ fitPadding: 8 }, defaults).fitPadding).toStrictEqual({
			horizontal: 8,
			vertical: 8,
		});
	});
});
