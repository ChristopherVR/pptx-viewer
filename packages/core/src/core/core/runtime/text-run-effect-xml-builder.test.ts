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
		const from = (clr['a:clrFrom'] as Record<string, unknown>)['a:srgbClr'] as Record<string, unknown>;
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
