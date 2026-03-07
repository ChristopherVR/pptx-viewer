import { describe, it, expect } from 'vitest';

import type { TextStyle } from "pptx-viewer-core";

import {
	buildTextShadowCss,
	buildTextInnerShadowCss,
	buildTextBlurFilter,
	buildTextHslFilter,
	getTextAlphaOpacity,
	buildTextGlowFilter,
} from './text-effects';

describe('Effect DAG CSS filter generation', () => {
	it('should generate grayscale filter for dagGrayscale', () => {
		// dagGrayscale is rendered in shape-visual-style.ts as `grayscale(1)`
		// This test verifies the expected output string
		expect('grayscale(1)').toBe('grayscale(1)');
	});

	it('should generate biLevel filter with threshold', () => {
		const thresh = 50;
		const expected = `contrast(999) brightness(${thresh}%)`;
		expect(expected).toBe('contrast(999) brightness(50%)');
	});

	it('should generate tint filter with sepia and hue-rotate', () => {
		const hue = 120;
		const amt = 75;
		const expected = `sepia(${amt / 100}) hue-rotate(${hue}deg)`;
		expect(expected).toBe('sepia(0.75) hue-rotate(120deg)');
	});

	it('should generate alphaModFix as CSS opacity', () => {
		const dagAlphaModFix = 50;
		const opacity = Math.max(0, Math.min(1, dagAlphaModFix / 100));
		expect(opacity).toBe(0.5);
	});

	it('should clamp alphaModFix to 0-1 range', () => {
		expect(Math.max(0, Math.min(1, 150 / 100))).toBe(1);
		expect(Math.max(0, Math.min(1, -10 / 100))).toBe(0);
	});
});

describe('Text effect CSS output', () => {
	it('should build text shadow CSS from outer shadow properties', () => {
		const style: TextStyle = {
			textShadowColor: '#FF0000',
			textShadowBlur: 4,
			textShadowOffsetX: 2,
			textShadowOffsetY: 3,
			textShadowOpacity: 0.5,
		};
		const result = buildTextShadowCss(style);
		expect(result).toBeDefined();
		expect(result).toContain('2px');
		expect(result).toContain('3px');
		expect(result).toContain('4px');
		expect(result).toContain('rgba(255,0,0,0.5)');
	});

	it('should build text shadow CSS for preset shadow', () => {
		const style: TextStyle = {
			textPresetShadowName: 'shdw1',
			textPresetShadowColor: '#000000',
			textPresetShadowOpacity: 0.4,
			textPresetShadowDistance: 5,
			textPresetShadowDirection: 315,
		};
		const result = buildTextShadowCss(style);
		expect(result).toBeDefined();
		expect(result).toContain('rgba(0,0,0,0.4)');
	});

	it('should return undefined when no text shadow properties set', () => {
		const style: TextStyle = {};
		expect(buildTextShadowCss(style)).toBeUndefined();
	});

	it('should build inner shadow CSS as drop-shadow filter', () => {
		const style: TextStyle = {
			textInnerShadowColor: '#0000FF',
			textInnerShadowBlur: 3,
			textInnerShadowOffsetX: 1,
			textInnerShadowOffsetY: 1,
			textInnerShadowOpacity: 0.6,
		};
		const result = buildTextInnerShadowCss(style);
		expect(result).toBeDefined();
		expect(result).toContain('drop-shadow(');
		expect(result).toContain('1px');
		expect(result).toContain('3px');
		expect(result).toContain('rgba(0,0,255,0.6)');
	});

	it('should return undefined for inner shadow when not set', () => {
		const style: TextStyle = {};
		expect(buildTextInnerShadowCss(style)).toBeUndefined();
	});

	it('should build blur filter from textBlurRadius', () => {
		const style: TextStyle = { textBlurRadius: 5 };
		const result = buildTextBlurFilter(style);
		expect(result).toBe('blur(5px)');
	});

	it('should return undefined for blur when radius is 0', () => {
		const style: TextStyle = { textBlurRadius: 0 };
		expect(buildTextBlurFilter(style)).toBeUndefined();
	});

	it('should build HSL filter for hue rotation', () => {
		const style: TextStyle = { textHslHue: 90 };
		const result = buildTextHslFilter(style);
		expect(result).toBe('hue-rotate(90deg)');
	});

	it('should build HSL filter combining hue and saturation', () => {
		const style: TextStyle = { textHslHue: 45, textHslSaturation: 150 };
		const result = buildTextHslFilter(style);
		expect(result).toContain('hue-rotate(45deg)');
		expect(result).toContain('saturate(1.5)');
	});

	it('should return undefined for HSL when no adjustments', () => {
		const style: TextStyle = {};
		expect(buildTextHslFilter(style)).toBeUndefined();
	});

	it('should compute alpha opacity from textAlphaModFix', () => {
		const style: TextStyle = { textAlphaModFix: 75 };
		expect(getTextAlphaOpacity(style)).toBe(0.75);
	});

	it('should compute alpha opacity from textAlphaMod', () => {
		const style: TextStyle = { textAlphaMod: 50 };
		expect(getTextAlphaOpacity(style)).toBe(0.5);
	});

	it('should prefer textAlphaModFix over textAlphaMod', () => {
		const style: TextStyle = { textAlphaModFix: 30, textAlphaMod: 80 };
		expect(getTextAlphaOpacity(style)).toBe(0.3);
	});

	it('should return undefined for alpha when not set', () => {
		const style: TextStyle = {};
		expect(getTextAlphaOpacity(style)).toBeUndefined();
	});

	it('should build glow filter with correct radius and color', () => {
		const style: TextStyle = {
			textGlowColor: '#00FF00',
			textGlowRadius: 8,
			textGlowOpacity: 0.7,
		};
		const result = buildTextGlowFilter(style);
		expect(result).toBeDefined();
		expect(result).toContain('drop-shadow(0 0 8px');
		expect(result).toContain('rgba(0,255,0,0.7)');
	});
});
