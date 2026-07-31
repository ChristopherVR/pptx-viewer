import { describe, expect, it } from 'vitest';

import {
	STATUS_BAR_CLASSES,
	STATUS_BAR_METRICS,
	TITLE_BAR_METRICS,
	titleBarCssVars,
	titleBarStyleAttr,
} from './chrome-metrics';
import { TITLE_BAR_CLASSES } from './title-bar';

/**
 * The chrome is pinned twice: as Tailwind utilities for React/Vue/Angular and
 * as plain numbers for Vanilla/Svelte. That is only safe while the two say the
 * same thing, so these tests read the numbers back out of the class strings.
 * Changing one representation without the other fails here rather than in a
 * screenshot.
 */

/** Tailwind spacing units are 0.25rem; the viewer's root font size is 16px. */
const REM = 16;
const SPACING = REM / 4;

/** The numeric part of a Tailwind spacing utility, e.g. `h-3.5` -> 14. */
function spacing(classes: string, prefix: string): number {
	const match = new RegExp(`(?:^| )${prefix}-(?<value>[0-9.]+)(?: |$)`, 'u').exec(classes);
	if (!match?.groups) {
		throw new Error(`no "${prefix}-<n>" utility in "${classes}"`);
	}
	return Number(match.groups.value) * SPACING;
}

/** The pixel value of an arbitrary utility, e.g. `text-[11px]` -> 11. */
function arbitraryPx(classes: string, prefix: string): number {
	const match = new RegExp(`(?:^| )${prefix}-\\[(?<value>-?[0-9.]+)px\\](?: |$)`, 'u').exec(
		classes,
	);
	if (!match?.groups) {
		throw new Error(`no "${prefix}-[<n>px]" utility in "${classes}"`);
	}
	return Number(match.groups.value);
}

describe('the title-bar metrics agree with the Tailwind class tokens', () => {
	it('sizes the row the same way', () => {
		expect(spacing(TITLE_BAR_CLASSES.container, 'h')).toBe(TITLE_BAR_METRICS.height);
		expect(spacing(TITLE_BAR_CLASSES.container, 'gap')).toBe(TITLE_BAR_METRICS.gap);
		expect(spacing(TITLE_BAR_CLASSES.container, 'px')).toBe(TITLE_BAR_METRICS.paddingX);
		expect(arbitraryPx(TITLE_BAR_CLASSES.container, 'text')).toBe(TITLE_BAR_METRICS.fontSize);
	});

	it('paints the app mark the same way', () => {
		expect(spacing(TITLE_BAR_CLASSES.logo, 'w')).toBe(TITLE_BAR_METRICS.logoSize);
		expect(spacing(TITLE_BAR_CLASSES.logo, 'h')).toBe(TITLE_BAR_METRICS.logoSize);
		expect(arbitraryPx(TITLE_BAR_CLASSES.logo, 'text')).toBe(TITLE_BAR_METRICS.logoFontSize);
		expect(TITLE_BAR_CLASSES.logo).toContain(`bg-[${TITLE_BAR_METRICS.logoBackground}]`);
	});

	it('sizes the AutoSave switch the same way', () => {
		expect(spacing(TITLE_BAR_CLASSES.toggleTrack, 'w')).toBe(TITLE_BAR_METRICS.switchTrackWidth);
		expect(spacing(TITLE_BAR_CLASSES.toggleTrack, 'h')).toBe(TITLE_BAR_METRICS.switchTrackHeight);
		expect(spacing(TITLE_BAR_CLASSES.toggleKnob, 'w')).toBe(TITLE_BAR_METRICS.switchKnobSize);
		expect(spacing(TITLE_BAR_CLASSES.toggleKnob, 'h')).toBe(TITLE_BAR_METRICS.switchKnobSize);
		expect(spacing(TITLE_BAR_CLASSES.toggleKnobOff, 'translate-x')).toBe(
			TITLE_BAR_METRICS.switchKnobOffsetOff,
		);
		expect(arbitraryPx(TITLE_BAR_CLASSES.toggleKnobOn, 'translate-x')).toBe(
			TITLE_BAR_METRICS.switchKnobOffsetOn,
		);
	});

	it('sets the file name the same way', () => {
		expect(arbitraryPx(TITLE_BAR_CLASSES.fileName, 'text')).toBe(
			TITLE_BAR_METRICS.fileNameFontSize,
		);
		// `font-medium` is Tailwind's 500 weight.
		expect(TITLE_BAR_CLASSES.fileName).toContain('font-medium');
		expect(TITLE_BAR_METRICS.fileNameFontWeight).toBe(500);
	});

	it('sizes the separator rule the same way', () => {
		expect(spacing(TITLE_BAR_CLASSES.separator, 'h')).toBe(TITLE_BAR_METRICS.separatorHeight);
	});
});

describe('the status-bar metric agrees with its Tailwind class token', () => {
	it('pins the same row height', () => {
		expect(arbitraryPx(STATUS_BAR_CLASSES.container, 'min-h')).toBe(STATUS_BAR_METRICS.height);
	});
});

describe('titleBarCssVars', () => {
	it('emits every metric as a px (or raw) custom property', () => {
		const vars = titleBarCssVars();
		expect(vars['--pptx-tb-height']).toBe('36px');
		expect(vars['--pptx-tb-gap']).toBe('4px');
		expect(vars['--pptx-tb-pad-x']).toBe('8px');
		expect(vars['--pptx-tb-logo-bg']).toBe('#c43e1c');
		expect(vars['--pptx-tb-file-weight']).toBe('500');
		expect(vars['--pptx-status-height']).toBe('29px');
	});

	it('reports the knob travel, not its resting offset', () => {
		// The hand-ported bindings park the knob at `left: 2px` and move it with a
		// transform, so a translate of the full 15px would land it at 17px.
		expect(titleBarCssVars()['--pptx-tb-knob-travel']).toBe('13px');
		expect(
			TITLE_BAR_METRICS.switchKnobOffsetOff +
				Number.parseFloat(titleBarCssVars()['--pptx-tb-knob-travel'] ?? '0'),
		).toBe(TITLE_BAR_METRICS.switchKnobOffsetOn);
	});

	it('flattens to an inline style attribute', () => {
		const attr = titleBarStyleAttr();
		expect(attr).toContain('--pptx-tb-height:36px');
		expect(attr.split(';')).toHaveLength(Object.keys(titleBarCssVars()).length);
	});
});
