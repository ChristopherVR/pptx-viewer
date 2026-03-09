import { describe, it, expect } from 'vitest';
import {
	normalizeStrokeDashType,
	getCssBorderDashStyle,
	getCompoundLineBoxShadow,
	getSvgStrokeDasharray,
	getElementTransform,
	getTextCompensationTransform,
	parseDrawingPercent,
} from './style';
import type { PptxElement } from 'pptx-viewer-core';

describe('normalizeStrokeDashType', () => {
	it('should return undefined for undefined input', () => {
		expect(normalizeStrokeDashType(undefined)).toBeUndefined();
	});

	it('should return undefined for empty string', () => {
		expect(normalizeStrokeDashType('')).toBeUndefined();
	});

	it('should return "solid" for "solid"', () => {
		expect(normalizeStrokeDashType('solid')).toBe('solid');
	});

	it('should be case-insensitive', () => {
		expect(normalizeStrokeDashType('SOLID')).toBe('solid');
		expect(normalizeStrokeDashType('LgDash')).toBe('lgDash');
		expect(normalizeStrokeDashType('SYSDOT')).toBe('sysDot');
	});

	it('should normalize all known dash types', () => {
		expect(normalizeStrokeDashType('dot')).toBe('dot');
		expect(normalizeStrokeDashType('dash')).toBe('dash');
		expect(normalizeStrokeDashType('lgDash')).toBe('lgDash');
		expect(normalizeStrokeDashType('dashDot')).toBe('dashDot');
		expect(normalizeStrokeDashType('lgDashDot')).toBe('lgDashDot');
		expect(normalizeStrokeDashType('lgDashDotDot')).toBe('lgDashDotDot');
		expect(normalizeStrokeDashType('sysDot')).toBe('sysDot');
		expect(normalizeStrokeDashType('sysDash')).toBe('sysDash');
		expect(normalizeStrokeDashType('sysDashDot')).toBe('sysDashDot');
		expect(normalizeStrokeDashType('sysDashDotDot')).toBe('sysDashDotDot');
		expect(normalizeStrokeDashType('custom')).toBe('custom');
	});

	it('should return undefined for unknown dash types', () => {
		expect(normalizeStrokeDashType('zigzag')).toBeUndefined();
		expect(normalizeStrokeDashType('wavy')).toBeUndefined();
	});

	it('should trim whitespace', () => {
		expect(normalizeStrokeDashType('  solid  ')).toBe('solid');
	});
});

describe('getCssBorderDashStyle', () => {
	it('should return "solid" for undefined dash type', () => {
		expect(getCssBorderDashStyle(undefined)).toBe('solid');
	});

	it('should return "solid" for solid dash type', () => {
		expect(getCssBorderDashStyle('solid')).toBe('solid');
	});

	it('should return "dotted" for dot types', () => {
		expect(getCssBorderDashStyle('dot')).toBe('dotted');
		expect(getCssBorderDashStyle('sysDot')).toBe('dotted');
	});

	it('should return "dashed" for dash types', () => {
		expect(getCssBorderDashStyle('dash')).toBe('dashed');
		expect(getCssBorderDashStyle('lgDash')).toBe('dashed');
		expect(getCssBorderDashStyle('dashDot')).toBe('dashed');
		expect(getCssBorderDashStyle('lgDashDot')).toBe('dashed');
	});

	it('should return "solid" for compound line types regardless of dash', () => {
		expect(getCssBorderDashStyle('dot', 'dbl')).toBe('solid');
		expect(getCssBorderDashStyle('dash', 'thickThin')).toBe('solid');
		expect(getCssBorderDashStyle('lgDash', 'thinThick')).toBe('solid');
		expect(getCssBorderDashStyle('dot', 'tri')).toBe('solid');
	});

	it('should handle dash types not matched by dot or solid', () => {
		expect(getCssBorderDashStyle('lgDashDotDot')).toBe('dashed');
		expect(getCssBorderDashStyle('sysDashDotDot')).toBe('dashed');
	});
});

describe('getCompoundLineBoxShadow', () => {
	it('should return undefined for undefined compound line', () => {
		expect(getCompoundLineBoxShadow(undefined, 4, '#000')).toBeUndefined();
	});

	it('should return undefined for single line type', () => {
		expect(getCompoundLineBoxShadow('sng', 4, '#000')).toBeUndefined();
	});

	it('should return undefined for zero stroke width', () => {
		expect(getCompoundLineBoxShadow('dbl', 0, '#000')).toBeUndefined();
	});

	it('should return box-shadow string for double line', () => {
		const result = getCompoundLineBoxShadow('dbl', 10, '#FF0000');
		expect(result).toBeDefined();
		expect(result).toContain('inset');
		expect(result).toContain('#FF0000');
	});

	it('should return box-shadow string for thickThin', () => {
		const result = getCompoundLineBoxShadow('thickThin', 10, '#000');
		expect(result).toBeDefined();
		expect(result).toContain('inset');
	});

	it('should return box-shadow string for thinThick', () => {
		const result = getCompoundLineBoxShadow('thinThick', 10, '#000');
		expect(result).toBeDefined();
		expect(result).toContain('inset');
	});

	it('should return box-shadow string for tri (triple line)', () => {
		const result = getCompoundLineBoxShadow('tri', 10, '#000');
		expect(result).toBeDefined();
		expect(result).toContain('inset');
	});

	it('should return undefined for unknown compound type', () => {
		expect(getCompoundLineBoxShadow('quad', 10, '#000')).toBeUndefined();
	});

	it('should use minimum stroke width of 1', () => {
		const result = getCompoundLineBoxShadow('dbl', -5, '#000');
		// Negative stroke returns undefined
		expect(result).toBeUndefined();
	});
});

describe('getSvgStrokeDasharray', () => {
	it('should return undefined for undefined dash type', () => {
		expect(getSvgStrokeDasharray(undefined, 2)).toBeUndefined();
	});

	it('should return undefined for solid dash type', () => {
		expect(getSvgStrokeDasharray('solid', 2)).toBeUndefined();
	});

	it('should return dot pattern for dot type', () => {
		const result = getSvgStrokeDasharray('dot', 2);
		expect(result).toBe('2 4');
	});

	it('should return dash pattern for dash type', () => {
		const result = getSvgStrokeDasharray('dash', 2);
		expect(result).toBe('8 4');
	});

	it('should return long dash pattern for lgDash', () => {
		const result = getSvgStrokeDasharray('lgDash', 2);
		expect(result).toBe('14 5');
	});

	it('should return dashDot pattern', () => {
		const result = getSvgStrokeDasharray('dashDot', 2);
		expect(result).toBe('8 4 2 4');
	});

	it('should return lgDashDot pattern', () => {
		const result = getSvgStrokeDasharray('lgDashDot', 2);
		expect(result).toBe('14 5 2 5');
	});

	it('should return lgDashDotDot pattern', () => {
		const result = getSvgStrokeDasharray('lgDashDotDot', 2);
		expect(result).toBe('14 5 2 4 2 4');
	});

	it('should handle custom dash with segments', () => {
		const segments = [{ dash: 3000, space: 1500 }];
		const result = getSvgStrokeDasharray('custom', 2, segments);
		// dash: (3000/1000)*2=6, space: (1500/1000)*2=3
		expect(result).toBe('6 3');
	});

	it('should handle custom dash without segments', () => {
		const result = getSvgStrokeDasharray('custom', 2);
		expect(result).toBe('6 4');
	});

	it('should enforce minimum stroke width of 1', () => {
		const result = getSvgStrokeDasharray('dot', 0.5);
		expect(result).toBe('1 2');
	});
});

describe('getElementTransform', () => {
	it('should return undefined when no transforms apply', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
		} as PptxElement;
		expect(getElementTransform(element)).toBeUndefined();
	});

	it('should include scaleX(-1) for horizontal flip', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipHorizontal: true,
		} as PptxElement;
		expect(getElementTransform(element)).toContain('scaleX(-1)');
	});

	it('should include scaleY(-1) for vertical flip', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipVertical: true,
		} as PptxElement;
		expect(getElementTransform(element)).toContain('scaleY(-1)');
	});

	it('should include rotation', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			rotation: 45,
		} as PptxElement;
		expect(getElementTransform(element)).toBe('rotate(45deg)');
	});

	it('should combine all transforms', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipHorizontal: true, flipVertical: true, rotation: 90,
		} as PptxElement;
		const result = getElementTransform(element);
		expect(result).toBe('scaleX(-1) scaleY(-1) rotate(90deg)');
	});

	it('should not include rotation when rotation is 0', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			rotation: 0,
		} as PptxElement;
		expect(getElementTransform(element)).toBeUndefined();
	});

	it('should handle negative rotation', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			rotation: -30,
		} as PptxElement;
		expect(getElementTransform(element)).toBe('rotate(-30deg)');
	});

	it('should combine flip with rotation', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipHorizontal: true, rotation: 180,
		} as PptxElement;
		expect(getElementTransform(element)).toBe('scaleX(-1) rotate(180deg)');
	});
});

describe('getTextCompensationTransform', () => {
	it('should return undefined when no flips', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
		} as PptxElement;
		expect(getTextCompensationTransform(element)).toBeUndefined();
	});

	it('should compensate horizontal flip', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipHorizontal: true,
		} as PptxElement;
		expect(getTextCompensationTransform(element)).toBe('scaleX(-1)');
	});

	it('should compensate vertical flip', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipVertical: true,
		} as PptxElement;
		expect(getTextCompensationTransform(element)).toBe('scaleY(-1)');
	});

	it('should compensate both flips', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipHorizontal: true, flipVertical: true,
		} as PptxElement;
		expect(getTextCompensationTransform(element)).toBe('scaleX(-1) scaleY(-1)');
	});

	it('should not include rotation (only flips are compensated)', () => {
		const element = {
			id: '1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
			flipHorizontal: true, rotation: 90,
		} as PptxElement;
		expect(getTextCompensationTransform(element)).toBe('scaleX(-1)');
	});
});

describe('parseDrawingPercent', () => {
	it('should return undefined for undefined input', () => {
		expect(parseDrawingPercent(undefined)).toBeUndefined();
	});

	it('should return undefined for empty string', () => {
		expect(parseDrawingPercent('')).toBeUndefined();
	});

	it('should return undefined for non-numeric string', () => {
		expect(parseDrawingPercent('abc')).toBeUndefined();
	});

	it('should parse 100000 as 1.0 (100%)', () => {
		expect(parseDrawingPercent(100000)).toBe(1);
	});

	it('should parse 50000 as 0.5 (50%)', () => {
		expect(parseDrawingPercent(50000)).toBe(0.5);
	});

	it('should parse 0 as 0', () => {
		expect(parseDrawingPercent(0)).toBe(0);
	});

	it('should clamp values above 100000 to 1', () => {
		expect(parseDrawingPercent(200000)).toBe(1);
	});

	it('should clamp negative values to 0', () => {
		expect(parseDrawingPercent(-10000)).toBe(0);
	});

	it('should parse string numbers', () => {
		expect(parseDrawingPercent('75000')).toBe(0.75);
	});

	it('should return undefined for Infinity', () => {
		expect(parseDrawingPercent(Infinity)).toBeUndefined();
	});
});
