import { describe, it, expect } from 'vitest';

import type { TextStyle } from '../../types';
import { buildTextRunEffectListXml } from './text-run-effect-xml-builder';

describe('buildTextRunEffectListXml', () => {
	it('should return undefined when no effects are set', () => {
		const style: TextStyle = {};
		expect(buildTextRunEffectListXml(style)).toBeUndefined();
	});

	it('should serialize outer shadow', () => {
		const style: TextStyle = {
			textShadowColor: '#FF0000',
			textShadowBlur: 4,
			textShadowOffsetX: 3,
			textShadowOffsetY: 4,
			textShadowOpacity: 0.5,
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		expect(result?.['a:outerShdw']).toBeDefined();
		const shdw = result?.['a:outerShdw'] as Record<string, unknown>;
		expect(shdw['@_blurRad']).toBe(String(Math.round(4 * 9525)));
		expect((shdw['a:srgbClr'] as Record<string, unknown>)['@_val']).toBe('FF0000');
	});

	it('should serialize inner shadow', () => {
		const style: TextStyle = {
			textInnerShadowColor: '#0000FF',
			textInnerShadowBlur: 3,
			textInnerShadowOffsetX: 1,
			textInnerShadowOffsetY: 2,
			textInnerShadowOpacity: 0.6,
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		expect(result?.['a:innerShdw']).toBeDefined();
		const inner = result?.['a:innerShdw'] as Record<string, unknown>;
		expect(inner['@_blurRad']).toBe(String(Math.round(3 * 9525)));
		expect((inner['a:srgbClr'] as Record<string, unknown>)['@_val']).toBe('0000FF');
	});

	it('should serialize preset shadow with name', () => {
		const style: TextStyle = {
			textPresetShadowName: 'shdw1',
			textPresetShadowColor: '#333333',
			textPresetShadowDistance: 5,
			textPresetShadowDirection: 315,
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const prst = result?.['a:prstShdw'] as Record<string, unknown>;
		expect(prst['@_prst']).toBe('shdw1');
		expect(prst['@_dist']).toBe(String(Math.round(5 * 9525)));
		expect(prst['@_dir']).toBe(String(Math.round(315 * 60000)));
	});

	it('should serialize blur effect', () => {
		const style: TextStyle = { textBlurRadius: 6 };
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const blur = result?.['a:blur'] as Record<string, unknown>;
		expect(blur['@_rad']).toBe(String(Math.round(6 * 9525)));
	});

	it('should serialize alphaModFix', () => {
		const style: TextStyle = { textAlphaModFix: 50 };
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const amf = result?.['a:alphaModFix'] as Record<string, unknown>;
		expect(amf['@_amt']).toBe(String(50 * 1000));
	});

	it('should serialize alphaMod', () => {
		const style: TextStyle = { textAlphaMod: 75 };
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const am = result?.['a:alphaMod'] as Record<string, unknown>;
		expect(am['@_amt']).toBe(String(75 * 1000));
	});

	it('should serialize HSL modifications', () => {
		const style: TextStyle = {
			textHslHue: 90,
			textHslSaturation: 150,
			textHslLuminance: 20,
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const hsl = result?.['a:hsl'] as Record<string, unknown>;
		expect(hsl['@_hue']).toBe(String(Math.round(90 * 60000)));
		expect(hsl['@_sat']).toBe(String(Math.round(150 * 1000)));
		expect(hsl['@_lum']).toBe(String(Math.round(20 * 1000)));
	});

	it('should serialize color change', () => {
		const style: TextStyle = {
			textClrChangeFrom: '#00FF00',
			textClrChangeTo: '#FF0000',
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const clr = result?.['a:clrChange'] as Record<string, unknown>;
		expect(clr).toBeDefined();
		const from = (clr['a:clrFrom'] as Record<string, unknown>)['a:srgbClr'] as Record<
			string,
			unknown
		>;
		expect(from['@_val']).toBe('00FF00');
		const to = (clr['a:clrTo'] as Record<string, unknown>)['a:srgbClr'] as Record<string, unknown>;
		expect(to['@_val']).toBe('FF0000');
	});

	it('should serialize duotone', () => {
		const style: TextStyle = {
			textDuotone: { color1: '#000000', color2: '#FFFFFF' },
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		const duotone = result?.['a:duotone'] as Record<string, unknown>;
		const colors = duotone['a:srgbClr'] as Array<Record<string, unknown>>;
		expect(colors).toHaveLength(2);
		expect(colors[0]['@_val']).toBe('000000');
		expect(colors[1]['@_val']).toBe('FFFFFF');
	});

	/**
	 * `@dir` on `a:outerShdw` / `a:innerShdw` / `a:prstShdw` is typed
	 * `ST_PositiveFixedAngle` (ECMA-376 S20.1.10.53): `0 <= v < 21600000`.
	 * `Math.atan2` ranges over `(-pi, pi]`, so deriving the direction straight
	 * from the shadow offsets emitted a NEGATIVE angle for every direction in
	 * the lower half plane - half of all shadows. PowerPoint does not clamp it;
	 * it refuses to open the package at all.
	 */
	describe('@dir stays inside ST_PositiveFixedAngle', () => {
		const MAX_UNITS = 21600000;

		/** 225 degrees: the "up and to the left" drop shadow, atan2 -> -135. */
		const UP_LEFT = { x: -0.94, y: -0.94 };

		/** Read `@_dir` off one effect node of a built `a:effectLst`. */
		function directionOf(style: TextStyle, effect: string): number {
			const result = buildTextRunEffectListXml(style);
			const node = result?.[effect] as Record<string, unknown> | undefined;
			expect(node).toBeDefined();
			return Number(node?.['@_dir']);
		}

		it('normalises a lower-half-plane outer shadow direction', () => {
			const dir = directionOf(
				{
					textShadowColor: '#000000',
					textShadowBlur: 4,
					textShadowOffsetX: UP_LEFT.x,
					textShadowOffsetY: UP_LEFT.y,
				},
				'a:outerShdw',
			);
			expect(dir).toBe(225 * 60000);
			expect(dir).toBeGreaterThanOrEqual(0);
			expect(dir).toBeLessThan(MAX_UNITS);
		});

		it('normalises a lower-half-plane inner shadow direction', () => {
			const dir = directionOf(
				{
					textInnerShadowColor: '#000000',
					textInnerShadowBlur: 3,
					textInnerShadowOffsetX: UP_LEFT.x,
					textInnerShadowOffsetY: UP_LEFT.y,
				},
				'a:innerShdw',
			);
			expect(dir).toBe(225 * 60000);
			expect(dir).toBeGreaterThanOrEqual(0);
			expect(dir).toBeLessThan(MAX_UNITS);
		});

		it('clamps a negative preset shadow direction', () => {
			const dir = directionOf(
				{ textPresetShadowName: 'shdw1', textPresetShadowDirection: -45 },
				'a:prstShdw',
			);
			expect(dir).toBe(315 * 60000);
			expect(dir).toBeGreaterThanOrEqual(0);
			expect(dir).toBeLessThan(MAX_UNITS);
		});

		it('clamps a preset shadow direction beyond a full turn', () => {
			expect(
				directionOf(
					{ textPresetShadowName: 'shdw1', textPresetShadowDirection: 405 },
					'a:prstShdw',
				),
			).toBe(45 * 60000);
		});

		it('never emits an out-of-range @dir for any shadow offset direction', () => {
			const outOfRange: string[] = [];
			for (let degrees = 0; degrees < 360; degrees += 15) {
				const radians = (degrees * Math.PI) / 180;
				const style: TextStyle = {
					textShadowColor: '#000000',
					textShadowOffsetX: Math.cos(radians) * 3,
					textShadowOffsetY: Math.sin(radians) * 3,
					textInnerShadowColor: '#000000',
					textInnerShadowOffsetX: Math.cos(radians) * 3,
					textInnerShadowOffsetY: Math.sin(radians) * 3,
				};
				for (const effect of ['a:outerShdw', 'a:innerShdw']) {
					const dir = directionOf(style, effect);
					if (!(dir >= 0 && dir < MAX_UNITS)) {
						outOfRange.push(`${effect} @dir=${dir} at ${degrees} deg`);
					}
				}
			}
			expect(outOfRange).toStrictEqual([]);
		});
	});

	/**
	 * Regression guard for the limitations.md caveat: a text run's reflection
	 * must serialize the same `@sx`/`@sy`, `@kx`/`@ky`, `@rot`, `@fadeDir` and
	 * `@algn` attributes the shape-level `buildReflectionXml` already emits,
	 * not just `@dist`/`@stA`/`@endA`/`@blurRad`.
	 */
	describe('reflection', () => {
		it('should serialize scale, skew, rotation, fade direction and alignment', () => {
			const style: TextStyle = {
				textReflection: true,
				textReflectionBlur: 2,
				textReflectionStartOpacity: 0.6,
				textReflectionEndOpacity: 0.1,
				textReflectionOffset: 1,
				textReflectionFadeDirection: 45,
				textReflectionScaleX: 50000,
				textReflectionScaleY: 150000,
				textReflectionSkewX: 600000,
				textReflectionSkewY: -300000,
				textReflectionRotation: 30,
				textReflectionAlignment: 'br',
			};
			const result = buildTextRunEffectListXml(style);
			expect(result).toBeDefined();
			const refl = result?.['a:reflection'] as Record<string, unknown>;
			expect(refl).toBeDefined();
			expect(refl['@_blurRad']).toBe(String(Math.round(2 * 9525)));
			expect(refl['@_stA']).toBe(String(Math.round(0.6 * 100000)));
			expect(refl['@_endA']).toBe(String(Math.round(0.1 * 100000)));
			expect(refl['@_dist']).toBe(String(Math.round(1 * 9525)));
			expect(refl['@_fadeDir']).toBe(String(45 * 60000));
			expect(refl['@_sx']).toBe('50000');
			expect(refl['@_sy']).toBe('150000');
			expect(refl['@_kx']).toBe('600000');
			expect(refl['@_ky']).toBe('-300000');
			expect(refl['@_rot']).toBe(String(30 * 60000));
			expect(refl['@_algn']).toBe('br');
		});

		it('should omit scale/skew/rotation/fade/alignment attributes when unset', () => {
			const style: TextStyle = { textReflection: true, textReflectionBlur: 2 };
			const result = buildTextRunEffectListXml(style);
			const refl = result?.['a:reflection'] as Record<string, unknown>;
			expect(refl['@_sx']).toBeUndefined();
			expect(refl['@_sy']).toBeUndefined();
			expect(refl['@_kx']).toBeUndefined();
			expect(refl['@_ky']).toBeUndefined();
			expect(refl['@_rot']).toBeUndefined();
			expect(refl['@_fadeDir']).toBeUndefined();
			expect(refl['@_algn']).toBeUndefined();
		});
	});

	it('should include multiple effects in same effectLst', () => {
		const style: TextStyle = {
			textShadowColor: '#000000',
			textGlowColor: '#FFFF00',
			textGlowRadius: 8,
			textBlurRadius: 3,
		};
		const result = buildTextRunEffectListXml(style);
		expect(result).toBeDefined();
		expect(result?.['a:outerShdw']).toBeDefined();
		expect(result?.['a:glow']).toBeDefined();
		expect(result?.['a:blur']).toBeDefined();
	});
});
