/**
 * Tests for CSS preprocessing utilities.
 *
 * Covers both the pure transformation functions (parseBlurValue,
 * has3dTransform, flatten3dTransform) and the DOM-dependent walk
 * functions (resolveCustomProperties, flattenBackdropFilter,
 * flattenMixBlendMode, flatten3dTransforms, removeUnsupportedFeatures,
 * preprocessCssForCapture) using lightweight mock DOM objects.
 */
import { describe, it, expect, beforeEach, afterEach, expectTypeOf } from 'vitest';

import {
	parseBlurValue,
	has3dTransform,
	flatten3dTransform,
	resolveCustomProperties,
	flattenBackdropFilter,
	flattenMixBlendMode,
	flatten3dTransforms,
	removeUnsupportedFeatures,
	preprocessCssForCapture,
} from './css-preprocessing';
import type { CssPreprocessingOptions } from './css-preprocessing';

// ────────────────────────────────────────────────────────────────────
// Mock DOM helpers
// ────────────────────────────────────────────────────────────────────

/** WeakMap from mock element to its computed styles. */
const elementComputedStyles = new WeakMap<Element, Record<string, string>>();

/**
 * Lightweight mock for an HTMLElement with controllable inline style
 * and computed style. The `computedStyles` dict is returned by the
 * mocked `window.getComputedStyle`.
 */
function createMockElement(
	computedStyles: Record<string, string> = {},
	inlineStyles: Record<string, string> = {},
	children: Element[] = [],
): HTMLElement {
	const styleMap = new Map<string, string>(Object.entries(inlineStyles));

	const style = {
		getPropertyValue: (prop: string) => styleMap.get(prop) ?? '',
		setProperty: (prop: string, value: string) => styleMap.set(prop, value),
	} as unknown as CSSStyleDeclaration;

	const el = {
		style,
		querySelectorAll: (_selector: string) => children,
	} as unknown as HTMLElement;

	// Store computed styles so the mock getComputedStyle can look them up.
	elementComputedStyles.set(el, computedStyles);

	return el;
}

/** Helper to read back what setProperty wrote on a mock element. */
function readInlineStyle(el: HTMLElement, prop: string): string | undefined {
	return el.style.getPropertyValue(prop) || undefined;
}

/** Whether setProperty was ever called for a given property. */
function hasInlineStyle(el: HTMLElement, prop: string): boolean {
	return el.style.getPropertyValue(prop) !== '';
}

/**
 * Installs a mock `window.getComputedStyle` that reads from the
 * `elementComputedStyles` WeakMap. Call within a `beforeEach` that
 * is scoped to DOM-dependent describe blocks.
 */
function installMockGetComputedStyle(): () => void {
	// Provide a minimal global window if not present (Node / non-jsdom).
	if (typeof globalThis.window === 'undefined') {
		(
			globalThis as { window: { getComputedStyle?: typeof globalThis.window.getComputedStyle } }
		).window = {};
	}
	const prev = (
		globalThis as { window: { getComputedStyle?: typeof globalThis.window.getComputedStyle } }
	).window.getComputedStyle;
	(
		globalThis as { window: { getComputedStyle?: typeof globalThis.window.getComputedStyle } }
	).window.getComputedStyle = (el: Element) => {
		const styles = elementComputedStyles.get(el) ?? {};
		return {
			getPropertyValue: (prop: string) => styles[prop] ?? '',
		} as CSSStyleDeclaration;
	};
	return () => {
		if (prev !== undefined) {
			(
				globalThis as { window: { getComputedStyle?: typeof globalThis.window.getComputedStyle } }
			).window.getComputedStyle = prev;
		} else {
			delete (
				globalThis as { window: { getComputedStyle?: typeof globalThis.window.getComputedStyle } }
			).window.getComputedStyle;
		}
	};
}

// ────────────────────────────────────────────────────────────────────
// parseBlurValue
// ────────────────────────────────────────────────────────────────────

describe('parseBlurValue', () => {
	it('extracts pixel value from blur(10px)', () => {
		expect(parseBlurValue('blur(10px)')).toBe(10);
	});

	it('extracts pixel value from blur(5.5px)', () => {
		expect(parseBlurValue('blur(5.5px)')).toBe(5.5);
	});

	it('extracts pixel value from blur( 20px )', () => {
		expect(parseBlurValue('blur( 20px )')).toBe(20);
	});

	it('returns 0 when no blur function is present', () => {
		expect(parseBlurValue('brightness(1.2)')).toBe(0);
	});

	it('returns 0 for empty string', () => {
		expect(parseBlurValue('')).toBe(0);
	});

	it("returns 0 for 'none'", () => {
		expect(parseBlurValue('none')).toBe(0);
	});

	it('extracts blur from combined filter string', () => {
		expect(parseBlurValue('saturate(1.5) blur(8px) brightness(1.1)')).toBe(8);
	});

	it('handles blur(0px)', () => {
		expect(parseBlurValue('blur(0px)')).toBe(0);
	});

	it('is case-insensitive', () => {
		expect(parseBlurValue('BLUR(15px)')).toBe(15);
	});

	it('handles large blur values', () => {
		expect(parseBlurValue('blur(100px)')).toBe(100);
	});

	it('handles blur with decimal precision', () => {
		expect(parseBlurValue('blur(3.14159px)')).toBeCloseTo(3.14159);
	});
});

// ────────────────────────────────────────────────────────────────────
// has3dTransform
// ────────────────────────────────────────────────────────────────────

describe('has3dTransform', () => {
	it('returns false for empty string', () => {
		expect(has3dTransform('')).toBeFalsy();
	});

	it("returns false for 'none'", () => {
		expect(has3dTransform('none')).toBeFalsy();
	});

	it('returns false for 2D transforms', () => {
		expect(has3dTransform('translate(10px, 20px)')).toBeFalsy();
		expect(has3dTransform('rotate(45deg)')).toBeFalsy();
		expect(has3dTransform('scale(2)')).toBeFalsy();
		expect(has3dTransform('matrix(1, 0, 0, 1, 0, 0)')).toBeFalsy();
		expect(has3dTransform('skew(10deg)')).toBeFalsy();
		expect(has3dTransform('translateX(10px)')).toBeFalsy();
		expect(has3dTransform('translateY(20px)')).toBeFalsy();
	});

	it('returns true for translate3d', () => {
		expect(has3dTransform('translate3d(10px, 20px, 30px)')).toBeTruthy();
	});

	it('returns true for translateZ', () => {
		expect(has3dTransform('translateZ(50px)')).toBeTruthy();
	});

	it('returns true for rotateX', () => {
		expect(has3dTransform('rotateX(45deg)')).toBeTruthy();
	});

	it('returns true for rotateY', () => {
		expect(has3dTransform('rotateY(45deg)')).toBeTruthy();
	});

	it('returns true for rotate3d', () => {
		expect(has3dTransform('rotate3d(1, 0, 0, 45deg)')).toBeTruthy();
	});

	it('returns true for scale3d', () => {
		expect(has3dTransform('scale3d(1, 1, 1)')).toBeTruthy();
	});

	it('returns true for scaleZ', () => {
		expect(has3dTransform('scaleZ(2)')).toBeTruthy();
	});

	it('returns true for perspective', () => {
		expect(has3dTransform('perspective(500px)')).toBeTruthy();
	});

	it('returns true for matrix3d', () => {
		expect(has3dTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)')).toBeTruthy();
	});

	it('returns true when 3D transform is mixed with 2D', () => {
		expect(has3dTransform('rotate(45deg) translateZ(10px)')).toBeTruthy();
	});

	it('handles consecutive calls correctly (no stale global state)', () => {
		expect(has3dTransform('translateZ(10px)')).toBeTruthy();
		expect(has3dTransform('translate(10px, 20px)')).toBeFalsy();
		expect(has3dTransform('perspective(100px)')).toBeTruthy();
		expect(has3dTransform('rotate(45deg)')).toBeFalsy();
	});
});

// ────────────────────────────────────────────────────────────────────
// flatten3dTransform
// ────────────────────────────────────────────────────────────────────

describe('flatten3dTransform', () => {
	it('returns empty string unchanged', () => {
		expect(flatten3dTransform('')).toBe('');
	});

	it("returns 'none' unchanged", () => {
		expect(flatten3dTransform('none')).toBe('none');
	});

	it('returns pure 2D transforms unchanged', () => {
		const val = 'translate(10px, 20px) rotate(45deg)';
		expect(flatten3dTransform(val)).toBe(val);
	});

	it('converts translate3d to translate', () => {
		expect(flatten3dTransform('translate3d(10px, 20px, 30px)')).toBe('translate(10px, 20px)');
	});

	it('removes translateZ', () => {
		const result = flatten3dTransform('translateZ(50px)');
		expect(result).toBe('none');
	});

	it('converts scale3d to scale', () => {
		expect(flatten3dTransform('scale3d(2, 3, 1)')).toBe('scale(2, 3)');
	});

	it('removes scaleZ', () => {
		expect(flatten3dTransform('scaleZ(2)')).toBe('none');
	});

	it('removes rotateX', () => {
		expect(flatten3dTransform('rotateX(45deg)')).toBe('none');
	});

	it('removes rotateY', () => {
		expect(flatten3dTransform('rotateY(90deg)')).toBe('none');
	});

	it('removes rotate3d', () => {
		expect(flatten3dTransform('rotate3d(1, 0, 0, 45deg)')).toBe('none');
	});

	it('removes perspective', () => {
		expect(flatten3dTransform('perspective(500px)')).toBe('none');
	});

	it('removes matrix3d', () => {
		expect(flatten3dTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)')).toBe(
			'none',
		);
	});

	it('preserves 2D transforms when removing 3D parts', () => {
		const result = flatten3dTransform('rotate(45deg) translateZ(10px) scale(2)');
		expect(result).toContain('rotate(45deg)');
		expect(result).toContain('scale(2)');
		expect(result).not.toContain('translateZ');
	});

	it('converts translate3d and preserves rotate', () => {
		const result = flatten3dTransform('translate3d(10px, 20px, 0) rotate(90deg)');
		expect(result).toContain('translate(10px, 20px)');
		expect(result).toContain('rotate(90deg)');
	});

	it('handles multiple 3D transforms', () => {
		const result = flatten3dTransform(
			'perspective(500px) translate3d(10px, 20px, 30px) rotateX(45deg)',
		);
		expect(result).toContain('translate(10px, 20px)');
		expect(result).not.toContain('perspective');
		expect(result).not.toContain('rotateX');
	});

	it("returns 'none' when all transforms are 3D-only", () => {
		expect(flatten3dTransform('perspective(500px) rotateX(45deg) translateZ(10px)')).toBe('none');
	});

	it('trims extra whitespace', () => {
		const result = flatten3dTransform('  translate3d(1px, 2px, 3px)  ');
		expect(result).toBe('translate(1px, 2px)');
		expect(result).not.toMatch(/^\s/);
		expect(result).not.toMatch(/\s$/);
	});

	it('handles translate3d with calc values', () => {
		const result = flatten3dTransform('translate3d(calc(50% - 10px), 20px, 0)');
		expect(result).toContain('translate(calc(50% - 10px), 20px)');
	});

	it('handles mixed case function names', () => {
		const result = flatten3dTransform('Translate3d(10px, 20px, 30px)');
		expect(result).toContain('translate(10px, 20px)');
	});

	it('preserves translateX and translateY (2D functions)', () => {
		const val = 'translateX(10px) translateY(20px)';
		expect(flatten3dTransform(val)).toBe(val);
	});

	it('handles consecutive calls without interference from global regex', () => {
		expect(flatten3dTransform('translateZ(10px)')).toBe('none');
		expect(flatten3dTransform('translateZ(20px)')).toBe('none');
		expect(flatten3dTransform('translate(10px, 20px)')).toBe('translate(10px, 20px)');
		expect(flatten3dTransform('translate3d(1px, 2px, 3px)')).toBe('translate(1px, 2px)');
	});
});

// ────────────────────────────────────────────────────────────────────
// CssPreprocessingOptions type
// ────────────────────────────────────────────────────────────────────

describe('cssPreprocessingOptions', () => {
	it('all options are optional', () => {
		const opts: CssPreprocessingOptions = {};
		expect(opts.resolveCustomProperties).toBeUndefined();
		expect(opts.flattenBackdropFilter).toBeUndefined();
		expect(opts.flattenMixBlendMode).toBeUndefined();
		expect(opts.flatten3dTransforms).toBeUndefined();
		expect(opts.removeUnsupportedFeatures).toBeUndefined();
	});

	it('accepts all boolean options', () => {
		const opts: CssPreprocessingOptions = {
			resolveCustomProperties: true,
			flattenBackdropFilter: false,
			flattenMixBlendMode: true,
			flatten3dTransforms: false,
			removeUnsupportedFeatures: true,
		};
		expect(opts.resolveCustomProperties).toBeTruthy();
		expect(opts.flattenBackdropFilter).toBeFalsy();
		expect(opts.flattenMixBlendMode).toBeTruthy();
		expect(opts.flatten3dTransforms).toBeFalsy();
		expect(opts.removeUnsupportedFeatures).toBeTruthy();
	});
});

// ────────────────────────────────────────────────────────────────────
// Module exports
// ────────────────────────────────────────────────────────────────────

describe('module exports', () => {
	it('exports preprocessCssForCapture function', async () => {
		const mod = await import('./css-preprocessing');
		expectTypeOf(mod.preprocessCssForCapture).toBeFunction();
	});

	it('exports resolveCustomProperties function', async () => {
		const mod = await import('./css-preprocessing');
		expectTypeOf(mod.resolveCustomProperties).toBeFunction();
	});

	it('exports flattenBackdropFilter function', async () => {
		const mod = await import('./css-preprocessing');
		expectTypeOf(mod.flattenBackdropFilter).toBeFunction();
	});

	it('exports flattenMixBlendMode function', async () => {
		const mod = await import('./css-preprocessing');
		expectTypeOf(mod.flattenMixBlendMode).toBeFunction();
	});

	it('exports flatten3dTransforms function', async () => {
		const mod = await import('./css-preprocessing');
		expectTypeOf(mod.flatten3dTransforms).toBeFunction();
	});

	it('exports removeUnsupportedFeatures function', async () => {
		const mod = await import('./css-preprocessing');
		expectTypeOf(mod.removeUnsupportedFeatures).toBeFunction();
	});
});

// ────────────────────────────────────────────────────────────────────
// resolveCustomProperties (DOM-dependent)
// ────────────────────────────────────────────────────────────────────

describe('resolveCustomProperties', () => {
	let restoreGCS: () => void;
	beforeEach(() => {
		restoreGCS = installMockGetComputedStyle();
	});
	afterEach(() => {
		restoreGCS();
	});

	it('resolves inline var() references to their computed values', () => {
		const child = createMockElement({ color: 'rgb(255, 0, 0)' }, { color: 'var(--text-color)' });
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		expect(readInlineStyle(child, 'color')).toBe('rgb(255, 0, 0)');
	});

	it('does not modify inline values that do not contain var()', () => {
		const child = createMockElement({ color: 'rgb(0, 0, 255)' }, { color: 'blue' });
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		expect(readInlineStyle(child, 'color')).toBe('blue');
	});

	it('processes the root element itself', () => {
		const root = createMockElement(
			{ 'background-color': 'rgb(0, 128, 0)' },
			{ 'background-color': 'var(--bg)' },
		);

		resolveCustomProperties(root);

		expect(readInlineStyle(root, 'background-color')).toBe('rgb(0, 128, 0)');
	});

	it('does not overwrite when computed value is empty', () => {
		const child = createMockElement(
			{}, // no computed value for "color"
			{ color: 'var(--missing)' },
		);
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		// Should remain unchanged because getPropertyValue returns ""
		expect(readInlineStyle(child, 'color')).toBe('var(--missing)');
	});

	it('resolves multiple var()-containing properties on one element', () => {
		const child = createMockElement(
			{ color: 'red', 'font-size': '16px', opacity: '0.8' },
			{ color: 'var(--c)', 'font-size': 'var(--fs)', opacity: 'var(--op)' },
		);
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		expect(readInlineStyle(child, 'color')).toBe('red');
		expect(readInlineStyle(child, 'font-size')).toBe('16px');
		expect(readInlineStyle(child, 'opacity')).toBe('0.8');
	});

	it('resolves var() in nested var() expressions', () => {
		const child = createMockElement(
			{ 'box-shadow': '0 2px 4px rgba(0,0,0,0.3)' },
			{ 'box-shadow': 'var(--shadow, var(--fallback-shadow))' },
		);
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		expect(readInlineStyle(child, 'box-shadow')).toBe('0 2px 4px rgba(0,0,0,0.3)');
	});

	it('handles multiple children', () => {
		const child1 = createMockElement({ color: 'red' }, { color: 'var(--a)' });
		const child2 = createMockElement({ color: 'blue' }, { color: 'var(--b)' });
		const root = createMockElement({}, {}, [child1, child2]);

		resolveCustomProperties(root);

		expect(readInlineStyle(child1, 'color')).toBe('red');
		expect(readInlineStyle(child2, 'color')).toBe('blue');
	});

	it('does not touch properties not in VAR_DEPENDENT_PROPERTIES list', () => {
		// "display" is not in the list, so even if it has var() it should
		// not be resolved (the function only iterates over a fixed set).
		const child = createMockElement({ display: 'flex' }, { display: 'var(--d)' });
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		// "display" is not in the iterated list, so it stays as-is
		expect(readInlineStyle(child, 'display')).toBe('var(--d)');
	});

	it('handles elements with no inline style containing var()', () => {
		const child = createMockElement({ color: 'red' }, {});
		const root = createMockElement({}, {}, [child]);

		resolveCustomProperties(root);

		// Nothing should be set because there was no var() in inline styles
		expect(hasInlineStyle(child, 'color')).toBeFalsy();
	});
});

// ────────────────────────────────────────────────────────────────────
// flattenBackdropFilter (DOM-dependent)
// ────────────────────────────────────────────────────────────────────

describe('flattenBackdropFilter', () => {
	let restoreGCS: () => void;
	beforeEach(() => {
		restoreGCS = installMockGetComputedStyle();
	});
	afterEach(() => {
		restoreGCS();
	});

	it('sets backdrop-filter and -webkit-backdrop-filter to none', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(10px)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
		expect(readInlineStyle(child, '-webkit-backdrop-filter')).toBe('none');
	});

	it('adds semi-transparent white background when blur is present and bg is transparent', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(10px)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		const bg = readInlineStyle(child, 'background-color')!;
		expect(bg).toMatch(/^rgba\(255,\s*255,\s*255,/);
	});

	it('adds background when bg is rgba(0, 0, 0, 0)', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(5px)',
			'background-color': 'rgba(0, 0, 0, 0)',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child, 'background-color')).toMatch(/^rgba\(255/);
	});

	it('does not overwrite existing non-transparent background', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(10px)',
			'background-color': 'rgb(128, 128, 128)',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
		// background-color should not have been replaced
		expect(hasInlineStyle(child, 'background-color')).toBeFalsy();
	});

	it('skips elements with backdrop-filter: none', () => {
		const child = createMockElement({ 'backdrop-filter': 'none' });
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(hasInlineStyle(child, 'backdrop-filter')).toBeFalsy();
	});

	it('skips elements with no backdrop-filter', () => {
		const child = createMockElement({});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(hasInlineStyle(child, 'backdrop-filter')).toBeFalsy();
	});

	it('handles non-blur backdrop-filter (e.g. brightness) without adding background', () => {
		const child = createMockElement({
			'backdrop-filter': 'brightness(0.8)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
		// blur is 0, so no background should be added
		expect(hasInlineStyle(child, 'background-color')).toBeFalsy();
	});

	it('calculates opacity proportional to blur size, capped at 0.85', () => {
		// Small blur
		const small = createMockElement({
			'backdrop-filter': 'blur(1px)',
			'background-color': 'transparent',
		});
		const rootSmall = createMockElement({}, {}, [small]);
		flattenBackdropFilter(rootSmall);

		// Large blur
		const large = createMockElement({
			'backdrop-filter': 'blur(50px)',
			'background-color': 'transparent',
		});
		const rootLarge = createMockElement({}, {}, [large]);
		flattenBackdropFilter(rootLarge);

		const extractOpacity = (bg: string) => parseFloat(bg.match(/,\s*([\d.]+)\)$/)![1]);

		const smallOp = extractOpacity(readInlineStyle(small, 'background-color')!);
		const largeOp = extractOpacity(readInlineStyle(large, 'background-color')!);

		expect(largeOp).toBeGreaterThan(smallOp);
		expect(largeOp).toBeLessThanOrEqual(0.85);
	});

	it('uses -webkit-backdrop-filter when backdrop-filter is absent', () => {
		const child = createMockElement({
			'-webkit-backdrop-filter': 'blur(8px)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child, '-webkit-backdrop-filter')).toBe('none');
		expect(readInlineStyle(child, 'background-color')).toMatch(/^rgba\(255/);
	});

	it('processes the root element', () => {
		const root = createMockElement({
			'backdrop-filter': 'blur(6px)',
			'background-color': 'transparent',
		});

		flattenBackdropFilter(root);

		expect(readInlineStyle(root, 'backdrop-filter')).toBe('none');
		expect(readInlineStyle(root, 'background-color')).toMatch(/^rgba\(255/);
	});

	it('processes multiple children', () => {
		const child1 = createMockElement({
			'backdrop-filter': 'blur(5px)',
			'background-color': 'transparent',
		});
		const child2 = createMockElement({
			'backdrop-filter': 'blur(15px)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child1, child2]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child1, 'backdrop-filter')).toBe('none');
		expect(readInlineStyle(child2, 'backdrop-filter')).toBe('none');
		expect(readInlineStyle(child1, 'background-color')).toMatch(/^rgba/);
		expect(readInlineStyle(child2, 'background-color')).toMatch(/^rgba/);
	});

	it('handles blur(0px) without adding background', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(0px)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child]);

		flattenBackdropFilter(root);

		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
		// blur is 0, so no background
		expect(hasInlineStyle(child, 'background-color')).toBeFalsy();
	});
});

// ────────────────────────────────────────────────────────────────────
// flattenMixBlendMode (DOM-dependent)
// ────────────────────────────────────────────────────────────────────

describe('flattenMixBlendMode', () => {
	let restoreGCS: () => void;
	beforeEach(() => {
		restoreGCS = installMockGetComputedStyle();
	});
	afterEach(() => {
		restoreGCS();
	});

	it('skips elements with mix-blend-mode: normal', () => {
		const child = createMockElement({ 'mix-blend-mode': 'normal', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(hasInlineStyle(child, 'mix-blend-mode')).toBeFalsy();
	});

	it('skips elements with no mix-blend-mode', () => {
		const child = createMockElement({});
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(hasInlineStyle(child, 'mix-blend-mode')).toBeFalsy();
	});

	it('resets blend mode to normal and applies opacity for multiply', () => {
		const child = createMockElement({ 'mix-blend-mode': 'multiply', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(readInlineStyle(child, 'mix-blend-mode')).toBe('normal');
		expect(readInlineStyle(child, 'opacity')).toBe('0.85');
	});

	it('applies correct opacity for screen (0.9)', () => {
		const child = createMockElement({ 'mix-blend-mode': 'screen', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(readInlineStyle(child, 'opacity')).toBe('0.90');
	});

	it('applies correct opacity for difference (0.7)', () => {
		const child = createMockElement({ 'mix-blend-mode': 'difference', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(readInlineStyle(child, 'opacity')).toBe('0.70');
	});

	it('applies correct opacity for exclusion (0.75)', () => {
		const child = createMockElement({ 'mix-blend-mode': 'exclusion', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(readInlineStyle(child, 'opacity')).toBe('0.75');
	});

	it('applies correct opacity for overlay (0.8)', () => {
		const child = createMockElement({ 'mix-blend-mode': 'overlay', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(readInlineStyle(child, 'opacity')).toBe('0.80');
	});

	it('combines existing opacity with blend mode opacity', () => {
		const child = createMockElement({ 'mix-blend-mode': 'multiply', opacity: '0.5' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		// 0.5 * 0.85 = 0.425 -> toFixed(2) = "0.42" (rounds half-to-even)
		expect(readInlineStyle(child, 'opacity')).toBe('0.42');
	});

	it('does not set opacity when combined result is 1.0 (unknown blend mode)', () => {
		const child = createMockElement({ 'mix-blend-mode': 'unknown-mode', opacity: '1' });
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		expect(readInlineStyle(child, 'mix-blend-mode')).toBe('normal');
		// unknown maps to 1 via ??, 1 * 1 = 1, not < 1, so opacity not set
		expect(hasInlineStyle(child, 'opacity')).toBeFalsy();
	});

	it('handles all known blend modes', () => {
		const blendModes = [
			'multiply',
			'screen',
			'overlay',
			'darken',
			'lighten',
			'color-dodge',
			'color-burn',
			'hard-light',
			'soft-light',
			'difference',
			'exclusion',
			'hue',
			'saturation',
			'color',
			'luminosity',
		];

		for (const mode of blendModes) {
			const child = createMockElement({ 'mix-blend-mode': mode, opacity: '1' });
			const root = createMockElement({}, {}, [child]);

			flattenMixBlendMode(root);

			expect(readInlineStyle(child, 'mix-blend-mode')).toBe('normal');
			const opacityVal = parseFloat(readInlineStyle(child, 'opacity')!);
			expect(opacityVal).toBeLessThan(1);
			expect(opacityVal).toBeGreaterThan(0);
		}
	});

	it('processes the root element', () => {
		const root = createMockElement({ 'mix-blend-mode': 'overlay', opacity: '1' });

		flattenMixBlendMode(root);

		expect(readInlineStyle(root, 'mix-blend-mode')).toBe('normal');
		expect(readInlineStyle(root, 'opacity')).toBe('0.80');
	});

	it("handles missing opacity in computed style (defaults to '1')", () => {
		const child = createMockElement(
			{ 'mix-blend-mode': 'multiply' },
			// no opacity in computed styles at all
		);
		const root = createMockElement({}, {}, [child]);

		flattenMixBlendMode(root);

		// parseFloat("" || "1") = 1, 1 * 0.85 = 0.85
		expect(readInlineStyle(child, 'opacity')).toBe('0.85');
	});
});

// ────────────────────────────────────────────────────────────────────
// flatten3dTransforms (DOM walker)
// ────────────────────────────────────────────────────────────────────

describe('flatten3dTransforms', () => {
	let restoreGCS: () => void;
	beforeEach(() => {
		restoreGCS = installMockGetComputedStyle();
	});
	afterEach(() => {
		restoreGCS();
	});

	it('flattens 3D transforms on child elements', () => {
		const child = createMockElement({ transform: 'translate3d(10px, 20px, 30px)' });
		const root = createMockElement({ transform: 'none' }, {}, [child]);

		flatten3dTransforms(root);

		expect(readInlineStyle(child, 'transform')).toBe('translate(10px, 20px)');
	});

	it('leaves 2D-only transforms untouched', () => {
		const child = createMockElement({ transform: 'rotate(45deg) scale(2)' });
		const root = createMockElement({}, {}, [child]);

		flatten3dTransforms(root);

		// 2D-only, no 3D match, so setProperty should not be called
		expect(hasInlineStyle(child, 'transform')).toBeFalsy();
	});

	it('skips elements with transform: none', () => {
		const child = createMockElement({ transform: 'none' });
		const root = createMockElement({}, {}, [child]);

		flatten3dTransforms(root);

		expect(hasInlineStyle(child, 'transform')).toBeFalsy();
	});

	it('skips elements with no transform', () => {
		const child = createMockElement({});
		const root = createMockElement({}, {}, [child]);

		flatten3dTransforms(root);

		expect(hasInlineStyle(child, 'transform')).toBeFalsy();
	});

	it('processes the root element', () => {
		const root = createMockElement({ transform: 'perspective(500px) rotate(30deg)' });

		flatten3dTransforms(root);

		const t = readInlineStyle(root, 'transform')!;
		expect(t).toContain('rotate(30deg)');
		expect(t).not.toContain('perspective');
	});

	it('handles mixed 2D and 3D on multiple children', () => {
		const child1 = createMockElement({ transform: 'translateZ(10px) scale(2)' });
		const child2 = createMockElement({ transform: 'rotate(45deg)' });
		const root = createMockElement({}, {}, [child1, child2]);

		flatten3dTransforms(root);

		const t1 = readInlineStyle(child1, 'transform')!;
		expect(t1).toContain('scale(2)');
		expect(t1).not.toContain('translateZ');

		// child2 has only 2D, should be untouched
		expect(hasInlineStyle(child2, 'transform')).toBeFalsy();
	});
});

// ────────────────────────────────────────────────────────────────────
// removeUnsupportedFeatures (DOM-dependent)
// ────────────────────────────────────────────────────────────────────

describe('removeUnsupportedFeatures', () => {
	let restoreGCS: () => void;
	beforeEach(() => {
		restoreGCS = installMockGetComputedStyle();
	});
	afterEach(() => {
		restoreGCS();
	});

	it('removes mask-image with url() that is not a data: URI', () => {
		const child = createMockElement({ 'mask-image': 'url(/path/to/mask.svg)' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(readInlineStyle(child, 'mask-image')).toBe('none');
		expect(readInlineStyle(child, '-webkit-mask-image')).toBe('none');
	});

	it('keeps mask-image with data: URI', () => {
		const child = createMockElement({ 'mask-image': 'url(data:image/svg+xml,...)' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		// Should not set mask-image to "none"
		expect(hasInlineStyle(child, 'mask-image')).toBeFalsy();
	});

	it('keeps mask-image: none (no processing needed)', () => {
		const child = createMockElement({ 'mask-image': 'none' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(hasInlineStyle(child, 'mask-image')).toBeFalsy();
	});

	it('keeps simple gradient masks (no url())', () => {
		const child = createMockElement({
			'mask-image': 'linear-gradient(to right, transparent, black)',
		});
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(hasInlineStyle(child, 'mask-image')).toBeFalsy();
	});

	it('removes mask-image via -webkit-mask-image fallback', () => {
		const child = createMockElement({ '-webkit-mask-image': 'url(/external-mask.svg)' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(readInlineStyle(child, 'mask-image')).toBe('none');
		expect(readInlineStyle(child, '-webkit-mask-image')).toBe('none');
	});

	it('converts -webkit-text-stroke to text-shadow approximation', () => {
		const child = createMockElement({ '-webkit-text-stroke': '2px red', 'text-shadow': 'none' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(readInlineStyle(child, '-webkit-text-stroke')).toBe('0');
		const shadow = readInlineStyle(child, 'text-shadow')!;
		expect(shadow).toContain('red');
		expect(shadow).toContain('2px 0px 0 red');
		expect(shadow).toContain('-2px 0px 0 red');
		expect(shadow).toContain('0px 2px 0 red');
		expect(shadow).toContain('0px -2px 0 red');
	});

	it('generates four directional shadows for text-stroke', () => {
		const child = createMockElement({ '-webkit-text-stroke': '1px black', 'text-shadow': 'none' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		const shadow = readInlineStyle(child, 'text-shadow')!;
		const parts = shadow.split(',').map((s) => s.trim());
		expect(parts).toHaveLength(4);
	});

	it('appends to existing text-shadow when converting text-stroke', () => {
		const child = createMockElement({
			'-webkit-text-stroke': '1px blue',
			'text-shadow': '1px 1px 2px black',
		});
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		const shadow = readInlineStyle(child, 'text-shadow')!;
		// Should have both the existing shadow and the new ones
		expect(shadow).toContain('1px 1px 2px black');
		expect(shadow).toContain('blue');
	});

	it('skips text-stroke of 0px', () => {
		const child = createMockElement({ '-webkit-text-stroke': '0px' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(hasInlineStyle(child, '-webkit-text-stroke')).toBeFalsy();
		expect(hasInlineStyle(child, 'text-shadow')).toBeFalsy();
	});

	it("skips text-stroke of '0px rgb(0, 0, 0)'", () => {
		const child = createMockElement({ '-webkit-text-stroke': '0px rgb(0, 0, 0)' });
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		expect(hasInlineStyle(child, '-webkit-text-stroke')).toBeFalsy();
	});

	it('handles decimal text-stroke widths', () => {
		const child = createMockElement({
			'-webkit-text-stroke': '0.5px green',
			'text-shadow': 'none',
		});
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		const shadow = readInlineStyle(child, 'text-shadow')!;
		expect(shadow).toContain('0.5px 0px 0 green');
		expect(shadow).toContain('-0.5px 0px 0 green');
	});

	it('processes the root element', () => {
		const root = createMockElement({ 'mask-image': 'url(/external.svg)' });

		removeUnsupportedFeatures(root);

		expect(readInlineStyle(root, 'mask-image')).toBe('none');
	});

	it('handles element with no unsupported features', () => {
		const child = createMockElement({});
		const root = createMockElement({}, {}, [child]);

		removeUnsupportedFeatures(root);

		// Nothing should have been set
		expect(hasInlineStyle(child, 'mask-image')).toBeFalsy();
		expect(hasInlineStyle(child, '-webkit-text-stroke')).toBeFalsy();
		expect(hasInlineStyle(child, 'text-shadow')).toBeFalsy();
	});
});

// ────────────────────────────────────────────────────────────────────
// preprocessCssForCapture (combined orchestrator)
// ────────────────────────────────────────────────────────────────────

describe('preprocessCssForCapture', () => {
	let restoreGCS: () => void;
	beforeEach(() => {
		restoreGCS = installMockGetComputedStyle();
	});
	afterEach(() => {
		restoreGCS();
	});

	it('applies all preprocessing steps by default', () => {
		const child = createMockElement(
			{
				color: 'rgb(0, 0, 0)',
				'backdrop-filter': 'blur(5px)',
				'background-color': 'transparent',
				'mix-blend-mode': 'multiply',
				opacity: '1',
				transform: 'translateZ(10px)',
				'mask-image': 'url(/mask.svg)',
			},
			{ color: 'var(--text)' },
		);
		const root = createMockElement({}, {}, [child]);

		preprocessCssForCapture(root);

		// var() resolved
		expect(readInlineStyle(child, 'color')).toBe('rgb(0, 0, 0)');
		// backdrop-filter flattened
		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
		// blend mode flattened
		expect(readInlineStyle(child, 'mix-blend-mode')).toBe('normal');
		// 3D transform flattened
		expect(readInlineStyle(child, 'transform')).toBe('none');
		// mask removed
		expect(readInlineStyle(child, 'mask-image')).toBe('none');
	});

	it('skips all steps when all options are false', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(5px)',
			'background-color': 'transparent',
			'mix-blend-mode': 'multiply',
			opacity: '1',
			transform: 'translateZ(10px)',
		});
		const root = createMockElement({}, {}, [child]);

		preprocessCssForCapture(root, {
			resolveCustomProperties: false,
			flattenBackdropFilter: false,
			flattenMixBlendMode: false,
			flatten3dTransforms: false,
			removeUnsupportedFeatures: false,
		});

		// Nothing should have been modified
		expect(hasInlineStyle(child, 'backdrop-filter')).toBeFalsy();
		expect(hasInlineStyle(child, 'mix-blend-mode')).toBeFalsy();
		expect(hasInlineStyle(child, 'transform')).toBeFalsy();
	});

	it('selectively applies only enabled steps', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(5px)',
			'background-color': 'transparent',
			'mix-blend-mode': 'multiply',
			opacity: '1',
			transform: 'translateZ(10px)',
		});
		const root = createMockElement({}, {}, [child]);

		preprocessCssForCapture(root, {
			resolveCustomProperties: false,
			flattenBackdropFilter: true,
			flattenMixBlendMode: false,
			flatten3dTransforms: false,
			removeUnsupportedFeatures: false,
		});

		// backdrop filter should be processed
		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
		// mix-blend-mode should NOT be processed
		expect(hasInlineStyle(child, 'mix-blend-mode')).toBeFalsy();
		// transform should NOT be processed
		expect(hasInlineStyle(child, 'transform')).toBeFalsy();
	});

	it('applies only flatten3dTransforms when specified', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(5px)',
			'background-color': 'transparent',
			transform: 'translate3d(1px, 2px, 3px)',
		});
		const root = createMockElement({}, {}, [child]);

		preprocessCssForCapture(root, {
			resolveCustomProperties: false,
			flattenBackdropFilter: false,
			flattenMixBlendMode: false,
			flatten3dTransforms: true,
			removeUnsupportedFeatures: false,
		});

		expect(readInlineStyle(child, 'transform')).toBe('translate(1px, 2px)');
		// backdrop should be untouched
		expect(hasInlineStyle(child, 'backdrop-filter')).toBeFalsy();
	});

	it('applies only removeUnsupportedFeatures when specified', () => {
		const child = createMockElement({
			'mask-image': 'url(/external.svg)',
			'mix-blend-mode': 'multiply',
			opacity: '1',
		});
		const root = createMockElement({}, {}, [child]);

		preprocessCssForCapture(root, {
			resolveCustomProperties: false,
			flattenBackdropFilter: false,
			flattenMixBlendMode: false,
			flatten3dTransforms: false,
			removeUnsupportedFeatures: true,
		});

		expect(readInlineStyle(child, 'mask-image')).toBe('none');
		// blend mode should not be touched
		expect(hasInlineStyle(child, 'mix-blend-mode')).toBeFalsy();
	});

	it('uses default options (all true) when empty options object is given', () => {
		const child = createMockElement({
			'backdrop-filter': 'blur(5px)',
			'background-color': 'transparent',
		});
		const root = createMockElement({}, {}, [child]);

		preprocessCssForCapture(root, {});

		expect(readInlineStyle(child, 'backdrop-filter')).toBe('none');
	});
});
