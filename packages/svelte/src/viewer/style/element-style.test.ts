import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getShapeFillStrokeStyle } from './element-style';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getShapeFillStrokeStyle: custom-geometry live reshape', () => {
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
		const style = getShapeFillStrokeStyle(
			shape({
				shapeType: 'custom',
				pathData: 'M 0 0 L 50 0 L 50 100 Z',
				pathWidth: 200,
				pathHeight: 100,
				customGeometryRawData: rawData,
				shapeAdjustments: { adj1: 75000 },
			} as Partial<PptxElement>),
		);
		expect(style.clipPath).toBe("path('M 0 0 L 150 0 L 150 100 Z')");
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
		expect(style.boxShadow).toBeUndefined();
		expect(String(style.filter)).toContain('drop-shadow');
	});

	it('paints a group glow as a `filter: drop-shadow`', () => {
		const style = getShapeFillStrokeStyle(group({ glowColor: '#00ff00', glowRadius: 10 }));
		expect(String(style.filter)).toContain('drop-shadow');
	});

	it('sets overflow: visible for a group blur effect with @grow', () => {
		const style = getShapeFillStrokeStyle(group({ blurRadius: 6, blurGrow: true }));
		expect(style.overflow).toBe('visible');
	});
});

describe('getShapeFillStrokeStyle 3D scene camera', () => {
	function shape3d(cameraPreset: string): PptxElement {
		return shape({
			shapeStyle: { fillColor: '#3366CC', fillMode: 'solid', scene3d: { cameraPreset } },
		} as unknown as Partial<PptxElement>);
	}

	it('bakes the off-axis skew into the matrix3d for corrected presets (transform-origin 0 0, no perspective-origin)', () => {
		const style = getShapeFillStrokeStyle(shape3d('perspectiveContrastingLeftFacing'));
		expect(style.perspectiveOrigin).toBeUndefined();
		expect(style.transformOrigin).toBe('0 0');
		expect(String(style.transform)).toContain('matrix3d(');
	});

	it('never emits a separate perspective-origin, for any homography-driven preset', () => {
		const style = getShapeFillStrokeStyle(shape3d('perspectiveAbove'));
		expect(style.perspectiveOrigin).toBeUndefined();
		// 2026-09 off-axis-camera homography wave: an exact COM-measured
		// `matrix3d(...)` replaces the old `rotateX(20deg)` (see shared
		// `visual-3d-camera-homography`'s module doc comment).
		expect(String(style.transform)).toContain('matrix3d(');
	});
});
