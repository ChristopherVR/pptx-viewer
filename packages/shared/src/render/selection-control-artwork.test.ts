import { describe, expect, it } from 'vitest';

import { defaultCssVars, themeToCssVars } from '../theme';
import {
	getSelectionControlArtworkStyle,
	getSelectionOutlineColor,
	SELECTION_CONTROL_CSS_VARS,
} from './selection-control-artwork';
import type { SelectionControlArtworkDefaults } from './selection-control-artwork';

const defaults: SelectionControlArtworkDefaults = {
	width: 12,
	height: 12,
	radius: '9999px',
	fill: 'var(--color-primary)',
	borderColor: '#fff',
	foreground: '#fff',
};

describe('selection-control artwork', () => {
	it('defines only the eleven opt-in artwork and outline tokens', () => {
		expect(Object.values(SELECTION_CONTROL_CSS_VARS)).toStrictEqual([
			'--pptx-selection-corner-size',
			'--pptx-selection-corner-radius',
			'--pptx-selection-edge-length',
			'--pptx-selection-edge-thickness',
			'--pptx-selection-edge-radius',
			'--pptx-selection-handle-fill',
			'--pptx-selection-handle-border-color',
			'--pptx-selection-outline-color',
			'--pptx-selection-rotate-size',
			'--pptx-selection-rotate-fill',
			'--pptx-selection-rotate-foreground',
		]);
	});

	it('centers noninteractive corner artwork without overriding shadow or border width', () => {
		const style = getSelectionControlArtworkStyle('corner', defaults);
		expect(style.artwork).toStrictEqual({
			position: 'absolute',
			left: '50%',
			top: '50%',
			transform: 'translate(-50%, -50%)',
			pointerEvents: 'none',
			width: 'var(--pptx-selection-corner-size, 12px)',
			height: 'var(--pptx-selection-corner-size, 12px)',
			borderRadius: 'var(--pptx-selection-corner-radius, 9999px)',
			background: 'var(--pptx-selection-handle-fill, var(--color-primary))',
			borderColor: 'var(--pptx-selection-handle-border-color, #fff)',
		});
		expect(style.frame).toStrictEqual({
			width: 'max(12px, var(--pptx-selection-corner-size, 12px))',
			height: 'max(12px, var(--pptx-selection-corner-size, 12px))',
		});
	});

	it('swaps edge length and thickness by orientation without changing corner tokens', () => {
		const horizontal = getSelectionControlArtworkStyle('horizontal-edge', {
			...defaults,
			width: 20,
			height: 8,
			radius: '2px',
		});
		const vertical = getSelectionControlArtworkStyle('vertical-edge', {
			...defaults,
			width: 8,
			height: 20,
			radius: '2px',
		});
		expect(horizontal.artwork.width).toBe('var(--pptx-selection-edge-length, 20px)');
		expect(horizontal.artwork.height).toBe('var(--pptx-selection-edge-thickness, 8px)');
		expect(vertical.artwork.width).toBe(horizontal.artwork.height);
		expect(vertical.artwork.height).toBe(horizontal.artwork.width);
		expect(horizontal.artwork.borderRadius).toBe('var(--pptx-selection-edge-radius, 2px)');
	});

	it('preserves Rotate radius and gives a glyph independent fill and foreground colors', () => {
		const style = getSelectionControlArtworkStyle('rotate', { ...defaults, radius: '50%' });
		expect(style.artwork.borderRadius).toBe('50%');
		expect(style.artwork.width).toBe('var(--pptx-selection-rotate-size, 12px)');
		expect(style.artwork.background).toBe(
			'var(--pptx-selection-rotate-fill, var(--color-primary))',
		);
		expect(style.artwork.color).toBe('var(--pptx-selection-rotate-foreground, #fff)');
	});

	it.each([20, 28, 12, 24])(
		'retains a binding Rotate diameter of %spx without an override',
		(size) => {
			const style = getSelectionControlArtworkStyle('rotate', {
				...defaults,
				width: size,
				height: size,
			});
			expect(style.artwork.width).toBe(`var(--pptx-selection-rotate-size, ${size}px)`);
			expect(style.artwork.height).toBe(style.artwork.width);
			expect(style.frame.width).toBe(
				`max(${size}px, var(--pptx-selection-rotate-size, ${size}px))`,
			);
		},
	);

	it('does not reinterpret existing local radii as screen-sized geometry', () => {
		const style = getSelectionControlArtworkStyle('corner', { ...defaults, radius: '2px' }, 2);
		expect(style.artwork.borderRadius).toBe('var(--pptx-selection-corner-radius, 2px)');
	});

	it.each([
		['React fine corner', 12, '9999px', 'var(--color-primary)', '#fff'],
		['React narrow viewport corner', 22, '9999px', 'var(--color-primary)', '#fff'],
		['Vue fine', 10, '9999px', 'var(--pptx-vue-selection-color, #3b82f6)', '#ffffff'],
		['Vue coarse', 22, '9999px', 'var(--pptx-vue-selection-color, #3b82f6)', '#ffffff'],
		['Svelte fine', 10, '2px', 'var(--pptx-background, #ffffff)', 'var(--pptx-ring, #6366f1)'],
		['Svelte coarse', 22, '2px', 'var(--pptx-background, #ffffff)', 'var(--pptx-ring, #6366f1)'],
		['Vanilla fine', 10, '2px', '#fff', 'var(--pptx-ring)'],
		['Vanilla coarse', 22, '2px', '#fff', 'var(--pptx-ring)'],
		['Angular', 24, '2px', '#ffffff', '#4f86ff'],
	] as const)('keeps %s defaults local', (_name, size, radius, fill, borderColor) => {
		const style = getSelectionControlArtworkStyle('corner', {
			width: size,
			height: size,
			radius,
			fill,
			borderColor,
		});
		expect(style.artwork.width).toBe(`var(--pptx-selection-corner-size, ${size}px)`);
		expect(style.frame.width).toBe(`max(${size}px, var(--pptx-selection-corner-size, ${size}px))`);
		expect(style.artwork.borderRadius).toBe(`var(--pptx-selection-corner-radius, ${radius})`);
		expect(style.artwork.background).toBe(`var(--pptx-selection-handle-fill, ${fill})`);
		expect(style.artwork.borderColor).toBe(
			`var(--pptx-selection-handle-border-color, ${borderColor})`,
		);
	});

	it.each([0.5, 1, 2])(
		'uses coordinate multiplier %s for both artwork and frame, not the anchor',
		(scale) => {
			const style = getSelectionControlArtworkStyle('corner', defaults, scale);
			const value = 'var(--pptx-selection-corner-size, 12px)';
			expect(style.artwork.width).toBe(scale === 1 ? value : `calc(${value} * ${scale})`);
			expect(style.frame.width).toBe(
				scale === 1 ? `max(12px, ${value})` : `calc(max(12px, ${value}) * ${scale})`,
			);
			expect(style.artwork.left).toBe('50%');
		},
	);

	it('accepts binding-owned responsive fallbacks without freezing them in JavaScript', () => {
		const value = 'var(--local-corner-size, 12px)';
		const style = getSelectionControlArtworkStyle('corner', {
			...defaults,
			width: value,
			height: value,
		});
		expect(style.artwork.width).toBe(`var(--pptx-selection-corner-size, ${value})`);
		expect(style.frame.width).toBe(`max(${value}, var(--pptx-selection-corner-size, ${value}))`);
	});

	it('shares the outline token with stems without replacing legacy fallbacks', () => {
		expect(getSelectionOutlineColor('var(--pptx-ring)')).toBe(
			'var(--pptx-selection-outline-color, var(--pptx-ring))',
		);
	});

	it('leaves existing theme passthrough unchanged and never emits selection defaults', () => {
		const cssVars = {
			'--pptx-selection-corner-size': '6px',
			'--pptx-selection-handle-fill': '#fff',
		};
		expect(themeToCssVars({ cssVars })).toStrictEqual(cssVars);
		expect(themeToCssVars(undefined)).toStrictEqual({});
		for (const token of Object.values(SELECTION_CONTROL_CSS_VARS)) {
			expect(defaultCssVars()).not.toHaveProperty(token);
		}
	});
});
