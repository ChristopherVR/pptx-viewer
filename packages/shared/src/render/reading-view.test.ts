import { describe, expect, it } from 'vitest';

import { createPresentationKeyBuffer } from './presentation-keymap';
import {
	applyReadingViewCommand,
	canGoNext,
	canGoPrevious,
	CLOSED_READING_VIEW,
	closeReadingView,
	handleReadingViewKey,
	mapReadingViewKey,
	openReadingView,
	readingViewFitScale,
} from './reading-view';
import type { ReadingViewState } from './reading-view';

const open = (slideIndex: number): ReadingViewState => ({ open: true, slideIndex });

describe('openReadingView', () => {
	it('opens on the requested slide', () => {
		expect(openReadingView(3, 10)).toStrictEqual({ open: true, slideIndex: 3 });
	});

	/**
	 * Entering from the ribbon after the active slide was deleted must not open
	 * on an index the deck no longer has.
	 */
	it('clamps an out-of-range index instead of trusting it', () => {
		expect(openReadingView(99, 4)).toStrictEqual({ open: true, slideIndex: 3 });
		expect(openReadingView(-5, 4)).toStrictEqual({ open: true, slideIndex: 0 });
		expect(openReadingView(2, 0)).toStrictEqual({ open: true, slideIndex: 0 });
	});

	it('closes to a shared closed state', () => {
		expect(closeReadingView()).toStrictEqual(CLOSED_READING_VIEW);
	});
});

describe('mapReadingViewKey', () => {
	it.each(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'])(
		'advances on %s, as the slide show does',
		(key) => {
			expect(mapReadingViewKey({ key })).toStrictEqual({ command: 'next' });
		},
	);

	it.each(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])('goes back on %s', (key) => {
		expect(mapReadingViewKey({ key })).toStrictEqual({ command: 'previous' });
	});

	it('maps Home and End to the ends of the deck', () => {
		expect(mapReadingViewKey({ key: 'Home' })).toStrictEqual({ command: 'first' });
		expect(mapReadingViewKey({ key: 'End' })).toStrictEqual({ command: 'last' });
	});

	it('exits on Escape', () => {
		expect(mapReadingViewKey({ key: 'Escape' })).toStrictEqual({ command: 'exit' });
	});

	it('resolves a typed slide number to a zero-based index', () => {
		const buffer = createPresentationKeyBuffer();
		expect(mapReadingViewKey({ key: '4' }, buffer)).toStrictEqual({ command: 'none' });
		expect(mapReadingViewKey({ key: 'Enter' }, buffer)).toStrictEqual({
			command: 'goto',
			slideIndex: 3,
		});
	});

	/**
	 * Reading View draws no ink and has no blackout, so the slide-show-only
	 * chords must fall through to the browser rather than being swallowed.
	 */
	it.each([
		['p', { ctrlKey: true }],
		['l', { ctrlKey: true }],
		['s', { ctrlKey: true }],
		['b', {}],
		['w', {}],
		['e', {}],
	])('ignores the slide-show-only shortcut %s', (key, mods) => {
		expect(mapReadingViewKey({ key, ...mods })).toStrictEqual({ command: 'none' });
	});
});

describe('handleReadingViewKey', () => {
	/**
	 * The bug this exists for, reproduced live in the React demo: an arrow key
	 * turned the reading-view page AND nudged the selected shape in the editor
	 * behind the overlay, so reading a deck edited it.
	 */
	it('swallows navigation keys so they cannot reach the editor underneath', () => {
		expect(handleReadingViewKey({ key: 'ArrowDown' })).toStrictEqual({
			command: { command: 'next' },
			swallow: true,
			preventDefault: true,
		});
	});

	/** A bare Delete must not destroy a shape the reader cannot even see. */
	it('swallows unmapped bare keys without cancelling them', () => {
		expect(handleReadingViewKey({ key: 'Delete' })).toStrictEqual({
			command: { command: 'none' },
			swallow: true,
			preventDefault: false,
		});
	});

	it.each([
		['p', { ctrlKey: true }],
		['F12', {}],
		['s', { metaKey: true }],
	])('lets the modifier chord %s through to the browser', (key, mods) => {
		const handling = handleReadingViewKey({ key, ...mods });
		expect(handling.command).toStrictEqual({ command: 'none' });
		if (key === 'F12') {
			// Bare function keys are swallowed from the editor but not cancelled.
			expect(handling.preventDefault).toBeFalsy();
		} else {
			expect(handling.swallow).toBeFalsy();
		}
	});
});

describe('applyReadingViewCommand', () => {
	it('steps forward and back', () => {
		expect(applyReadingViewCommand(open(1), { command: 'next' }, 5)).toStrictEqual(open(2));
		expect(applyReadingViewCommand(open(1), { command: 'previous' }, 5)).toStrictEqual(open(0));
	});

	it('holds on the first slide rather than closing', () => {
		expect(applyReadingViewCommand(open(0), { command: 'previous' }, 5)).toStrictEqual(open(0));
	});

	/**
	 * PowerPoint's Reading View has no "end of slide show" screen: advancing off
	 * the last slide hands the reader straight back to Normal.
	 */
	it('closes when advancing past the last slide', () => {
		expect(applyReadingViewCommand(open(4), { command: 'next' }, 5)).toStrictEqual(
			CLOSED_READING_VIEW,
		);
	});

	it('jumps to the ends and to an explicit index', () => {
		expect(applyReadingViewCommand(open(2), { command: 'first' }, 5)).toStrictEqual(open(0));
		expect(applyReadingViewCommand(open(2), { command: 'last' }, 5)).toStrictEqual(open(4));
		expect(applyReadingViewCommand(open(2), { command: 'goto', slideIndex: 3 }, 5)).toStrictEqual(
			open(3),
		);
	});

	it('clamps a goto past the end of the deck', () => {
		expect(applyReadingViewCommand(open(0), { command: 'goto', slideIndex: 40 }, 5)).toStrictEqual(
			open(4),
		);
	});

	it('exits on the exit command', () => {
		expect(applyReadingViewCommand(open(2), { command: 'exit' }, 5)).toStrictEqual(
			CLOSED_READING_VIEW,
		);
	});

	it('is inert while closed', () => {
		expect(applyReadingViewCommand(CLOSED_READING_VIEW, { command: 'next' }, 5)).toStrictEqual(
			CLOSED_READING_VIEW,
		);
	});

	/** A deck that lost its last slide while being read cannot stay open. */
	it('closes when the deck has no slides left', () => {
		expect(applyReadingViewCommand(open(0), { command: 'next' }, 0)).toStrictEqual(
			CLOSED_READING_VIEW,
		);
	});

	it('ignores an unmapped key', () => {
		expect(applyReadingViewCommand(open(2), { command: 'none' }, 5)).toStrictEqual(open(2));
	});
});

describe('navigation availability', () => {
	it('disables previous only on the first slide', () => {
		expect(canGoPrevious(open(0))).toBeFalsy();
		expect(canGoPrevious(open(1))).toBeTruthy();
		expect(canGoPrevious(CLOSED_READING_VIEW)).toBeFalsy();
	});

	/** Next stays live on the last slide, where it means "leave". */
	it('keeps next live on the last slide', () => {
		expect(canGoNext(open(4), 5)).toBeTruthy();
		expect(canGoNext(CLOSED_READING_VIEW, 5)).toBeFalsy();
		expect(canGoNext(open(0), 0)).toBeFalsy();
	});
});

describe('readingViewFitScale', () => {
	it('contains the canvas without cropping it', () => {
		// A 16:9 deck in a 4:3 window is limited by width.
		expect(readingViewFitScale({ width: 1600, height: 900 }, { width: 800, height: 900 })).toBe(
			0.5,
		);
		// A tall window is limited by height.
		expect(readingViewFitScale({ width: 1600, height: 900 }, { width: 3200, height: 450 })).toBe(
			0.5,
		);
	});

	it('subtracts padding from both axes', () => {
		expect(
			readingViewFitScale({ width: 1000, height: 1000 }, { width: 1200, height: 1200 }, 100),
		).toBe(1);
	});

	/** Rendering before the first layout pass must not scale by Infinity. */
	it('returns 0 for a degenerate box', () => {
		expect(readingViewFitScale({ width: 1600, height: 900 }, { width: 0, height: 0 })).toBe(0);
		expect(readingViewFitScale({ width: 0, height: 0 }, { width: 800, height: 600 })).toBe(0);
		expect(readingViewFitScale({ width: 100, height: 100 }, { width: 100, height: 100 }, 60)).toBe(
			0,
		);
	});
});
