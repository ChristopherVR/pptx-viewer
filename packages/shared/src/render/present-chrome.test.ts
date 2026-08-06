import { describe, expect, it } from 'vitest';

import { translationsEn } from '../i18n/translations-en';
import {
	PRESENT_TOOLBAR_CLASSES,
	PRESENT_TOOLBAR_CONTROLS,
	PRESENT_TOOLBAR_LABEL_KEYS,
	PRESENT_TOOLBAR_METRICS,
	PRESENT_TOOLBAR_ORDER,
	presentToolbarCssVars,
	presentToolbarStyleAttr,
} from './present-chrome';

/**
 * The show chrome is pinned twice: as Tailwind utilities for React/Vue/Angular
 * and as plain numbers for Vanilla/Svelte. That is only safe while the two say
 * the same thing, so these tests read the numbers back out of the class
 * strings, exactly as `chrome-metrics.test.ts` does for the title bar.
 */

/** Tailwind spacing units are 0.25rem; the viewer's root font size is 16px. */
const SPACING = 16 / 4;

/** The numeric part of a Tailwind spacing utility, e.g. `h-9` -> 36. */
function spacing(classes: string, prefix: string): number {
	const match = new RegExp(`(?:^| )-?${prefix}-(?<value>[0-9.]+)(?: |$)`, 'u').exec(classes);
	if (!match?.groups) {
		throw new Error(`no "${prefix}-<n>" utility in "${classes}"`);
	}
	return Number(match.groups.value) * SPACING;
}

describe('the show-toolbar inventory', () => {
	it('lists PowerPoint-order navigation, timing, pointer tools, then the exits', () => {
		expect([...PRESENT_TOOLBAR_ORDER]).toStrictEqual([
			'previous',
			'counter',
			'next',
			'divider-navigation',
			'timer',
			'divider-timer',
			'laser',
			'pen',
			'pen-color',
			'highlighter',
			'highlighter-color',
			'eraser',
			'blackboard',
			'clear',
			'divider-tools',
			'presenter-view',
			'end',
		]);
	});

	it('names every control from a key the dictionary actually defines', () => {
		const missing = PRESENT_TOOLBAR_LABEL_KEYS.filter((key) => !(key in translationsEn));
		expect(missing).toStrictEqual([]);
	});

	it('leaves only the dividers and the counter unnamed', () => {
		const unnamed = PRESENT_TOOLBAR_CONTROLS.filter((control) => !control.labelKey).map(
			(control) => control.id,
		);
		expect(unnamed).toStrictEqual([
			'counter',
			'divider-navigation',
			'divider-timer',
			'divider-tools',
		]);
	});

	it('keeps each colour caret directly after the tool it recolours', () => {
		const ids = [...PRESENT_TOOLBAR_ORDER];
		expect(ids[ids.indexOf('pen-color') - 1]).toBe('pen');
		expect(ids[ids.indexOf('highlighter-color') - 1]).toBe('highlighter');
	});

	it('gives every non-divider control an icon or a text readout', () => {
		const iconless = PRESENT_TOOLBAR_CONTROLS.filter(
			(control) => control.kind !== 'divider' && control.kind !== 'counter' && !control.icon,
		);
		expect(iconless).toStrictEqual([]);
	});
});

describe('the show-toolbar metrics agree with the Tailwind class tokens', () => {
	it('sizes the bar the same way', () => {
		expect(spacing(PRESENT_TOOLBAR_CLASSES.container, 'gap')).toBe(PRESENT_TOOLBAR_METRICS.gap);
		expect(spacing(PRESENT_TOOLBAR_CLASSES.container, 'px')).toBe(PRESENT_TOOLBAR_METRICS.paddingX);
		expect(spacing(PRESENT_TOOLBAR_CLASSES.container, 'py')).toBe(PRESENT_TOOLBAR_METRICS.paddingY);
		expect(PRESENT_TOOLBAR_CLASSES.container).toContain('rounded-xl');
	});

	it('sizes buttons, toggles and carets the same way', () => {
		for (const token of [
			PRESENT_TOOLBAR_CLASSES.button,
			PRESENT_TOOLBAR_CLASSES.toggle,
			PRESENT_TOOLBAR_CLASSES.toggleActive,
		]) {
			expect(spacing(token, 'w')).toBe(PRESENT_TOOLBAR_METRICS.buttonSize);
			expect(spacing(token, 'h')).toBe(PRESENT_TOOLBAR_METRICS.buttonSize);
		}
		// The caret is deliberately narrower than the tool it hangs off, and it
		// shipped at 18px in one binding and 28px in another.
		expect(spacing(PRESENT_TOOLBAR_CLASSES.caret, 'w')).toBe(PRESENT_TOOLBAR_METRICS.caretWidth);
		expect(spacing(PRESENT_TOOLBAR_CLASSES.caret, 'h')).toBe(PRESENT_TOOLBAR_METRICS.buttonSize);
		expect(spacing(PRESENT_TOOLBAR_CLASSES.caret, 'ml')).toBe(PRESENT_TOOLBAR_METRICS.caretOverlap);
	});

	it('sizes the divider, counter and palette the same way', () => {
		expect(spacing(PRESENT_TOOLBAR_CLASSES.divider, 'h')).toBe(
			PRESENT_TOOLBAR_METRICS.dividerHeight,
		);
		expect(spacing(PRESENT_TOOLBAR_CLASSES.divider, 'mx')).toBe(
			PRESENT_TOOLBAR_METRICS.dividerMarginX,
		);
		expect(PRESENT_TOOLBAR_CLASSES.counter).toContain(
			`min-w-[${String(PRESENT_TOOLBAR_METRICS.counterMinWidth)}px]`,
		);
		expect(PRESENT_TOOLBAR_CLASSES.palette).toContain(
			`grid-cols-${String(PRESENT_TOOLBAR_METRICS.paletteColumns)}`,
		);
		expect(spacing(PRESENT_TOOLBAR_CLASSES.swatch, 'w')).toBe(PRESENT_TOOLBAR_METRICS.swatchSize);
	});

	it('positions the bar the same way', () => {
		expect(spacing(PRESENT_TOOLBAR_CLASSES.wrapper, 'bottom')).toBe(
			PRESENT_TOOLBAR_METRICS.bottomOffset,
		);
		expect(PRESENT_TOOLBAR_CLASSES.wrapper).toContain(
			`z-[${String(PRESENT_TOOLBAR_METRICS.zIndex)}]`,
		);
		expect(PRESENT_TOOLBAR_CLASSES.wrapper).toContain(
			`duration-${String(PRESENT_TOOLBAR_METRICS.fadeMs)}`,
		);
	});
});

describe('presentToolbarCssVars', () => {
	it('emits every metric as a px (or raw) custom property', () => {
		const vars = presentToolbarCssVars();
		expect(vars['--pptx-pt-button']).toBe('36px');
		expect(vars['--pptx-pt-caret']).toBe('28px');
		expect(vars['--pptx-pt-bottom']).toBe('24px');
		expect(vars['--pptx-pt-z']).toBe('80');
		expect(vars['--pptx-pt-palette-cols']).toBe('4');
		// `text-xs` is 12px/16px: a hand-ported `12px/1` shrinks the readout and
		// with it the bar.
		expect(vars['--pptx-pt-font-size']).toBe('12px');
		expect(vars['--pptx-pt-line-height']).toBe('16px');
	});

	it('flattens to an inline style attribute', () => {
		const attr = presentToolbarStyleAttr();
		expect(attr).toContain('--pptx-pt-button:36px');
		expect(attr.split(';')).toHaveLength(Object.keys(presentToolbarCssVars()).length);
	});
});
