import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	clampText3dPt,
	hasText3dExtrusion,
	mergeText3d,
	TEXT_3D_EMU_PER_PT,
	TEXT_3D_MAX_BEVEL_PT,
	text3dEmuToPt,
	text3dPtToEmu,
	text3dStylePatch,
	toggleText3dExtrusion,
} from './text-3d-fields';

describe('text-3d-fields', () => {
	it('round-trips points through EMU', () => {
		expect(text3dPtToEmu(6)).toBe(6 * TEXT_3D_EMU_PER_PT);
		expect(text3dEmuToPt(6 * TEXT_3D_EMU_PER_PT)).toBe(6);
	});

	it('treats a missing or non-finite EMU value as zero points', () => {
		expect(text3dEmuToPt(undefined)).toBe(0);
		expect(text3dEmuToPt(Number.NaN)).toBe(0);
	});

	it('clamps edited point values into range', () => {
		expect(clampText3dPt(-5, TEXT_3D_MAX_BEVEL_PT)).toBe(0);
		expect(clampText3dPt(999, TEXT_3D_MAX_BEVEL_PT)).toBe(TEXT_3D_MAX_BEVEL_PT);
		expect(clampText3dPt(Number.NaN, TEXT_3D_MAX_BEVEL_PT)).toBe(0);
	});

	it('reports extrusion only for a positive depth', () => {
		expect(hasText3dExtrusion(undefined)).toBeFalsy();
		expect(hasText3dExtrusion({ extrusionHeight: 0 })).toBeFalsy();
		expect(hasText3dExtrusion({ extrusionHeight: 1 })).toBeTruthy();
	});

	it('merges partial 3D changes without dropping siblings', () => {
		expect(
			mergeText3d({ extrusionHeight: 10, bevelTopType: 'circle' }, { bevelTopWidth: 5 }),
		).toStrictEqual({ extrusionHeight: 10, bevelTopType: 'circle', bevelTopWidth: 5 });
	});

	it('seeds a visible depth when extrusion is switched on and clears it when off', () => {
		expect(toggleText3dExtrusion(undefined, true)).toStrictEqual({
			extrusionHeight: 6 * TEXT_3D_EMU_PER_PT,
		});
		expect(toggleText3dExtrusion({ bevelTopType: 'circle' }, false)).toBeUndefined();
	});

	it('writes text3d onto the existing textStyle without dropping other fields', () => {
		const el = {
			id: 'e1',
			type: 'text',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'hi',
			textStyle: { bold: true, fontSize: 18 },
		} as unknown as PptxElement;

		expect(text3dStylePatch(el, { extrusionHeight: 1270 })).toStrictEqual({
			textStyle: { bold: true, fontSize: 18, text3d: { extrusionHeight: 1270 } },
		});
		expect(text3dStylePatch(el, undefined)).toStrictEqual({
			textStyle: { bold: true, fontSize: 18, text3d: undefined },
		});
	});
});
