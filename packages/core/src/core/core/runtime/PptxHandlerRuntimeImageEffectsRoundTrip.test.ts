import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxImageEffects } from '../../types';

/**
 * Round-trip tests for the additional ECMA-376 blip alpha/recolour
 * primitives added on top of the existing brightness/contrast/grayscale
 * /alphaModFix/biLevel/duotone/clrChange handling.
 *
 * As with the sibling test files, the production code uses a 50-mixin
 * runtime that is impractical to instantiate in unit tests. We mirror the
 * exact algorithms here (kept in lock-step with the source) so we can
 * verify round-trip identity (parse → serialise → reparse → equal).
 *
 * Source helpers being mirrored:
 *   - PptxHandlerRuntimeImageEffects.extractImageEffects
 *   - PptxHandlerRuntimeSaveImageEffects.applyImageEffectsToBlip
 */

// ---------------------------------------------------------------------------
// Stubs for runtime-resolved helpers
// ---------------------------------------------------------------------------
function parseColor(node: unknown): string | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}
	const obj = node as XmlObject;
	const srgb = obj['a:srgbClr'] as XmlObject | undefined;
	if (srgb?.['@_val']) {
		return `#${srgb['@_val']}`;
	}
	// Test stub also recognises scheme colours by mapping the scheme slot to a
	// fixed placeholder hex — production resolves these via the theme.
	const scheme = obj['a:schemeClr'] as XmlObject | undefined;
	if (scheme?.['@_val']) {
		return '#888888';
	}
	if (obj['@_val'] && typeof obj['@_val'] === 'string' && /^[0-9A-Fa-f]{6}$/.test(obj['@_val'])) {
		return `#${obj['@_val']}`;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Mirror of the production parser — covers ONLY the new primitives plus the
// originals needed to verify combined round-trips.
// ---------------------------------------------------------------------------
// eslint-disable-next-line complexity
function extractImageEffects(blip: XmlObject | undefined): PptxImageEffects | null {
	if (!blip) {
		return null;
	}
	const effects: PptxImageEffects = {};
	let hasAny = false;

	const alphaInv = blip['a:alphaInv'] as XmlObject | undefined;
	if (alphaInv) {
		const color = parseColor(alphaInv);
		effects.alphaInv = color ? { color } : {};
		hasAny = true;
	}

	if (blip['a:alphaCeiling']) {
		effects.alphaCeiling = true;
		hasAny = true;
	}
	if (blip['a:alphaFloor']) {
		effects.alphaFloor = true;
		hasAny = true;
	}

	const alphaMod = blip['a:alphaMod'] as XmlObject | undefined;
	if (alphaMod) {
		const cont = alphaMod['a:cont'] as XmlObject | undefined;
		effects.alphaMod = cont ? { contRawXml: cont as Record<string, unknown> } : {};
		hasAny = true;
	}

	const alphaRepl = blip['a:alphaRepl'] as XmlObject | undefined;
	if (alphaRepl) {
		const a = alphaRepl['@_a'];
		if (a !== undefined) {
			const pct = parseInt(String(a)) / 1000;
			if (Number.isFinite(pct)) {
				effects.alphaRepl = pct;
				hasAny = true;
			}
		}
	}

	const alphaBiLevelNode = blip['a:alphaBiLevel'] as XmlObject | undefined;
	if (alphaBiLevelNode) {
		const thresh = alphaBiLevelNode['@_thresh'];
		if (thresh !== undefined) {
			const pct = parseInt(String(thresh)) / 1000;
			if (Number.isFinite(pct)) {
				effects.alphaBiLevel = pct;
				hasAny = true;
			}
		}
	}

	const clrRepl = blip['a:clrRepl'] as XmlObject | undefined;
	if (clrRepl) {
		const color = parseColor(clrRepl);
		if (color) {
			effects.clrRepl = {
				color,
				rawXml: clrRepl as Record<string, unknown>,
			};
			hasAny = true;
		}
	}

	const lumNode = blip['a:lum'] as XmlObject | undefined;
	if (lumNode) {
		const lumEffect: NonNullable<PptxImageEffects['lum']> = {};
		const lumBright = lumNode['@_bright'];
		const lumContrast = lumNode['@_contrast'];
		if (lumBright !== undefined) {
			const v = parseInt(String(lumBright)) / 1000;
			if (Number.isFinite(v)) {
				lumEffect.bright = v;
			}
		}
		if (lumContrast !== undefined) {
			const v = parseInt(String(lumContrast)) / 1000;
			if (Number.isFinite(v)) {
				lumEffect.contrast = v;
			}
		}
		effects.lum = lumEffect;
		hasAny = true;
	}

	const hslNode = blip['a:hsl'] as XmlObject | undefined;
	if (hslNode) {
		const hslEffect: NonNullable<PptxImageEffects['hsl']> = {};
		const hue = hslNode['@_hue'];
		const sat = hslNode['@_sat'];
		const lum = hslNode['@_lum'];
		if (hue !== undefined) {
			const v = parseInt(String(hue)) / 60000;
			if (Number.isFinite(v)) {
				hslEffect.hue = v;
			}
		}
		if (sat !== undefined) {
			const v = parseInt(String(sat)) / 1000;
			if (Number.isFinite(v)) {
				hslEffect.sat = v;
			}
		}
		if (lum !== undefined) {
			const v = parseInt(String(lum)) / 1000;
			if (Number.isFinite(v)) {
				hslEffect.lum = v;
			}
		}
		effects.hsl = hslEffect;
		hasAny = true;
	}

	const tintNode = blip['a:tint'] as XmlObject | undefined;
	if (tintNode) {
		const tintEffect: NonNullable<PptxImageEffects['tint']> = {};
		const hue = tintNode['@_hue'];
		const amt = tintNode['@_amt'];
		if (hue !== undefined) {
			const v = parseInt(String(hue)) / 60000;
			if (Number.isFinite(v)) {
				tintEffect.hue = v;
			}
		}
		if (amt !== undefined) {
			const v = parseInt(String(amt)) / 1000;
			if (Number.isFinite(v)) {
				tintEffect.amt = v;
			}
		}
		effects.tint = tintEffect;
		hasAny = true;
	}

	const fillOverlay = blip['a:fillOverlay'] as XmlObject | undefined;
	if (fillOverlay) {
		const blendRaw = String(fillOverlay['@_blend'] || 'over');
		const allowed = ['over', 'mult', 'screen', 'darken', 'lighten'] as const;
		const blend: NonNullable<PptxImageEffects['fillOverlay']>['blend'] = (
			allowed as readonly string[]
		).includes(blendRaw)
			? (blendRaw as 'over' | 'mult' | 'screen' | 'darken' | 'lighten')
			: 'over';
		const rawCopy: Record<string, unknown> = {};
		for (const key of Object.keys(fillOverlay)) {
			if (key === '@_blend') {
				continue;
			}
			rawCopy[key] = (fillOverlay as Record<string, unknown>)[key];
		}
		effects.fillOverlay = { blend, fillRawXml: rawCopy };
		hasAny = true;
	}

	const blurNode = blip['a:blur'] as XmlObject | undefined;
	if (blurNode) {
		const blurEffect: NonNullable<PptxImageEffects['blur']> = {};
		const rad = blurNode['@_rad'];
		if (rad !== undefined) {
			const v = parseInt(String(rad));
			if (Number.isFinite(v)) {
				blurEffect.rad = v;
			}
		}
		const grow = blurNode['@_grow'];
		if (grow !== undefined) {
			const s = String(grow).toLowerCase();
			blurEffect.grow = s === '1' || s === 'true';
		}
		effects.blur = blurEffect;
		hasAny = true;
	}

	return hasAny ? effects : null;
}

// ---------------------------------------------------------------------------
// Mirror of the production save writer — only the additions covered above.
// ---------------------------------------------------------------------------
// eslint-disable-next-line complexity
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

	if (nextEffects.alphaInv) {
		const node: XmlObject = {};
		if (nextEffects.alphaInv.color) {
			node['a:srgbClr'] = { '@_val': nextEffects.alphaInv.color.replace('#', '') };
		}
		blip['a:alphaInv'] = node;
	} else {
		delete blip['a:alphaInv'];
	}

	if (nextEffects.alphaCeiling) {
		blip['a:alphaCeiling'] = {};
	} else {
		delete blip['a:alphaCeiling'];
	}
	if (nextEffects.alphaFloor) {
		blip['a:alphaFloor'] = {};
	} else {
		delete blip['a:alphaFloor'];
	}

	if (nextEffects.alphaMod) {
		const node: XmlObject = {};
		if (nextEffects.alphaMod.contRawXml) {
			node['a:cont'] = nextEffects.alphaMod.contRawXml as XmlObject;
		}
		blip['a:alphaMod'] = node;
	} else {
		delete blip['a:alphaMod'];
	}

	if (typeof nextEffects.alphaRepl === 'number' && Number.isFinite(nextEffects.alphaRepl)) {
		blip['a:alphaRepl'] = { '@_a': String(Math.round(nextEffects.alphaRepl * 1000)) };
	} else {
		delete blip['a:alphaRepl'];
	}

	if (typeof nextEffects.alphaBiLevel === 'number' && Number.isFinite(nextEffects.alphaBiLevel)) {
		blip['a:alphaBiLevel'] = {
			'@_thresh': String(Math.round(nextEffects.alphaBiLevel * 1000)),
		};
	} else {
		delete blip['a:alphaBiLevel'];
	}

	if (nextEffects.clrRepl) {
		if (nextEffects.clrRepl.rawXml) {
			blip['a:clrRepl'] = nextEffects.clrRepl.rawXml as XmlObject;
		} else if (typeof nextEffects.clrRepl.color === 'string') {
			blip['a:clrRepl'] = {
				'a:srgbClr': { '@_val': nextEffects.clrRepl.color.replace('#', '') },
			};
		}
	} else {
		delete blip['a:clrRepl'];
	}

	if (nextEffects.lum) {
		const node: XmlObject = {};
		if (typeof nextEffects.lum.bright === 'number' && Number.isFinite(nextEffects.lum.bright)) {
			node['@_bright'] = String(Math.round(nextEffects.lum.bright * 1000));
		}
		if (typeof nextEffects.lum.contrast === 'number' && Number.isFinite(nextEffects.lum.contrast)) {
			node['@_contrast'] = String(Math.round(nextEffects.lum.contrast * 1000));
		}
		blip['a:lum'] = node;
	} else {
		delete blip['a:lum'];
	}

	if (nextEffects.hsl) {
		const node: XmlObject = {};
		if (typeof nextEffects.hsl.hue === 'number' && Number.isFinite(nextEffects.hsl.hue)) {
			node['@_hue'] = String(Math.round(nextEffects.hsl.hue * 60000));
		}
		if (typeof nextEffects.hsl.sat === 'number' && Number.isFinite(nextEffects.hsl.sat)) {
			node['@_sat'] = String(Math.round(nextEffects.hsl.sat * 1000));
		}
		if (typeof nextEffects.hsl.lum === 'number' && Number.isFinite(nextEffects.hsl.lum)) {
			node['@_lum'] = String(Math.round(nextEffects.hsl.lum * 1000));
		}
		blip['a:hsl'] = node;
	} else {
		delete blip['a:hsl'];
	}

	if (nextEffects.tint) {
		const node: XmlObject = {};
		if (typeof nextEffects.tint.hue === 'number' && Number.isFinite(nextEffects.tint.hue)) {
			node['@_hue'] = String(Math.round(nextEffects.tint.hue * 60000));
		}
		if (typeof nextEffects.tint.amt === 'number' && Number.isFinite(nextEffects.tint.amt)) {
			node['@_amt'] = String(Math.round(nextEffects.tint.amt * 1000));
		}
		blip['a:tint'] = node;
	} else {
		delete blip['a:tint'];
	}

	if (nextEffects.fillOverlay) {
		const node: XmlObject = { '@_blend': nextEffects.fillOverlay.blend };
		if (nextEffects.fillOverlay.fillRawXml) {
			for (const key of Object.keys(nextEffects.fillOverlay.fillRawXml)) {
				node[key] = (nextEffects.fillOverlay.fillRawXml as Record<string, unknown>)[
					key
				] as XmlObject[keyof XmlObject];
			}
		}
		blip['a:fillOverlay'] = node;
	} else {
		delete blip['a:fillOverlay'];
	}

	if (nextEffects.blur) {
		const node: XmlObject = {};
		if (typeof nextEffects.blur.rad === 'number' && Number.isFinite(nextEffects.blur.rad)) {
			node['@_rad'] = String(Math.round(nextEffects.blur.rad));
		}
		if (typeof nextEffects.blur.grow === 'boolean') {
			node['@_grow'] = nextEffects.blur.grow ? '1' : '0';
		}
		blip['a:blur'] = node;
	} else {
		delete blip['a:blur'];
	}
}

/** Run a parse → serialise → reparse cycle and return both effect snapshots. */
function roundTrip(initialBlip: XmlObject): {
	parsed: PptxImageEffects | null;
	roundTripped: PptxImageEffects | null;
	finalBlip: XmlObject;
} {
	const parsed = extractImageEffects(initialBlip);
	const blipFill: XmlObject = { 'a:blip': {} };
	applyImageEffectsToBlip(blipFill, parsed ?? undefined);
	const finalBlip = blipFill['a:blip'] as XmlObject;
	const roundTripped = extractImageEffects(finalBlip);
	return { parsed, roundTripped, finalBlip };
}

// ---------------------------------------------------------------------------
// Round-trip tests — one per primitive
// ---------------------------------------------------------------------------
describe('blip alpha/recolour primitives — round trip', () => {
	it('a:alphaInv (no colour child)', () => {
		const blip: XmlObject = { 'a:alphaInv': {} };
		const { parsed, roundTripped } = roundTrip(blip);
		expect(parsed).toStrictEqual({ alphaInv: {} });
		expect(roundTripped).toStrictEqual(parsed);
	});

	it('a:alphaInv (with srgbClr child)', () => {
		const blip: XmlObject = {
			'a:alphaInv': { 'a:srgbClr': { '@_val': '4A90E2' } },
		};
		const { parsed, roundTripped } = roundTrip(blip);
		expect(parsed?.alphaInv?.color).toBe('#4A90E2');
		expect(roundTripped).toStrictEqual(parsed);
	});

	it('a:alphaCeiling', () => {
		const blip: XmlObject = { 'a:alphaCeiling': {} };
		const { parsed, roundTripped } = roundTrip(blip);
		expect(parsed).toStrictEqual({ alphaCeiling: true });
		expect(roundTripped).toStrictEqual(parsed);
	});

	it('a:alphaFloor', () => {
		const blip: XmlObject = { 'a:alphaFloor': {} };
		const { parsed, roundTripped } = roundTrip(blip);
		expect(parsed).toStrictEqual({ alphaFloor: true });
		expect(roundTripped).toStrictEqual(parsed);
	});

	it('a:alphaMod (preserves opaque cont child)', () => {
		const blip: XmlObject = {
			'a:alphaMod': {
				'a:cont': {
					'@_type': 'rslt',
					'a:alphaModFix': { '@_amt': '40000' },
				},
			},
		};
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.alphaMod?.contRawXml).toStrictEqual({
			'@_type': 'rslt',
			'a:alphaModFix': { '@_amt': '40000' },
		});
		expect(roundTripped).toStrictEqual(parsed);
		// Assert the cont child reappears in the serialised XML.
		expect((finalBlip['a:alphaMod'] as XmlObject)['a:cont']).toStrictEqual({
			'@_type': 'rslt',
			'a:alphaModFix': { '@_amt': '40000' },
		});
	});

	it('a:alphaRepl', () => {
		const blip: XmlObject = { 'a:alphaRepl': { '@_a': '75000' } };
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.alphaRepl).toBe(75);
		expect(roundTripped).toStrictEqual(parsed);
		expect((finalBlip['a:alphaRepl'] as XmlObject)['@_a']).toBe('75000');
	});

	it('a:alphaBiLevel', () => {
		const blip: XmlObject = { 'a:alphaBiLevel': { '@_thresh': '50000' } };
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.alphaBiLevel).toBe(50);
		expect(roundTripped).toStrictEqual(parsed);
		expect((finalBlip['a:alphaBiLevel'] as XmlObject)['@_thresh']).toBe('50000');
	});

	it('a:clrRepl (preserves raw colour XML, including scheme modifiers)', () => {
		const blip: XmlObject = {
			'a:clrRepl': {
				'a:schemeClr': {
					'@_val': 'accent1',
					'a:lumMod': { '@_val': '75000' },
					'a:lumOff': { '@_val': '25000' },
				},
			},
		};
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.clrRepl?.rawXml).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '75000' },
				'a:lumOff': { '@_val': '25000' },
			},
		});
		expect(roundTripped?.clrRepl?.rawXml).toStrictEqual(parsed?.clrRepl?.rawXml);
		expect(finalBlip['a:clrRepl']).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '75000' },
				'a:lumOff': { '@_val': '25000' },
			},
		});
	});

	it('a:lum (bright + contrast)', () => {
		const blip: XmlObject = {
			'a:lum': { '@_bright': '20000', '@_contrast': '-15000' },
		};
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.lum).toStrictEqual({ bright: 20, contrast: -15 });
		expect(roundTripped).toStrictEqual(parsed);
		expect(finalBlip['a:lum']).toStrictEqual({ '@_bright': '20000', '@_contrast': '-15000' });
	});

	it('a:hsl (hue + sat + lum)', () => {
		const blip: XmlObject = {
			'a:hsl': { '@_hue': '7200000', '@_sat': '30000', '@_lum': '-10000' },
		};
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.hsl).toStrictEqual({ hue: 120, sat: 30, lum: -10 });
		expect(roundTripped).toStrictEqual(parsed);
		expect(finalBlip['a:hsl']).toStrictEqual({
			'@_hue': '7200000',
			'@_sat': '30000',
			'@_lum': '-10000',
		});
	});

	it('a:tint (hue + amt) inside blip', () => {
		const blip: XmlObject = {
			'a:tint': { '@_hue': '5400000', '@_amt': '50000' },
		};
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.tint).toStrictEqual({ hue: 90, amt: 50 });
		expect(roundTripped).toStrictEqual(parsed);
		expect(finalBlip['a:tint']).toStrictEqual({ '@_hue': '5400000', '@_amt': '50000' });
	});

	it('a:fillOverlay (preserves opaque inner solidFill)', () => {
		const blip: XmlObject = {
			'a:fillOverlay': {
				'@_blend': 'mult',
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
			},
		};
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.fillOverlay?.blend).toBe('mult');
		expect(parsed?.fillOverlay?.fillRawXml).toStrictEqual({
			'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
		});
		expect(roundTripped).toStrictEqual(parsed);
		expect(finalBlip['a:fillOverlay']).toStrictEqual({
			'@_blend': 'mult',
			'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
		});
	});

	it('a:fillOverlay falls back to "over" for unknown blend mode', () => {
		const blip: XmlObject = {
			'a:fillOverlay': {
				'@_blend': 'bogus-mode',
				'a:noFill': {},
			},
		};
		const { parsed } = roundTrip(blip);
		expect(parsed?.fillOverlay?.blend).toBe('over');
	});

	it('a:blur (rad + grow=1)', () => {
		const blip: XmlObject = { 'a:blur': { '@_rad': '63500', '@_grow': '1' } };
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.blur).toStrictEqual({ rad: 63500, grow: true });
		expect(roundTripped).toStrictEqual(parsed);
		expect(finalBlip['a:blur']).toStrictEqual({ '@_rad': '63500', '@_grow': '1' });
	});

	it('a:blur (rad only — no grow attribute)', () => {
		const blip: XmlObject = { 'a:blur': { '@_rad': '12700' } };
		const { parsed, roundTripped, finalBlip } = roundTrip(blip);
		expect(parsed?.blur).toStrictEqual({ rad: 12700 });
		expect(roundTripped).toStrictEqual(parsed);
		expect(finalBlip['a:blur']).toStrictEqual({ '@_rad': '12700' });
	});

	it('all primitives combined round-trip cleanly', () => {
		const blip: XmlObject = {
			'a:alphaInv': { 'a:srgbClr': { '@_val': 'AABBCC' } },
			'a:alphaCeiling': {},
			'a:alphaFloor': {},
			'a:alphaMod': {
				'a:cont': { 'a:alphaModFix': { '@_amt': '60000' } },
			},
			'a:alphaRepl': { '@_a': '90000' },
			'a:alphaBiLevel': { '@_thresh': '40000' },
			'a:clrRepl': { 'a:srgbClr': { '@_val': '112233' } },
			'a:lum': { '@_bright': '15000' },
			'a:hsl': { '@_hue': '3600000', '@_sat': '0', '@_lum': '0' },
			'a:tint': { '@_hue': '0', '@_amt': '25000' },
			'a:fillOverlay': {
				'@_blend': 'screen',
				'a:solidFill': { 'a:srgbClr': { '@_val': 'CCCCCC' } },
			},
			'a:blur': { '@_rad': '50800', '@_grow': '0' },
		};
		const { parsed, roundTripped } = roundTrip(blip);
		expect(parsed).not.toBeNull();
		expect(roundTripped).toStrictEqual(parsed);
	});
});
