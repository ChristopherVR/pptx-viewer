// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { placeCaretAt, setPendingCaretPoint, takePendingCaretPoint } from './inline-caret';

describe('caret at the click that opened the editor', () => {
	afterEach(() => {
		vi.useRealTimers();
		setPendingCaretPoint(null);
	});

	it('hands the recorded click to the next editor, once', () => {
		setPendingCaretPoint({ clientX: 12, clientY: 34 });
		expect(takePendingCaretPoint()).toStrictEqual({ clientX: 12, clientY: 34 });
		expect(takePendingCaretPoint()).toBeNull();
	});

	it('forgets a stale click', () => {
		vi.useFakeTimers();
		setPendingCaretPoint({ clientX: 1, clientY: 1 });
		vi.advanceTimersByTime(1500);
		expect(takePendingCaretPoint()).toBeNull();
	});

	it('falls back to the end when there is no point or it misses the text', () => {
		const el = document.createElement('div');
		el.contentEditable = 'true';
		el.textContent = 'Scale';
		document.body.appendChild(el);
		placeCaretAt(el, null);
		const range = window.getSelection()!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		expect(el.contains(range.startContainer)).toBeTruthy();
		placeCaretAt(el, { clientX: -500, clientY: -500 });
		expect(window.getSelection()!.getRangeAt(0).collapsed).toBeTruthy();
		el.remove();
	});
});
