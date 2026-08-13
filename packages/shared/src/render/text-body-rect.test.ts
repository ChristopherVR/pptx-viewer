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

	// The core table's `rect` for these was never read by anything and does not
	// match PowerPoint (`diamond` evaluates to a quarter-size box, `heart` to a
	// zero-size one, `pentagon` to a negative bottom edge). Honouring them would
	// put text in a measurably wrong place, so they stay on the full box until
	// the geometry table is corrected.
	it('ignores the text rectangle of presets not verified against PowerPoint', () => {
		for (const shapeType of ['diamond', 'heart', 'pentagon', 'ellipse', 'star5', 'plus']) {
			expect(resolveTextBodyRectPadding(shape({ shapeType }))).toStrictEqual({
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
			});
		}
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
