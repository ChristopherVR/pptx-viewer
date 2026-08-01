import { describe, expect, it } from 'vitest';

import { translationsEn } from '../i18n/translations-en';
import {
	PRESENTER_CONSOLE_CONTROLS,
	PRESENTER_CONSOLE_LABEL_KEYS,
	PRESENTER_CONSOLE_ORDER,
	PRESENTER_NAVIGATOR_LABEL_KEYS,
	PRESENTER_RAIL_CONTROLS,
	PRESENTER_RAIL_LABEL_KEYS,
	PRESENTER_TIMER_SEGMENT_MS,
	presenterNextDisabled,
	presenterPrevDisabled,
	presenterTimerProgress,
} from './presenter-chrome';
import {
	PRESENTER_CONSOLE_CLASSES,
	PRESENTER_LAYOUT_METRICS,
	presenterConsoleCssVars,
	presenterConsoleStyleAttr,
} from './presenter-chrome-metrics';

describe('presenter console inventory', () => {
	it('keeps the slot order React ships', () => {
		expect(PRESENTER_CONSOLE_ORDER).toStrictEqual([
			'timer-toggle',
			'timer-reset',
			'divider-timer',
			'all-slides',
			'zoom-in',
			'zoom-out',
			'zoom-reset',
			'divider-zoom',
			'laser',
			'pen',
			'highlighter',
			'eraser',
			'divider-tools',
			'blackout-black',
			'blackout-white',
			'captions',
			'spacer',
			'audience',
			'swap-displays',
			'end',
		]);
	});

	it('gives every actionable slot a label key and every structural slot none', () => {
		for (const control of PRESENTER_CONSOLE_CONTROLS) {
			if (control.kind === 'divider' || control.kind === 'spacer') {
				expect(control.labelKey).toBeUndefined();
			} else {
				expect(control.labelKey).toBeTruthy();
			}
		}
	});

	it('names the blackout switches beyond their B / W glyph', () => {
		const black = PRESENTER_CONSOLE_CONTROLS.find((c) => c.id === 'blackout-black');
		const white = PRESENTER_CONSOLE_CONTROLS.find((c) => c.id === 'blackout-white');
		expect(black?.glyph).toBe('B');
		expect(white?.glyph).toBe('W');
		expect(black?.labelKey).toBe('pptx.presenter.blackScreen');
		expect(white?.labelKey).toBe('pptx.presenter.whiteScreen');
	});

	it('resolves every label key through the canonical dictionary', () => {
		const keys = [
			...PRESENTER_CONSOLE_LABEL_KEYS,
			...PRESENTER_CONSOLE_CONTROLS.flatMap((c) => (c.activeLabelKey ? [c.activeLabelKey] : [])),
			...PRESENTER_RAIL_CONTROLS.map((c) => c.labelKey),
			...Object.values(PRESENTER_RAIL_LABEL_KEYS),
			...Object.values(PRESENTER_NAVIGATOR_LABEL_KEYS),
		];
		for (const key of keys) {
			expect(translationsEn[key]).toBeTruthy();
		}
	});

	it('uses ids unique enough to serve as a DOM contract', () => {
		expect(new Set(PRESENTER_CONSOLE_ORDER).size).toBe(PRESENTER_CONSOLE_ORDER.length);
	});
});

describe('presenter rail navigation rules', () => {
	it('never disables Next, so the presenter can reach the end-of-show screen', () => {
		expect(presenterNextDisabled()).toBeFalsy();
	});

	it('disables Previous only on the first slide', () => {
		expect(presenterPrevDisabled(0)).toBeTruthy();
		expect(presenterPrevDisabled(1)).toBeFalsy();
	});
});

describe('presenterTimerProgress', () => {
	it('fills across a five-minute segment', () => {
		expect(PRESENTER_TIMER_SEGMENT_MS).toBe(300_000);
		expect(presenterTimerProgress(0)).toStrictEqual({ percent: 0, segment: 0 });
		expect(presenterTimerProgress(150_000)).toStrictEqual({ percent: 50, segment: 0 });
	});

	it('rolls into the next segment', () => {
		expect(presenterTimerProgress(300_000)).toStrictEqual({ percent: 0, segment: 1 });
		expect(presenterTimerProgress(450_000)).toStrictEqual({ percent: 50, segment: 1 });
	});

	it('clamps a negative elapsed rather than emitting invalid ARIA', () => {
		expect(presenterTimerProgress(-5_000)).toStrictEqual({ percent: 0, segment: 0 });
	});
});

describe('presenter console metrics', () => {
	it('keeps the Tailwind strings and the numbers in step', () => {
		const m = PRESENTER_LAYOUT_METRICS;
		expect(PRESENTER_CONSOLE_CLASSES.main).toContain(`flex-[${String(m.mainFlex)}]`);
		expect(PRESENTER_CONSOLE_CLASSES.rail).toContain(`flex-[${String(m.railFlex)}]`);
		expect(PRESENTER_CONSOLE_CLASSES.rail).toContain(`min-w-[${String(m.railMinWidth)}px]`);
		expect(PRESENTER_CONSOLE_CLASSES.rail).toContain(`max-w-[${String(m.railMaxWidth)}px]`);
		expect(PRESENTER_CONSOLE_CLASSES.root).toContain(`z-${String(m.zIndex)}`);
		expect(PRESENTER_CONSOLE_CLASSES.navigator).toContain(`z-[${String(m.navigatorZIndex)}]`);
		expect(PRESENTER_CONSOLE_CLASSES.navigatorGrid).toContain(
			`minmax(${String(m.navigatorTrackMin)}px,1fr)`,
		);
	});

	it('exposes every metric as a custom property', () => {
		const vars = presenterConsoleCssVars();
		expect(Object.keys(vars)).toHaveLength(Object.keys(PRESENTER_LAYOUT_METRICS).length);
		expect(vars['--pptx-pv-rail-min']).toBe('260px');
		expect(vars['--pptx-pv-hidden-opacity']).toBe('0.45');
	});

	it('flattens the custom properties into an inline style attribute', () => {
		expect(presenterConsoleStyleAttr()).toContain('--pptx-pv-rail-min:260px');
	});
});
