import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	clampText3dPt,
	hasText3dExtrusion,
	mergeText3d,
	TEXT_3D_EMU_PER_PT,
	TEXT_3D_MAX_BEVEL_PT,
	text3dEmuToPt,
	text3dInheritsFromTemplate,
	text3dPtToEmu,
	text3dStylePatch,
	toggleText3dExtrusion,
	toggleText3dExtrusionPatch,
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
			textStyle: {
				bold: true,
				fontSize: 18,
				text3d: { extrusionHeight: 1270 },
				flatText: undefined,
			},
		});
		expect(text3dStylePatch(el, undefined)).toStrictEqual({
			textStyle: { bold: true, fontSize: 18, text3d: undefined, flatText: undefined },
		});
	});

	/**
	 * Switching 3D off on a placeholder used to write `text3d: undefined` and
	 * nothing else. The shape inherits its `a:sp3d` from the layout/master, so
	 * the inheritance merge refilled `text3d` from the ancestor and the text
	 * stayed extruded; the only thing that stops that is an explicit `a:flatTx`
	 * (`TextStyle.flatText`, an OOXML `EG_Text3D` choice).
	 */
	describe('placeholder inheritance', () => {
		const placeholder = {
			id: 'ph1',
			type: 'text',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'Title',
			placeholderType: 'title',
			textStyle: { fontSize: 44 },
		} as unknown as PptxElement;

		it('detects inheritance from the element placeholder fields', () => {
			expect(text3dInheritsFromTemplate(placeholder)).toBeTruthy();
			expect(
				text3dInheritsFromTemplate({ ...placeholder, placeholderType: undefined } as PptxElement),
			).toBeFalsy();
			expect(
				text3dInheritsFromTemplate({ ...placeholder, placeholderType: '' } as PptxElement),
			).toBeFalsy();
		});

		it('writes flatText when a placeholder switches extrusion off', () => {
			expect(toggleText3dExtrusionPatch({ extrusionHeight: 76200 }, false, true)).toStrictEqual({
				text3d: undefined,
				flatText: true,
			});
			expect(text3dStylePatch(placeholder, undefined)).toStrictEqual({
				textStyle: { fontSize: 44, text3d: undefined, flatText: true },
			});
		});

		it('clears flatText again when extrusion is switched back on', () => {
			expect(toggleText3dExtrusionPatch(undefined, true, true)).toStrictEqual({
				text3d: { extrusionHeight: 6 * TEXT_3D_EMU_PER_PT },
				flatText: undefined,
			});
			expect(text3dStylePatch(placeholder, { extrusionHeight: 1270 })).toStrictEqual({
				textStyle: { fontSize: 44, text3d: { extrusionHeight: 1270 }, flatText: undefined },
			});
		});

		it('leaves a plain (non-inheriting) shape without an orphan flatTx', () => {
			expect(toggleText3dExtrusionPatch({ extrusionHeight: 76200 }, false, false)).toStrictEqual({
				text3d: undefined,
				flatText: undefined,
			});
		});
	});
});
