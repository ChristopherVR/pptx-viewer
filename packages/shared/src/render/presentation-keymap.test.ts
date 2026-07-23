import { describe, expect, it } from 'vitest';

import {
	createPresentationKeyBuffer,
	isNavigationAction,
	mapPresentationKey,
} from './presentation-keymap';
import type { PresentationKeyInput } from './presentation-keymap';

const press = (key: string, mods: Partial<PresentationKeyInput> = {}) => ({ key, ...mods });

describe('mapPresentationKey', () => {
	describe('navigation', () => {
		it.each(['Enter', 'PageDown', 'ArrowRight', 'ArrowDown', ' ', 'n', 'N'])(
			'advances on %s',
			(key) => {
				expect(mapPresentationKey(press(key))).toStrictEqual({ action: 'next' });
			},
		);

		it.each(['PageUp', 'ArrowLeft', 'ArrowUp', 'Backspace', 'p', 'P'])('goes back on %s', (key) => {
			expect(mapPresentationKey(press(key))).toStrictEqual({ action: 'previous' });
		});

		it('maps Home and End to first and last slide', () => {
			expect(mapPresentationKey(press('Home'))).toStrictEqual({ action: 'first' });
			expect(mapPresentationKey(press('End'))).toStrictEqual({ action: 'last' });
		});
	});

	describe('slide-number jump', () => {
		it('buffers digits and jumps on Enter', () => {
			const buffer = createPresentationKeyBuffer();
			expect(mapPresentationKey(press('1'), buffer)).toStrictEqual({
				action: 'buffering',
				buffer: '1',
			});
			expect(mapPresentationKey(press('2'), buffer)).toStrictEqual({
				action: 'buffering',
				buffer: '12',
			});
			expect(mapPresentationKey(press('Enter'), buffer)).toStrictEqual({
				action: 'goto',
				slideNumber: 12,
			});
		});

		it('clears the buffer after the jump so the next Enter advances', () => {
			const buffer = createPresentationKeyBuffer();
			mapPresentationKey(press('3'), buffer);
			mapPresentationKey(press('Enter'), buffer);
			expect(mapPresentationKey(press('Enter'), buffer)).toStrictEqual({ action: 'next' });
		});

		it('discards a pending number when a navigation key interrupts it', () => {
			const buffer = createPresentationKeyBuffer();
			mapPresentationKey(press('9'), buffer);
			expect(mapPresentationKey(press('ArrowRight'), buffer)).toStrictEqual({ action: 'next' });
			expect(buffer.digits).toBe('');
		});

		it('caps the buffer length', () => {
			const buffer = createPresentationKeyBuffer();
			for (const digit of '1234567') {
				mapPresentationKey(press(digit), buffer);
			}
			expect(buffer.digits).toBe('4567');
		});
	});

	describe('blank screens', () => {
		it.each(['b', 'B', '.'])('toggles the black screen on %s', (key) => {
			expect(mapPresentationKey(press(key))).toStrictEqual({ action: 'toggleBlackScreen' });
		});

		it.each(['w', 'W', ','])('toggles the white screen on %s', (key) => {
			expect(mapPresentationKey(press(key))).toStrictEqual({ action: 'toggleWhiteScreen' });
		});
	});

	describe('pointer tools', () => {
		it('maps the Ctrl chords to PowerPoint pointer tools', () => {
			expect(mapPresentationKey(press('l', { ctrlKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'laser',
			});
			expect(mapPresentationKey(press('p', { ctrlKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'pen',
			});
			expect(mapPresentationKey(press('a', { ctrlKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'arrow',
			});
			expect(mapPresentationKey(press('e', { ctrlKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'eraser',
			});
		});

		it('accepts Cmd as well as Ctrl for macOS', () => {
			expect(mapPresentationKey(press('l', { metaKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'laser',
			});
		});

		it('distinguishes bare P (previous) from Ctrl+P (pen)', () => {
			expect(mapPresentationKey(press('p'))).toStrictEqual({ action: 'previous' });
			expect(mapPresentationKey(press('p', { ctrlKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'pen',
			});
		});

		it('distinguishes bare E (erase annotations) from Ctrl+E (eraser tool)', () => {
			expect(mapPresentationKey(press('e'))).toStrictEqual({ action: 'eraseAnnotations' });
			expect(mapPresentationKey(press('e', { ctrlKey: true }))).toStrictEqual({
				action: 'pointerTool',
				tool: 'eraser',
			});
		});
	});

	describe('chrome and menus', () => {
		it('maps Ctrl+M to ink markup and Ctrl+H to hiding the chrome', () => {
			expect(mapPresentationKey(press('m', { ctrlKey: true }))).toStrictEqual({
				action: 'toggleInkMarkup',
			});
			expect(mapPresentationKey(press('h', { ctrlKey: true }))).toStrictEqual({
				action: 'toggleChrome',
			});
		});

		it('maps Ctrl+S to the All Slides dialog, not save', () => {
			expect(mapPresentationKey(press('s', { ctrlKey: true }))).toStrictEqual({
				action: 'showAllSlides',
			});
		});

		it('maps Shift+F10 and the menu key to the context menu', () => {
			expect(mapPresentationKey(press('F10', { shiftKey: true }))).toStrictEqual({
				action: 'contextMenu',
			});
			expect(mapPresentationKey(press('ContextMenu'))).toStrictEqual({ action: 'contextMenu' });
		});
	});

	describe('ending the show', () => {
		it.each(['Escape', '-'])('ends on %s', (key) => {
			expect(mapPresentationKey(press(key))).toStrictEqual({ action: 'end' });
		});
	});

	it('ignores unmapped keys', () => {
		expect(mapPresentationKey(press('q'))).toStrictEqual({ action: 'none' });
		expect(mapPresentationKey(press('F7'))).toStrictEqual({ action: 'none' });
	});

	it('does not fire bare-letter shortcuts while a modifier is held', () => {
		expect(mapPresentationKey(press('n', { altKey: true }))).toStrictEqual({ action: 'none' });
		expect(mapPresentationKey(press('b', { altKey: true }))).toStrictEqual({ action: 'none' });
	});
});

describe('isNavigationAction', () => {
	it('is true only for slide-changing actions', () => {
		expect(isNavigationAction({ action: 'next' })).toBeTruthy();
		expect(isNavigationAction({ action: 'goto', slideNumber: 2 })).toBeTruthy();
		expect(isNavigationAction({ action: 'toggleBlackScreen' })).toBeFalsy();
		expect(isNavigationAction({ action: 'none' })).toBeFalsy();
	});
});
