import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getShapeFillStrokeStyle, getTextBlockStyle } from './element-styles';
import { renderStrokeOutline } from './elements/shape-filter-defs';

/** A text element carrying the given text style. */
function textElement(textStyle: Record<string, unknown>): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 100,
		text: 'hi',
		textStyle,
	} as unknown as PptxElement;
}

describe('getTextBlockStyle', () => {
	it('emits px lengths, since these maps are written straight onto element.style', () => {
		const style = getTextBlockStyle(textElement({ fontSize: 18, vAlign: 'bottom' }));
		expect(style['fontSize']).toBe('18px');
		expect(style['justifyContent']).toBe('flex-end');
		expect(style['lineHeight']).toBe(1.2);
	});

	// This binding's own copy of the text-block builder never read either
	// property, so a shrink-to-fit title painted 43% too large and a
	// `wrap="none"` line wrapped to three. Both now come from the shared builder.
	it('applies the normAutofit font scale and never wraps a wrap="none" body', () => {
		const autofit = getTextBlockStyle(
			textElement({ fontSize: 40, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 }),
		);
		expect(autofit['fontSize']).toBe('28px');
		expect(getTextBlockStyle(textElement({ textWrap: 'none' }))['whiteSpace']).toBe('nowrap');
		expect(getTextBlockStyle(textElement({}))['whiteSpace']).toBe('pre-wrap');
	});

	it('never shrinks the font for spAutoFit, however much text overflows', () => {
		// a:spAutoFit resizes the SHAPE to fit the text (ECMA-376), never the
		// font; a box authored in PowerPoint already has its `a:ext` sized to
		// fit, so the font must render unshrunk regardless of the measured text.
		const autofit = getTextBlockStyle(
			textElement({ fontSize: 40, autoFit: true, autoFitMode: 'shrink' }),
		);
		expect(autofit['fontSize']).toBe('40px');
	});

	it('counter-rotates for `a:bodyPr/@upright` on a rotated shape, keeping text screen-upright', () => {
		const el = { ...textElement({ upright: true }), rotation: 30 } as PptxElement;
		expect(getTextBlockStyle(el)['transform']).toBe('rotate(-30deg)');
	});

	it('clamps `vertOverflow="ellipsis"` to a multi-line "…" truncation, not a plain clip', () => {
		const el = {
			...textElement({ fontSize: 24, vertOverflow: 'ellipsis' }),
			height: 100,
		} as PptxElement;
		const style = getTextBlockStyle(el);
		expect(style['display']).toBe('-webkit-box');
		expect(style['overflow']).toBe('hidden');
		expect(style['textOverflow']).toBe('ellipsis');
		expect(style['WebkitLineClamp']).toBeTypeOf('number');
	});
});

/**
 * Stroke-only ("open") preset geometry (`<a:prstGeom prst="line"/>`, `arc`, the
 * connector family). These have no region to fill and no box to outline, so the
 * CSS border painted a rectangle edge where PowerPoint draws the line itself;
 * the shared `buildStrokeOutline` strokes the evaluated geometry instead.
 */
describe('stroke-only preset geometry', () => {
	/** The media deck's horizontal rule: `prst="line"`, 1 EMU tall, 1.5pt black. */
	const rule = (overrides: Record<string, unknown> = {}): PptxElement =>
		({
			id: 'rule-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 400,
			height: 0,
			shapeType: 'line',
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
			...overrides,
		}) as unknown as PptxElement;

	it('leaves the container bare: no fill, no border, no clip-path', () => {
		const style = getShapeFillStrokeStyle(rule());
		expect(style['backgroundColor']).toBe('transparent');
		expect(style['border']).toBe('none');
		expect(style['borderTop']).toBeUndefined();
		expect(style['clipPath']).toBeUndefined();
	});

	it('strokes the evaluated geometry over the padded box', () => {
		const svg = renderStrokeOutline(document, rule());
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('viewBox')).toBe('0 0 400 12');
		const path = svg?.querySelector('path');
		expect(path?.getAttribute('d')).toBe('M 0 0 L 400 1');
		expect(path?.getAttribute('stroke')).toBe('#000000');
		expect(svg?.querySelector('defs')).toBeNull();
	});

	it('leaves an explicitly INSET closed preset to its CSS border', () => {
		// `algn="in"` is the one alignment a CSS border already paints correctly;
		// the default `ctr` alignment routes the stroke through this SVG overlay
		// instead (see shared `stroke-outline.ts`).
		const box = rule({
			shapeType: 'rect',
			height: 100,
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2, lineAlignment: 'in' },
		});
		expect(renderStrokeOutline(document, box)).toBeNull();
		expect(getShapeFillStrokeStyle(box)['border']).toContain('2px');
	});

	it('centres a closed preset at the default (omitted) alignment instead', () => {
		const box = rule({ shapeType: 'rect', height: 100 });
		expect(renderStrokeOutline(document, box)).not.toBeNull();
		expect(getShapeFillStrokeStyle(box)['border']).toBeUndefined();
	});
});

describe('custom-geometry live reshape', () => {
	it('reshapes a freeform clip-path LIVE from shapeAdjustments, not the frozen pathData', () => {
		// `x1 = w * adj1 / 100000`; pathData was frozen at the authored default
		// (adj1 = 25000, x1 = 50) but shapeAdjustments already carries an
		// in-progress drag (adj1 = 75000, x1 = 150) - limitations.md's "a:custGeom
		// adjustment-handle drag: Commits on release, not live".
		const rawData = {
			avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
			gdLstXml: { 'a:gd': { '@_name': 'x1', '@_fmla': '*/ w adj1 100000' } },
			pathLstXml: {
				'a:path': {
					'@_w': '200',
					'@_h': '100',
					'a:moveTo': { 'a:pt': { '@_x': '0', '@_y': '0' } },
					'a:lnTo': [
						{ 'a:pt': { '@_x': 'x1', '@_y': '0' } },
						{ 'a:pt': { '@_x': 'x1', '@_y': '100' } },
					],
					'a:close': {},
				},
			},
		};
		const style = getShapeFillStrokeStyle({
			id: 'freeform-1',
			type: 'shape',
			x: 0,
			y: 0,
			shapeType: 'custom',
			width: 200,
			height: 100,
			pathData: 'M 0 0 L 50 0 L 50 100 Z',
			pathWidth: 200,
			pathHeight: 100,
			customGeometryRawData: rawData,
			shapeAdjustments: { adj1: 75000 },
		} as unknown as PptxElement);
		expect(style['clipPath']).toBe("path('M 0 0 L 150 0 L 150 100 Z')");
	});
});

describe('getShapeFillStrokeStyle group-level effects (p:grpSpPr/a:effectLst)', () => {
	function group(groupEffectStyle?: Record<string, unknown>): PptxElement {
		return {
			type: 'group',
			id: 'grp-1',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			children: [],
			groupEffectStyle,
		} as unknown as PptxElement;
	}

	it('returns an empty style for a group with no groupEffectStyle', () => {
		expect(getShapeFillStrokeStyle(group())).toStrictEqual({});
	});

	it('paints the group composite shadow as a `filter: drop-shadow`, never a `box-shadow`', () => {
		const style = getShapeFillStrokeStyle(
			group({ shadowColor: '#000000', shadowAngle: 0, shadowDistance: 4, shadowBlur: 6 }),
		);
		expect(style['boxShadow']).toBeUndefined();
		expect(String(style['filter'])).toContain('drop-shadow');
	});

	it('paints a group glow as a `filter: drop-shadow`', () => {
		const style = getShapeFillStrokeStyle(group({ glowColor: '#00ff00', glowRadius: 10 }));
		expect(String(style['filter'])).toContain('drop-shadow');
	});

	it('sets overflow: visible for a group blur effect with @grow', () => {
		const style = getShapeFillStrokeStyle(group({ blurRadius: 6, blurGrow: true }));
		expect(style['overflow']).toBe('visible');
	});
});

describe('getShapeFillStrokeStyle 3D scene camera', () => {
	function shape3dEl(scene3d: Record<string, unknown>): PptxElement {
		return {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: { fillColor: '#3366CC', fillMode: 'solid', scene3d },
		} as unknown as PptxElement;
	}

	it('bakes the off-axis skew into the matrix3d for corrected presets (transformOrigin 0 0, no perspectiveOrigin)', () => {
		const style = getShapeFillStrokeStyle(
			shape3dEl({ cameraPreset: 'perspectiveContrastingLeftFacing' }),
		);
		expect(style['perspectiveOrigin']).toBeUndefined();
		expect(style['transformOrigin']).toBe('0 0');
		expect(String(style['transform'])).toContain('matrix3d(');
	});

	it('never emits a separate perspectiveOrigin, for any homography-driven preset', () => {
		const style = getShapeFillStrokeStyle(shape3dEl({ cameraPreset: 'perspectiveAbove' }));
		expect(style['perspectiveOrigin']).toBeUndefined();
		// 2026-09 off-axis-camera homography wave: an exact COM-measured
		// `matrix3d(...)` replaces the old `rotateX(20deg)` (see shared
		// `visual-3d-camera-homography`'s module doc comment).
		expect(String(style['transform'])).toContain('matrix3d(');
	});
});
