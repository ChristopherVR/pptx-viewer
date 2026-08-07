import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveShapeGeometry } from './shape-geometry-cascade';

function shape(overrides: Record<string, unknown>): PptxElement {
	return {
		id: 'e1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeStyle: {},
		...overrides,
	} as unknown as PptxElement;
}

describe('resolveShapeGeometry', () => {
	it('normalises `oval` onto the ellipse branch', () => {
		// The whole reason this module exists: Angular compared `shapeType` raw
		// (`=== 'ellipse' || === 'circle'`), so `oval` - a preset offered in the
		// shape picker - fell through to a clip-path there while the other four
		// bindings gave it a radius. Normalising is the shared behaviour.
		expect(resolveShapeGeometry(shape({ shapeType: 'oval' }))).toStrictEqual({
			kind: 'borderRadius',
			radius: '50%',
		});
		expect(resolveShapeGeometry(shape({ shapeType: 'ellipse' }))).toStrictEqual({
			kind: 'borderRadius',
			radius: '50%',
		});
	});

	it('is case-insensitive about the preset name', () => {
		expect(resolveShapeGeometry(shape({ shapeType: 'Ellipse' }))).toStrictEqual({
			kind: 'borderRadius',
			radius: '50%',
		});
	});

	it('gives an ellipse a per-axis 50% radius, never a pill', () => {
		// A px radius large enough to round a square gets clamped down uniformly
		// on a non-square box, painting a stadium with flat long edges.
		const decision = resolveShapeGeometry(shape({ shapeType: 'ellipse', width: 200, height: 20 }));
		expect(decision).toStrictEqual({ kind: 'borderRadius', radius: '50%' });
	});

	it('gives the cylinder aliases real evaluated geometry', () => {
		// Both aliases must resolve identically. `can` is the one Angular's raw
		// string compare could never have reached.
		//
		// Note the evaluator now supplies a true cylinder outline, so the
		// clip-path branch wins and the trailing `48% / 12%` radius fallback below
		// it is effectively unreachable for this preset - it survives only for the
		// case where the evaluator declines to produce a path.
		const cylinder = resolveShapeGeometry(shape({ shapeType: 'cylinder' }));
		const can = resolveShapeGeometry(shape({ shapeType: 'can' }));
		expect(cylinder.kind).toBe('clipPath');
		expect(can.kind).toBe('clipPath');
		// NOTE (pre-existing, surfaced by this extraction, deliberately not
		// changed here): the two aliases do NOT evaluate to the same outline -
		// `cylinder` yields a horizontal capsule, `can` the vertical elliptical-top
		// can that ECMA-376 actually specifies. `getShapeType` folds both onto
		// 'cylinder', so whichever spelling a deck uses changes the render. Worth a
		// separate look; asserting the current split so a change is deliberate.
		expect(can).not.toStrictEqual(cylinder);
	});

	it('leaves a connector box bare', () => {
		expect(resolveShapeGeometry(shape({ type: 'connector' }))).toStrictEqual({ kind: 'bare' });
	});

	it('does not clip a plain rect (so overflowing text stays visible)', () => {
		expect(resolveShapeGeometry(shape({ shapeType: 'rect' }))).toStrictEqual({ kind: 'none' });
	});

	it('emits a clip-path for a preset with real geometry', () => {
		const decision = resolveShapeGeometry(shape({ shapeType: 'triangle' }));
		expect(decision.kind).toBe('clipPath');
	});

	it('treats a bare line preset as stroke-only, not a filled box', () => {
		// `line` is an OPEN preset, so it is caught by the stroke-only branch well
		// before the trailing `lineEdge` fallback; that fallback exists only for a
		// line-typed shape carrying custom pathData the evaluator cannot open.
		const decision = resolveShapeGeometry(
			shape({ shapeType: 'line', shapeStyle: { strokeWidth: 0.5 } }),
		);
		expect(decision).toStrictEqual({ kind: 'strokeOnly' });
	});
});
