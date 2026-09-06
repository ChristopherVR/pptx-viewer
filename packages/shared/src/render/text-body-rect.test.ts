import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveTextBodyRectPadding } from './text-body-rect';

function shape(overrides: Record<string, unknown>): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	} as unknown as PptxElement;
}

describe('resolveTextBodyRectPadding', () => {
	// PowerPoint's own measurement (COM, zero body insets, 200x100pt): a chevron
	// lays text out between 0.25 and 0.75 of its width, so 50px in on each side.
	it('insets a chevron to its two arrow points', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'chevron' }))).toStrictEqual({
			left: 50,
			top: 0,
			right: 50,
			bottom: 0,
		});
	});

	// Measured 0.25/0.5..0.75/1.0: the text sits in the lower stub of the Y.
	it('insets flowChartExtract to the band under its apex', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'flowChartExtract' }))).toStrictEqual({
			left: 50,
			top: 50,
			right: 50,
			bottom: 0,
		});
	});

	it('normalises the preset name by case, as core own lookup does', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'Chevron' })).left).toBe(50);
	});

	it('leaves a plain rectangle alone', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'rect' }))).toStrictEqual({
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		});
	});

	// Wave 2 COM-verified every remaining ECMA-transcribed preset (stars,
	// ribbons, scrolls, gears, etc.). `sun` joined the allowlist afterward,
	// once `preset-shape-definitions-misc.ts` (commit `1da163776`) replaced its
	// rect with the disc's own inscribed rectangle and a COM re-measurement
	// confirmed the new formula (see `VERIFIED_TEXT_RECT_PRESETS`'s doc
	// comment and `preset-text-rect.test.ts`'s `sun` cases for the numbers).
	it('ignores the text rectangle of a preset not verified against PowerPoint', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'futurePresetNoRect' }))).toStrictEqual({
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		});
	});

	// COM-measured at 200x100pt (see `preset-text-rect.test.ts`): l=64.65,
	// t=32.32, r=135.27, b=67.68. The implemented formula is symmetric about
	// the box centre, so left/right and top/bottom padding come out equal
	// (~64.65 and ~32.32), matching the measurement within its own <0.1%
	// tolerance.
	it('insets sun to the disc own inscribed rectangle, now that it is COM-verified', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'sun' }));
		expect(padding.left).toBeCloseTo(64.65, 1);
		expect(padding.top).toBeCloseTo(32.32, 1);
		expect(padding.right).toBeCloseTo(64.65, 1);
		expect(padding.bottom).toBeCloseTo(32.32, 1);
	});

	// Wave 2 follow-up: a representative sample of the newly COM-verified
	// ECMA-transcribed presets, pinned to their measured 200x100pt values
	// (preset-text-rect-w2-measured.json in the wave scratchpad).
	it('insets a 5-pointed star to its inner vertex span', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'star5' }));
		expect(padding.left).toBeCloseTo(61.8, 1);
		expect(padding.top).toBeCloseTo(38.2, 1);
		expect(padding.right).toBeCloseTo(61.8, 1);
	});

	it('insets homePlate to the mid-point between the notch and the far edge', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'homePlate' }))).toStrictEqual({
			left: 0,
			top: 0,
			right: 25,
			bottom: 0,
		});
	});

	it('insets a ribbon to the band under its fold', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'ribbon' }));
		expect(padding.left).toBeCloseTo(50, 1);
		expect(padding.top).toBeCloseTo(16.67, 1);
		expect(padding.right).toBeCloseTo(50, 1);
		expect(padding.bottom).toBe(0);
	});

	it('insets gear6 to the tooth-root span', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'gear6' }));
		expect(padding.left).toBeCloseTo(39.71, 1);
		expect(padding.top).toBeCloseTo(25.33, 1);
	});

	it('insets bracePair to the mid-point of the fillet on all four sides', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'bracePair' }));
		expect(padding.left).toBeCloseTo(10.77, 1);
		expect(padding.top).toBeCloseTo(10.77, 1);
		expect(padding.right).toBeCloseTo(10.77, 1);
		expect(padding.bottom).toBeCloseTo(2.44, 1);
	});

	it('leaves an action button on its full bounding box (a trivial, verified full-box rect)', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'actionButtonHome' }))).toStrictEqual({
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		});
	});

	// G1 follow-up: the core table's `rect` for these is now corrected and
	// COM-verified (200x100pt reference box), so `buildTextBlockStyle` honours
	// it via `VERIFIED_TEXT_RECT_PRESETS`.
	it('insets an ellipse by (1 - cos45deg)/2 of each dimension (~14.6%)', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'ellipse' }));
		expect(padding.left).toBeCloseTo(29.29, 1);
		expect(padding.top).toBeCloseTo(14.64, 1);
		expect(padding.right).toBeCloseTo(29.29, 1);
		expect(padding.bottom).toBeCloseTo(14.64, 1);
	});

	it('insets a diamond to the box quarter-to-3-quarter span', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'diamond' }))).toStrictEqual({
			left: 50,
			top: 25,
			right: 50,
			bottom: 25,
		});
	});

	it('insets a heart using the wd6/hd3 builtins instead of the undefined 3wd4/3hd4 guides', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'heart' }));
		expect(padding.left).toBeCloseTo(33.33, 1);
		expect(padding.top).toBe(25);
		expect(padding.right).toBeCloseTo(33.33, 1);
		expect(padding.bottom).toBeCloseTo(33.33, 1);
	});

	it('insets a pentagon without a negative bottom edge', () => {
		const padding = resolveTextBodyRectPadding(shape({ shapeType: 'pentagon' }));
		expect(padding.bottom).toBe(0);
		expect(padding.left).toBeCloseTo(38.2, 1);
		expect(padding.top).toBeCloseTo(23.61, 1);
	});

	it('insets plus to the wide horizontal arm, not the narrow intersection square', () => {
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'plus' }))).toStrictEqual({
			left: 0,
			top: 25,
			right: 0,
			bottom: 25,
		});
	});

	it('ignores a shape with no geometry or a degenerate box', () => {
		expect(resolveTextBodyRectPadding(shape({}))).toStrictEqual({
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		});
		expect(resolveTextBodyRectPadding(shape({ shapeType: 'chevron', width: 0 })).left).toBe(0);
	});

	// `a:custGeom/a:rect` edges are path-space coordinates, so they rescale with
	// the element box; a guide REFERENCE cannot be resolved (core keeps the guide
	// list as raw XML only) and must leave the body on its bounding box.
	it('rescales a literal custGeom text rectangle into the element box', () => {
		const padding = resolveTextBodyRectPadding(
			shape({
				pathData: 'M 0 0 L 1000 0 L 1000 500 Z',
				pathWidth: 1000,
				pathHeight: 500,
				customGeometryTextRect: { l: '100', t: '50', r: '900', b: '450' },
			}),
		);
		expect(padding).toStrictEqual({ left: 20, top: 10, right: 20, bottom: 10 });
	});

	it('ignores a custGeom text rectangle built from guide references', () => {
		const padding = resolveTextBodyRectPadding(
			shape({
				pathData: 'M 0 0 L 1000 0 L 1000 500 Z',
				pathWidth: 1000,
				pathHeight: 500,
				customGeometryTextRect: { l: 'gd1', t: 'gd2', r: 'gd3', b: 'gd4' },
			}),
		);
		expect(padding).toStrictEqual({ left: 0, top: 0, right: 0, bottom: 0 });
	});
});
