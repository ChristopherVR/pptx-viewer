import { describe, it, expect } from 'vitest';

import {
	mapKeyToPresentationAction,
	isNavigationKey,
	NEXT_SLIDE_KEYS,
	PREV_SLIDE_KEYS,
} from './keyboard-helpers';

// ---------------------------------------------------------------------------
// mapKeyToPresentationAction
// ---------------------------------------------------------------------------

describe('mapKeyToPresentationAction', () => {
	// Exit
	it('maps Escape to exit', () => {
		expect(mapKeyToPresentationAction('Escape', false)).toStrictEqual({
			action: 'exit',
		});
	});

	it('maps Escape with ctrl to exit', () => {
		expect(mapKeyToPresentationAction('Escape', true)).toStrictEqual({
			action: 'exit',
		});
	});

	// Next slide
	it('maps ArrowRight to next', () => {
		expect(mapKeyToPresentationAction('ArrowRight', false)).toStrictEqual({
			action: 'next',
		});
	});

	it('maps PageDown to next', () => {
		expect(mapKeyToPresentationAction('PageDown', false)).toStrictEqual({
			action: 'next',
		});
	});

	it('maps Space to next', () => {
		expect(mapKeyToPresentationAction(' ', false)).toStrictEqual({
			action: 'next',
		});
	});

	// Previous slide
	it('maps ArrowLeft to prev', () => {
		expect(mapKeyToPresentationAction('ArrowLeft', false)).toStrictEqual({
			action: 'prev',
		});
	});

	it('maps PageUp to prev', () => {
		expect(mapKeyToPresentationAction('PageUp', false)).toStrictEqual({
			action: 'prev',
		});
	});

	// Annotation tool shortcuts
	it("maps 'l' to toggleLaser", () => {
		expect(mapKeyToPresentationAction('l', false)).toStrictEqual({
			action: 'toggleLaser',
		});
	});

	it("maps 'L' to toggleLaser", () => {
		expect(mapKeyToPresentationAction('L', false)).toStrictEqual({
			action: 'toggleLaser',
		});
	});

	it("maps 'p' to togglePen", () => {
		expect(mapKeyToPresentationAction('p', false)).toStrictEqual({
			action: 'togglePen',
		});
	});

	it("maps 'P' to togglePen", () => {
		expect(mapKeyToPresentationAction('P', false)).toStrictEqual({
			action: 'togglePen',
		});
	});

	it("maps 'e' to toggleEraser", () => {
		expect(mapKeyToPresentationAction('e', false)).toStrictEqual({
			action: 'toggleEraser',
		});
	});

	it("maps 'E' to toggleEraser", () => {
		expect(mapKeyToPresentationAction('E', false)).toStrictEqual({
			action: 'toggleEraser',
		});
	});

	it('maps B and W to audience screen blanks', () => {
		expect(mapKeyToPresentationAction('B', false)).toStrictEqual({ action: 'toggleBlackScreen' });
		expect(mapKeyToPresentationAction('w', false)).toStrictEqual({ action: 'toggleWhiteScreen' });
	});

	// Toolbar toggle (Ctrl+M)
	it('maps Ctrl+m to toggleToolbar', () => {
		expect(mapKeyToPresentationAction('m', true)).toStrictEqual({
			action: 'toggleToolbar',
		});
	});

	it("maps 'm' without ctrl to none", () => {
		expect(mapKeyToPresentationAction('m', false)).toStrictEqual({
			action: 'none',
		});
	});

	// Toggle presenter view (N key)
	it("maps 'n' to togglePresenterView", () => {
		expect(mapKeyToPresentationAction('n', false)).toStrictEqual({
			action: 'togglePresenterView',
		});
	});

	it("maps 'N' to togglePresenterView", () => {
		expect(mapKeyToPresentationAction('N', false)).toStrictEqual({
			action: 'togglePresenterView',
		});
	});

	// Unmapped keys
	it('returns none for unmapped keys', () => {
		expect(mapKeyToPresentationAction('a', false)).toStrictEqual({
			action: 'none',
		});
	});

	it('returns none for number keys', () => {
		expect(mapKeyToPresentationAction('1', false)).toStrictEqual({
			action: 'none',
		});
	});

	it('returns none for Tab', () => {
		expect(mapKeyToPresentationAction('Tab', false)).toStrictEqual({
			action: 'none',
		});
	});
});

// ---------------------------------------------------------------------------
// isNavigationKey
// ---------------------------------------------------------------------------

describe('isNavigationKey', () => {
	it('returns true for all next-slide keys', () => {
		for (const key of NEXT_SLIDE_KEYS) {
			expect(isNavigationKey(key)).toBeTruthy();
		}
	});

	it('returns true for all prev-slide keys', () => {
		for (const key of PREV_SLIDE_KEYS) {
			expect(isNavigationKey(key)).toBeTruthy();
		}
	});

	it('returns false for non-navigation keys', () => {
		expect(isNavigationKey('Escape')).toBeFalsy();
		expect(isNavigationKey('l')).toBeFalsy();
		expect(isNavigationKey('Enter')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Key constants
// ---------------------------------------------------------------------------

describe('key constants', () => {
	it('nEXT_SLIDE_KEYS contains the expected keys', () => {
		expect(NEXT_SLIDE_KEYS).toContain('ArrowRight');
		expect(NEXT_SLIDE_KEYS).toContain('PageDown');
		expect(NEXT_SLIDE_KEYS).toContain(' ');
	});

	it('pREV_SLIDE_KEYS contains the expected keys', () => {
		expect(PREV_SLIDE_KEYS).toContain('ArrowLeft');
		expect(PREV_SLIDE_KEYS).toContain('PageUp');
	});
});
