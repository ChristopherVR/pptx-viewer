import { describe, expect, it } from 'vitest';

import { mapSlideShowStartKey } from './slide-show-start-keymap';
import type { SlideShowStartKeyInput } from './slide-show-start-keymap';

const press = (key: string, mods: Partial<SlideShowStartKeyInput> = {}) => ({ key, ...mods });
const idle = { isPresenting: false };

describe('mapSlideShowStartKey', () => {
	it('maps a bare F5 to From Beginning', () => {
		expect(mapSlideShowStartKey(press('F5'), idle)).toBe('fromBeginning');
	});

	it('maps Shift+F5 to From Current Slide', () => {
		expect(mapSlideShowStartKey(press('F5', { shiftKey: true }), idle)).toBe('fromCurrent');
	});

	it('leaves Ctrl/Cmd/Alt+F5 to the browser (hard reload and friends)', () => {
		expect(mapSlideShowStartKey(press('F5', { ctrlKey: true }), idle)).toBeNull();
		expect(mapSlideShowStartKey(press('F5', { metaKey: true }), idle)).toBeNull();
		expect(mapSlideShowStartKey(press('F5', { altKey: true }), idle)).toBeNull();
		expect(mapSlideShowStartKey(press('F5', { ctrlKey: true, shiftKey: true }), idle)).toBeNull();
	});

	it('ignores every other key, including the neighbouring function keys', () => {
		for (const key of ['F4', 'F6', 'f5', '5', 'Enter', 'Escape']) {
			expect(mapSlideShowStartKey(press(key), idle)).toBeNull();
			expect(mapSlideShowStartKey(press(key, { shiftKey: true }), idle)).toBeNull();
		}
	});

	it('does nothing while a show is already running', () => {
		expect(mapSlideShowStartKey(press('F5'), { isPresenting: true })).toBeNull();
		expect(
			mapSlideShowStartKey(press('F5', { shiftKey: true }), { isPresenting: true }),
		).toBeNull();
	});
});
