import { describe, expect, it } from 'vitest';

import {
	PRESENTER_CONSOLE_ORDER,
	createInitialPresentationSnapshot,
	presenterNextDisabled,
	presenterPrevDisabled,
} from '../internal/shared';
import type { PresentationSnapshot } from '../internal/shared';
import {
	presenterConsoleSlots,
	presenterSlotActive,
	presenterSlotDisabled,
} from './presenter-console-helpers';

function snapshot(overrides: Partial<PresentationSnapshot> = {}): PresentationSnapshot {
	return { ...createInitialPresentationSnapshot(), ...overrides };
}

function slot(id: string, snap = snapshot(), audienceOpen = false) {
	const found = presenterConsoleSlots(snap, audienceOpen).find((entry) => entry.id === id);
	if (!found) {
		throw new Error(`no console slot with id "${id}"`);
	}
	return found;
}

// ---------------------------------------------------------------------------
// Inventory + order
// ---------------------------------------------------------------------------

describe('presenterConsoleSlots', () => {
	it('renders every shared control, in the shared order', () => {
		expect(presenterConsoleSlots(snapshot(), false).map((entry) => entry.id)).toStrictEqual([
			...PRESENTER_CONSOLE_ORDER,
		]);
	});

	it('puts zoom-in BEFORE zoom-out (Angular used to render - then +)', () => {
		const ids = presenterConsoleSlots(snapshot(), false).map((entry) => entry.id);
		expect(ids.indexOf('zoom-in')).toBeLessThan(ids.indexOf('zoom-out'));
	});

	it('gives every button and toggle a label key to translate', () => {
		for (const entry of presenterConsoleSlots(snapshot(), false)) {
			if (entry.control.kind === 'divider' || entry.control.kind === 'spacer') {
				expect(entry.labelKey).toBeUndefined();
			} else {
				expect(entry.labelKey).toBeTypeOf('string');
			}
		}
	});

	it('names the blackout switches so a reader does not announce them as "B"/"W"', () => {
		expect(slot('blackout-black').control.glyph).toBe('B');
		expect(slot('blackout-black').labelKey).toBe('pptx.presenter.blackScreen');
		expect(slot('blackout-white').control.glyph).toBe('W');
		expect(slot('blackout-white').labelKey).toBe('pptx.presenter.whiteScreen');
	});
});

// ---------------------------------------------------------------------------
// aria-pressed
// ---------------------------------------------------------------------------

describe('aria-pressed', () => {
	it('is null on plain buttons so they are not announced as toggles', () => {
		expect(slot('timer-toggle').pressed).toBeNull();
		expect(slot('timer-reset').pressed).toBeNull();
		expect(slot('zoom-in').pressed).toBeNull();
		expect(slot('end').pressed).toBeNull();
	});

	it('reflects the state of every toggle slot', () => {
		expect(slot('pen').pressed).toBeFalsy();
		expect(
			slot('pen', snapshot({ pointer: { tool: 'pen', x: 0, y: 0, color: '#f00' } })).pressed,
		).toBeTruthy();
		expect(slot('captions', snapshot({ subtitlesVisible: true })).pressed).toBeTruthy();
		expect(slot('audience', snapshot(), true).pressed).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Active state
// ---------------------------------------------------------------------------

describe('presenterSlotActive', () => {
	it('marks the selected annotation tool and only that one', () => {
		const withPen = snapshot({ pointer: { tool: 'pen', x: 0.5, y: 0.5, color: '#ef4444' } });
		expect(slot('pen', withPen).active).toBeTruthy();
		expect(slot('laser', withPen).active).toBeFalsy();
		expect(slot('eraser', withPen).active).toBeFalsy();
	});

	it('marks the matching blackout switch', () => {
		expect(slot('blackout-black', snapshot({ blackout: 'black' })).active).toBeTruthy();
		expect(slot('blackout-white', snapshot({ blackout: 'black' })).active).toBeFalsy();
	});

	it('treats a paused timer as active, which swaps in the resume glyph', () => {
		const paused = slot('timer-toggle', snapshot({ paused: true }));
		expect(paused.active).toBeTruthy();
		expect(paused.iconName).toBe('circle-play');
		expect(slot('timer-toggle').iconName).toBe('circle-pause');
	});

	it('emphasises zoom-in only while zoomed past fit', () => {
		expect(slot('zoom-in').active).toBeFalsy();
		expect(
			slot('zoom-in', snapshot({ zoom: { scale: 1.5, originX: 0.5, originY: 0.5 } })).active,
		).toBeTruthy();
	});

	it('swaps the audience slot label and icon once the display is open', () => {
		expect(slot('audience').labelKey).toBe('pptx.presenter.openAudienceWindow');
		expect(slot('audience').iconName).toBe('monitor');
		expect(slot('audience', snapshot(), true).labelKey).toBe('pptx.presenter.closeAudienceWindow');
		expect(slot('audience', snapshot(), true).iconName).toBe('monitor-off');
	});

	it('leaves dividers and spacers inert', () => {
		const divider = slot('divider-timer');
		expect(presenterSlotActive(divider.control, snapshot(), true)).toBeFalsy();
		expect(divider.tool).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe('presenterSlotDisabled', () => {
	it('disables Swap Displays until there is a second window to swap with', () => {
		expect(presenterSlotDisabled('swap-displays', false)).toBeTruthy();
		expect(presenterSlotDisabled('swap-displays', true)).toBeFalsy();
	});

	it('disables nothing else', () => {
		for (const id of PRESENTER_CONSOLE_ORDER) {
			if (id !== 'swap-displays') {
				expect(presenterSlotDisabled(id, false)).toBeFalsy();
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Navigation gating (the rail, not the strip)
// ---------------------------------------------------------------------------

describe('rail navigation gating', () => {
	it('never disables Next, so the presenter can reach the end-of-show screen', () => {
		expect(presenterNextDisabled()).toBeFalsy();
	});

	it('disables Previous only on the first slide', () => {
		expect(presenterPrevDisabled(0)).toBeTruthy();
		expect(presenterPrevDisabled(1)).toBeFalsy();
	});
});
