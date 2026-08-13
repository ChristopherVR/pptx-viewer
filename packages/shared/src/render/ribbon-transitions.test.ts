import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	DEFAULT_RIBBON_TRANSITION_DURATION_SEC,
	NO_ADVANCE_AFTER_TEXT,
	RIBBON_TRANSITION_PRESETS,
	applyRibbonTransitionDraft,
	formatAdvanceAfterText,
	parseAdvanceAfterMs,
	readRibbonTransitionDraft,
	ribbonTransitionTargets,
	ribbonTransitionUpdates,
} from './ribbon-transitions';

const slide = (transition?: PptxSlide['transition']): PptxSlide =>
	({ id: 's1', elements: [], transition }) as unknown as PptxSlide;

const base = {
	type: 'fade' as const,
	durationSec: 0.7,
	advanceOnClick: true,
	advanceAfter: false,
	advanceAfterText: NO_ADVANCE_AFTER_TEXT,
};

describe('ribbonTransitionPresets', () => {
	it('offers the nine-entry strip every binding used to hand-copy', () => {
		expect(RIBBON_TRANSITION_PRESETS.map((preset) => preset.type)).toStrictEqual([
			'none',
			'fade',
			'push',
			'wipe',
			'split',
			'reveal',
			'cut',
			'cover',
			'uncover',
		]);
	});
});

describe('parseAdvanceAfterMs', () => {
	it('reads the mm:ss.hh text the field seeds itself with', () => {
		expect(parseAdvanceAfterMs('00:03.50')).toBe(3500);
		expect(parseAdvanceAfterMs('01:00.00')).toBe(60000);
	});

	it('reads bare seconds, which is what users actually type', () => {
		expect(parseAdvanceAfterMs('2')).toBe(2000);
		expect(parseAdvanceAfterMs('1.25')).toBe(1250);
	});

	it('refuses garbage rather than writing NaN into advTm', () => {
		expect(parseAdvanceAfterMs('')).toBeNull();
		expect(parseAdvanceAfterMs('abc')).toBeNull();
		expect(parseAdvanceAfterMs('-1')).toBeNull();
		expect(parseAdvanceAfterMs('1:2:3')).toBeNull();
	});
});

describe('formatAdvanceAfterText', () => {
	it('round-trips through parse', () => {
		expect(formatAdvanceAfterText(3500)).toBe('00:03.50');
		expect(parseAdvanceAfterMs(formatAdvanceAfterText(3500))).toBe(3500);
	});

	it('shows the empty marker for an absent or zero advance', () => {
		expect(formatAdvanceAfterText(undefined)).toBe(NO_ADVANCE_AFTER_TEXT);
		expect(formatAdvanceAfterText(0)).toBe(NO_ADVANCE_AFTER_TEXT);
	});
});

describe('readRibbonTransitionDraft', () => {
	it('reads the controls back off the slide, so navigation cannot desync them', () => {
		expect(
			readRibbonTransitionDraft(
				slide({ type: 'wipe', durationMs: 1500, advanceOnClick: false, advanceAfterMs: 3000 }),
			),
		).toStrictEqual({
			type: 'wipe',
			durationSec: 1.5,
			advanceOnClick: false,
			advanceAfter: true,
			advanceAfterText: '00:03.00',
		});
	});

	it('reads a zero advTm as ARMED, so ticking After is not undone at once', () => {
		const draft = readRibbonTransitionDraft(slide({ type: 'fade', advanceAfterMs: 0 }));
		expect(draft.advanceAfter).toBeTruthy();
		expect(draft.advanceAfterText).toBe(NO_ADVANCE_AFTER_TEXT);
	});

	it('falls back to the empty draft for a slide with no transition', () => {
		expect(readRibbonTransitionDraft(slide())).toStrictEqual({
			type: 'none',
			durationSec: DEFAULT_RIBBON_TRANSITION_DURATION_SEC,
			advanceOnClick: true,
			advanceAfter: false,
			advanceAfterText: NO_ADVANCE_AFTER_TEXT,
		});
	});
});

describe('ribbonTransitionUpdates', () => {
	it('converts the draft into the transition fields a commit writes', () => {
		expect(
			ribbonTransitionUpdates({
				type: 'push',
				durationSec: 1.2,
				advanceOnClick: true,
				advanceAfter: true,
				advanceAfterText: '00:05.00',
			}),
		).toStrictEqual({
			type: 'push',
			durationMs: 1200,
			advanceOnClick: true,
			advanceAfterMs: 5000,
		});
	});

	it('clears a timed advance when the After box is unticked', () => {
		expect(
			ribbonTransitionUpdates({
				type: 'fade',
				durationSec: 0.7,
				advanceOnClick: true,
				advanceAfter: false,
				advanceAfterText: '00:05.00',
			}).advanceAfterMs,
		).toBeUndefined();
	});

	it('commits zero for an armed but unparseable After field', () => {
		expect(
			ribbonTransitionUpdates({ ...base, advanceAfter: true, advanceAfterText: 'nonsense' })
				.advanceAfterMs,
		).toBe(0);
	});

	it('clamps a duration typed outside the accepted range', () => {
		expect(ribbonTransitionUpdates({ ...base, durationSec: 999 }).durationMs).toBe(20000);
		expect(ribbonTransitionUpdates({ ...base, durationSec: -5 }).durationMs).toBe(0);
	});
});

describe('applyRibbonTransitionDraft', () => {
	it('preserves fields the ribbon does not own', () => {
		const merged = applyRibbonTransitionDraft(slide({ type: 'wipe', direction: 'l', spokes: 4 }), {
			...base,
			type: 'push',
		});
		expect(merged.type).toBe('push');
		expect(merged.direction).toBe('l');
		expect(merged.spokes).toBe(4);
	});
});

describe('ribbonTransitionTargets', () => {
	it('targets only the active slide by default', () => {
		expect(ribbonTransitionTargets(4, 2, false)).toStrictEqual([2]);
	});

	it('targets every slide when Apply to All is armed', () => {
		expect(ribbonTransitionTargets(3, 1, true)).toStrictEqual([0, 1, 2]);
	});

	it('targets nothing when the active index is out of range', () => {
		expect(ribbonTransitionTargets(0, 0, false)).toStrictEqual([]);
	});
});
