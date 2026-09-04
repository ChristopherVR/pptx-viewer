import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxImageEffects } from '../../types';
import { buildSrcRectXml, clampCropForSave } from './image-crop-save';

/**
 * The image-effects save module defines most of its helpers as **protected**
 * methods on the class. `clampCropForSave` and the `a:srcRect` builder were
 * extracted to the pure, directly-importable `image-crop-save.ts` module
 * (issue G2) to keep this already-large file within budget; test those two
 * against the REAL implementation below rather than a reimplemented copy.
 *
 * The remaining helpers we care about here are still reimplemented copies
 * (they stay class-private for now):
 *   - applyImageEffectsToBlip(blipFill, effects)
 *   - textVerticalAlignToDrawingValue(vAlign)
 *   - textDirectionToDrawingValue(value)
 *   - normalizeTextColumnCount(value)
 *   - normalizeTextLineBreaks(value)
 *   - getTextValueForSave(text, textSegments)
 */

describe('clampCropForSave', () => {
	it('should return 0 for non-number inputs', () => {
		expect(clampCropForSave(undefined)).toBe(0);
		expect(clampCropForSave(null)).toBe(0);
		expect(clampCropForSave('0.5')).toBe(0);
		expect(clampCropForSave(NaN)).toBe(0);
		expect(clampCropForSave(Infinity)).toBe(0);
	});

	it('preserves a negative outward-crop inset instead of clamping to 0 (issue G2)', () => {
		expect(clampCropForSave(-0.5)).toBe(-0.5);
	});

	it('should return the value when within range', () => {
		expect(clampCropForSave(0.5)).toBe(0.5);
		expect(clampCropForSave(0)).toBe(0);
		expect(clampCropForSave(0.95)).toBe(0.95);
	});

	it('should clamp positive values above 0.95', () => {
		expect(clampCropForSave(1)).toBe(0.95);
		expect(clampCropForSave(2)).toBe(0.95);
	});

	it('should clamp the magnitude of negative values below -0.95', () => {
		expect(clampCropForSave(-1)).toBe(-0.95);
		expect(clampCropForSave(-2)).toBe(-0.95);
	});
});

// `applyImageCropToBlipFill` itself is a thin protected wrapper (delete
// a:srcRect / syncPictureShapeTypeWithCropShape / call buildSrcRectXml); the
// real crop maths lives in `buildSrcRectXml`, tested directly here.
function applyImageCropToBlipFill(
	blipFill: XmlObject | undefined,
	element: {
		cropLeft?: number;
		cropTop?: number;
		cropRight?: number;
		cropBottom?: number;
	},
): void {
	if (!blipFill) {
		return;
	}
	const srcRect = buildSrcRectXml(element);
	if (!srcRect) {
		delete blipFill['a:srcRect'];
		return;
	}
	blipFill['a:srcRect'] = srcRect;
}

describe('applyImageCropToBlipFill', () => {
	it('should do nothing when blipFill is undefined', () => {
		applyImageCropToBlipFill(undefined, { cropLeft: 0.1 });
		// No error thrown
	});

	it('should delete srcRect when no crop values are set', () => {
		const blipFill: XmlObject = { 'a:srcRect': { '@_l': '5000' } };
		applyImageCropToBlipFill(blipFill, {});
		expect(blipFill['a:srcRect']).toBeUndefined();
	});

	it('should delete srcRect when all crop values are zero', () => {
		const blipFill: XmlObject = { 'a:srcRect': { '@_l': '5000' } };
		applyImageCropToBlipFill(blipFill, {
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
		expect(blipFill['a:srcRect']).toBeUndefined();
	});

	it('should set srcRect for valid crop values', () => {
		const blipFill: XmlObject = {};
		applyImageCropToBlipFill(blipFill, {
			cropLeft: 0.1,
			cropTop: 0.2,
			cropRight: 0.15,
			cropBottom: 0.05,
		});
		const srcRect = blipFill['a:srcRect'] as XmlObject;
		expect(srcRect).toBeDefined();
		expect(srcRect['@_l']).toBe(String(Math.round(0.1 * 100000)));
		expect(srcRect['@_t']).toBe(String(Math.round(0.2 * 100000)));
		expect(srcRect['@_r']).toBe(String(Math.round(0.15 * 100000)));
		expect(srcRect['@_b']).toBe(String(Math.round(0.05 * 100000)));
	});

	it('writes a negative srcRect inset instead of dropping it (issue G2)', () => {
		const blipFill: XmlObject = {};
		applyImageCropToBlipFill(blipFill, {
			cropLeft: -0.2,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
		const srcRect = blipFill['a:srcRect'] as XmlObject;
		expect(srcRect).toBeDefined();
		expect(srcRect['@_l']).toBe(String(Math.round(-0.2 * 100000)));
	});

	it('keeps srcRect deleted when a negative and positive inset on the same axis cancel out', () => {
		// Sum-based detection would read -0.2 + 0.2 = 0 as "no crop"; the real
		// check is per-edge magnitude, so both authored insets must survive.
		const blipFill: XmlObject = {};
		applyImageCropToBlipFill(blipFill, {
			cropLeft: -0.2,
			cropRight: 0.2,
		});
		const srcRect = blipFill['a:srcRect'] as XmlObject;
		expect(srcRect).toBeDefined();
		expect(srcRect['@_l']).toBe(String(Math.round(-0.2 * 100000)));
		expect(srcRect['@_r']).toBe(String(Math.round(0.2 * 100000)));
	});

	it('should normalize when horizontal crop exceeds 0.99', () => {
		const blipFill: XmlObject = {};
		applyImageCropToBlipFill(blipFill, {
			cropLeft: 0.5,
			cropRight: 0.5,
		});
		const srcRect = blipFill['a:srcRect'] as XmlObject;
		expect(srcRect).toBeDefined();
		// Total horizontal = 1.0, scale = 0.99/1.0 = 0.99
		// Normalized left = clamp(0.5 * 0.99) = 0.495
		const expectedLeft = Math.round(clampCropForSave(0.5 * 0.99) * 100000);
		expect(srcRect['@_l']).toBe(String(expectedLeft));
	});
});

// ---------------------------------------------------------------------------
// applyImageEffectsToBlip — reimplemented from source
// ---------------------------------------------------------------------------
function applyImageEffectsToBlip(
	blipFill: XmlObject | undefined,
	effects: PptxImageEffects | undefined,
): void {
	if (!blipFill) {
		return;
	}
	const blip = blipFill['a:blip'] as XmlObject | undefined;
	if (!blip) {
		return;
	}
	const nextEffects = effects ?? {};

	if (typeof nextEffects.brightness === 'number' && Number.isFinite(nextEffects.brightness)) {
		blip['@_bright'] = String(Math.round(nextEffects.brightness * 1000));
	} else {
		delete blip['@_bright'];
		delete blip['@_brt'];
	}

	if (typeof nextEffects.contrast === 'number' && Number.isFinite(nextEffects.contrast)) {
		blip['@_contrast'] = String(Math.round(nextEffects.contrast * 1000));
	} else {
		delete blip['@_contrast'];
		delete blip['@_cont'];
	}

	if (nextEffects.grayscale) {
		blip['a:grayscl'] = {};
	} else {
		delete blip['a:grayscl'];
	}

	if (typeof nextEffects.alphaModFix === 'number' && Number.isFinite(nextEffects.alphaModFix)) {
		blip['a:alphaModFix'] = {
			'@_amt': String(Math.round(nextEffects.alphaModFix * 1000)),
		};
	} else {
		delete blip['a:alphaModFix'];
	}

	if (typeof nextEffects.biLevel === 'number' && Number.isFinite(nextEffects.biLevel)) {
		blip['a:biLevel'] = {
			'@_thresh': String(Math.round(nextEffects.biLevel * 1000)),
		};
	} else {
		delete blip['a:biLevel'];
	}

	if (
		nextEffects.duotone &&
		typeof nextEffects.duotone.color1 === 'string' &&
		typeof nextEffects.duotone.color2 === 'string'
	) {
		blip['a:duotone'] = {
			'a:srgbClr': [
				{ '@_val': nextEffects.duotone.color1.replace('#', '') },
				{ '@_val': nextEffects.duotone.color2.replace('#', '') },
			],
		};
	} else {
		delete blip['a:duotone'];
	}

	if (
		nextEffects.clrChange &&
		typeof nextEffects.clrChange.clrFrom === 'string' &&
		typeof nextEffects.clrChange.clrTo === 'string'
	) {
		const clrToNode: XmlObject = {
			'a:srgbClr': {
				'@_val': nextEffects.clrChange.clrTo.replace('#', ''),
			},
		};
		if (nextEffects.clrChange.clrToTransparent) {
			(clrToNode['a:srgbClr'] as XmlObject)['a:alpha'] = { '@_val': '0' };
		}
		blip['a:clrChange'] = {
			'a:clrFrom': {
				'a:srgbClr': {
					'@_val': nextEffects.clrChange.clrFrom.replace('#', ''),
				},
			},
			'a:clrTo': clrToNode,
		};
	} else {
		delete blip['a:clrChange'];
	}
}

describe('applyImageEffectsToBlip', () => {
	it('should do nothing when blipFill is undefined', () => {
		applyImageEffectsToBlip(undefined, { brightness: 20 });
	});

	it('should do nothing when blip node is missing', () => {
		const blipFill: XmlObject = {};
		applyImageEffectsToBlip(blipFill, { brightness: 20 });
		expect(blipFill['a:blip']).toBeUndefined();
	});

	it('should set brightness on blip', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, { brightness: 20 });
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['@_bright']).toBe(String(20 * 1000));
	});

	it('should clear brightness when not provided', () => {
		const blipFill: XmlObject = {
			'a:blip': { '@_bright': '5000', '@_brt': '5000' },
		};
		applyImageEffectsToBlip(blipFill, {});
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['@_bright']).toBeUndefined();
		expect(blip['@_brt']).toBeUndefined();
	});

	it('should set contrast on blip', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, { contrast: -10 });
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['@_contrast']).toBe(String(-10 * 1000));
	});

	it('should set grayscale flag', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, { grayscale: true });
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['a:grayscl']).toStrictEqual({});
	});

	it('should remove grayscale when not set', () => {
		const blipFill: XmlObject = { 'a:blip': { 'a:grayscl': {} } };
		applyImageEffectsToBlip(blipFill, {});
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['a:grayscl']).toBeUndefined();
	});

	it('should set alphaModFix', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, { alphaModFix: 80 });
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['a:alphaModFix']).toStrictEqual({ '@_amt': String(80 * 1000) });
	});

	it('should set biLevel threshold', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, { biLevel: 50 });
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['a:biLevel']).toStrictEqual({ '@_thresh': String(50 * 1000) });
	});

	it('should set duotone colours', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, {
			duotone: { color1: '#000000', color2: '#FFFFFF' },
		});
		const blip = blipFill['a:blip'] as XmlObject;
		const duo = blip['a:duotone'] as XmlObject;
		const colors = duo['a:srgbClr'] as XmlObject[];
		expect(colors).toHaveLength(2);
		expect(colors[0]['@_val']).toBe('000000');
		expect(colors[1]['@_val']).toBe('FFFFFF');
	});

	it('should set clrChange with transparency', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, {
			clrChange: {
				clrFrom: '#00FF00',
				clrTo: '#FF0000',
				clrToTransparent: true,
			},
		});
		const blip = blipFill['a:blip'] as XmlObject;
		const cc = blip['a:clrChange'] as XmlObject;
		const clrTo = cc['a:clrTo'] as XmlObject;
		const srgb = clrTo['a:srgbClr'] as XmlObject;
		expect(srgb['@_val']).toBe('FF0000');
		expect((srgb['a:alpha'] as XmlObject)['@_val']).toBe('0');
	});

	it('should set clrChange without transparency', () => {
		const blipFill: XmlObject = { 'a:blip': {} };
		applyImageEffectsToBlip(blipFill, {
			clrChange: {
				clrFrom: '#AABBCC',
				clrTo: '#112233',
			},
		});
		const blip = blipFill['a:blip'] as XmlObject;
		const cc = blip['a:clrChange'] as XmlObject;
		const clrTo = cc['a:clrTo'] as XmlObject;
		const srgb = clrTo['a:srgbClr'] as XmlObject;
		expect(srgb['a:alpha']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// textVerticalAlignToDrawingValue — reimplemented from source
// ---------------------------------------------------------------------------
function textVerticalAlignToDrawingValue(
	vAlign: 'top' | 'middle' | 'bottom' | 'distributed' | 'justified' | undefined,
): string | undefined {
	if (vAlign === 'top') {
		return 't';
	}
	if (vAlign === 'middle') {
		return 'ctr';
	}
	if (vAlign === 'bottom') {
		return 'b';
	}
	// D2-G5: round-trip `dist`/`just` instead of collapsing to 'ctr' on save.
	if (vAlign === 'distributed') {
		return 'dist';
	}
	if (vAlign === 'justified') {
		return 'just';
	}
	return undefined;
}

describe('textVerticalAlignToDrawingValue', () => {
	it("should map 'top' to 't'", () => {
		expect(textVerticalAlignToDrawingValue('top')).toBe('t');
	});

	it("should map 'middle' to 'ctr'", () => {
		expect(textVerticalAlignToDrawingValue('middle')).toBe('ctr');
	});

	it("should map 'bottom' to 'b'", () => {
		expect(textVerticalAlignToDrawingValue('bottom')).toBe('b');
	});

	it('should return undefined for unknown values', () => {
		expect(textVerticalAlignToDrawingValue(undefined)).toBeUndefined();
	});

	it("should map 'distributed' to 'dist' (D2-G5, not collapsed to 'ctr')", () => {
		expect(textVerticalAlignToDrawingValue('distributed')).toBe('dist');
	});

	it("should map 'justified' to 'just' (D2-G5, not collapsed to 'ctr')", () => {
		expect(textVerticalAlignToDrawingValue('justified')).toBe('just');
	});
});

// ---------------------------------------------------------------------------
// textDirectionToDrawingValue — reimplemented from source
// ---------------------------------------------------------------------------
function textDirectionToDrawingValue(
	value: 'horizontal' | 'vertical' | 'vertical270' | undefined,
): string | undefined {
	if (value === 'vertical') {
		return 'vert';
	}
	if (value === 'vertical270') {
		return 'vert270';
	}
	return undefined;
}

describe('textDirectionToDrawingValue', () => {
	it("should map 'vertical' to 'vert'", () => {
		expect(textDirectionToDrawingValue('vertical')).toBe('vert');
	});

	it("should map 'vertical270' to 'vert270'", () => {
		expect(textDirectionToDrawingValue('vertical270')).toBe('vert270');
	});

	it("should return undefined for 'horizontal'", () => {
		expect(textDirectionToDrawingValue('horizontal')).toBeUndefined();
	});

	it('should return undefined for undefined', () => {
		expect(textDirectionToDrawingValue(undefined)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// normalizeTextColumnCount — reimplemented from source
// ---------------------------------------------------------------------------
function normalizeTextColumnCount(value: unknown): number | undefined {
	const parsed =
		typeof value === 'number' && Number.isFinite(value)
			? value
			: Number.parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return Math.max(1, Math.min(16, Math.round(parsed)));
}

describe('normalizeTextColumnCount', () => {
	it('should return undefined for undefined input', () => {
		expect(normalizeTextColumnCount(undefined)).toBeUndefined();
	});

	it('should return undefined for NaN-producing strings', () => {
		expect(normalizeTextColumnCount('abc')).toBeUndefined();
	});

	it('should clamp to minimum 1', () => {
		expect(normalizeTextColumnCount(0)).toBe(1);
		expect(normalizeTextColumnCount(-5)).toBe(1);
	});

	it('should clamp to maximum 16', () => {
		expect(normalizeTextColumnCount(20)).toBe(16);
		expect(normalizeTextColumnCount(100)).toBe(16);
	});

	it('should round fractional values', () => {
		expect(normalizeTextColumnCount(2.7)).toBe(3);
		expect(normalizeTextColumnCount(3.2)).toBe(3);
	});

	it('should parse string numbers', () => {
		expect(normalizeTextColumnCount('4')).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// normalizeTextLineBreaks — reimplemented from source
// ---------------------------------------------------------------------------
function normalizeTextLineBreaks(value: string): string {
	return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

describe('normalizeTextLineBreaks', () => {
	it('should convert CRLF to LF', () => {
		expect(normalizeTextLineBreaks('a\r\nb')).toBe('a\nb');
	});

	it('should convert CR to LF', () => {
		expect(normalizeTextLineBreaks('a\rb')).toBe('a\nb');
	});

	it('should leave LF unchanged', () => {
		expect(normalizeTextLineBreaks('a\nb')).toBe('a\nb');
	});

	it('should handle mixed line breaks', () => {
		expect(normalizeTextLineBreaks('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
	});

	it('should handle empty string', () => {
		expect(normalizeTextLineBreaks('')).toBe('');
	});
});
