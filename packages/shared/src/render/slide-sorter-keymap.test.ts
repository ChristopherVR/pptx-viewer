import { describe, expect, it } from 'vitest';

import { clampSorterZoom, mapSlideSorterKey } from './slide-sorter-keymap';
import type { SlideSorterKeyInput } from './slide-sorter-keymap';

const press = (key: string, mods: Partial<SlideSorterKeyInput> = {}) => ({ key, ...mods });

describe('mapSlideSorterKey', () => {
	describe('escape', () => {
		it('closes the overlay when at most one slide is selected', () => {
			expect(mapSlideSorterKey(press('Escape')).action).toBe('close');
		});

		it('collapses a multi-selection first, so one Escape does not do two things', () => {
			expect(mapSlideSorterKey(press('Escape'), { hasMultiSelection: true }).action).toBe(
				'collapseSelection',
			);
		});

		it('still backs out from a text field, the way it does in the main editor', () => {
			expect(mapSlideSorterKey(press('Escape'), { isTextInputTarget: true }).action).toBe('close');
		});

		it('closes a read-only sorter: dismissing an overlay is not an edit', () => {
			expect(mapSlideSorterKey(press('Escape'), { canEdit: false }).action).toBe('close');
		});
	});

	describe('deck commands', () => {
		it.each(['Delete', 'Backspace'])('deletes the selected slides on %s', (key) => {
			expect(mapSlideSorterKey(press(key)).action).toBe('delete');
		});

		it('maps the clipboard and duplicate chords', () => {
			expect(mapSlideSorterKey(press('c', { ctrlKey: true })).action).toBe('copy');
			expect(mapSlideSorterKey(press('v', { ctrlKey: true })).action).toBe('paste');
			expect(mapSlideSorterKey(press('d', { ctrlKey: true })).action).toBe('duplicate');
			expect(mapSlideSorterKey(press('a', { ctrlKey: true })).action).toBe('selectAll');
		});

		it('accepts Cmd as well as Ctrl', () => {
			expect(mapSlideSorterKey(press('d', { metaKey: true })).action).toBe('duplicate');
		});

		it('matches the chords case-insensitively', () => {
			// A hand-written `event.key === 'd'` misses Ctrl+Shift+D and misses
			// every press made with caps lock on, which is how the same chord ends
			// up working in one binding and not in another.
			expect(mapSlideSorterKey(press('D', { ctrlKey: true })).action).toBe('duplicate');
			expect(mapSlideSorterKey(press('A', { ctrlKey: true, shiftKey: true })).action).toBe(
				'selectAll',
			);
		});

		it('withholds the writing commands on a read-only host, but still copies', () => {
			const readOnly = { canEdit: false };
			expect(mapSlideSorterKey(press('Delete'), readOnly).action).toBeNull();
			expect(mapSlideSorterKey(press('v', { ctrlKey: true }), readOnly).action).toBeNull();
			expect(mapSlideSorterKey(press('d', { ctrlKey: true }), readOnly).action).toBeNull();
			expect(mapSlideSorterKey(press('c', { ctrlKey: true }), readOnly).action).toBe('copy');
			expect(mapSlideSorterKey(press('a', { ctrlKey: true }), readOnly).action).toBe('selectAll');
		});
	});

	describe('zoom', () => {
		it.each(['=', '+', 'Add'])('zooms in on Ctrl+%s', (key) => {
			expect(mapSlideSorterKey(press(key, { ctrlKey: true })).action).toBe('zoomIn');
		});

		it.each(['-', '_', 'Subtract'])('zooms out on Ctrl+%s', (key) => {
			expect(mapSlideSorterKey(press(key, { ctrlKey: true })).action).toBe('zoomOut');
		});

		it('clamps the resulting zoom to the supported range', () => {
			expect(clampSorterZoom(1000)).toBe(200);
			expect(clampSorterZoom(0)).toBe(50);
			expect(clampSorterZoom(120)).toBe(120);
		});
	});

	describe('gates', () => {
		it('stands down while the user is typing, so a rename keeps its keys', () => {
			const typing = { isTextInputTarget: true };
			expect(mapSlideSorterKey(press('Delete'), typing).action).toBeNull();
			expect(mapSlideSorterKey(press('d', { ctrlKey: true }), typing).action).toBeNull();
		});

		it('leaves unmapped keys and Alt chords to the host', () => {
			expect(mapSlideSorterKey(press('q')).action).toBeNull();
			expect(mapSlideSorterKey(press('d')).action).toBeNull();
			expect(mapSlideSorterKey(press('d', { ctrlKey: true, altKey: true })).action).toBeNull();
		});
	});
});
