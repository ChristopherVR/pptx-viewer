import { describe, expect, it, vi } from 'vitest';

import { dispatchSlideShowStartKey } from './slide-show-start-key';

function makeKeyEvent(init: { key: string; shiftKey?: boolean; ctrlKey?: boolean }): KeyboardEvent {
	return new KeyboardEvent('keydown', {
		key: init.key,
		shiftKey: init.shiftKey ?? false,
		ctrlKey: init.ctrlKey ?? false,
		cancelable: true,
	});
}

describe('dispatchSlideShowStartKey', () => {
	it('f5 dispatches presentFromBeginning, prevents default, and returns true', () => {
		const presentFromBeginning = vi.fn();
		const startPresenting = vi.fn();
		const event = makeKeyEvent({ key: 'F5' });
		const consumed = dispatchSlideShowStartKey(event, false, {
			presentFromBeginning,
			startPresenting,
		});
		expect(consumed).toBeTruthy();
		expect(presentFromBeginning).toHaveBeenCalledOnce();
		expect(startPresenting).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('shift+F5 dispatches startPresenting', () => {
		const presentFromBeginning = vi.fn();
		const startPresenting = vi.fn();
		const consumed = dispatchSlideShowStartKey(makeKeyEvent({ key: 'F5', shiftKey: true }), false, {
			presentFromBeginning,
			startPresenting,
		});
		expect(consumed).toBeTruthy();
		expect(startPresenting).toHaveBeenCalledOnce();
		expect(presentFromBeginning).not.toHaveBeenCalled();
	});

	it('does nothing while a show is already running', () => {
		const presentFromBeginning = vi.fn();
		const startPresenting = vi.fn();
		const event = makeKeyEvent({ key: 'F5' });
		const consumed = dispatchSlideShowStartKey(event, true, {
			presentFromBeginning,
			startPresenting,
		});
		expect(consumed).toBeFalsy();
		expect(presentFromBeginning).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeFalsy();
	});

	it('ignores ctrl+F5 (hard reload) and non-F5 keys', () => {
		const actions = { presentFromBeginning: vi.fn(), startPresenting: vi.fn() };
		expect(
			dispatchSlideShowStartKey(makeKeyEvent({ key: 'F5', ctrlKey: true }), false, actions),
		).toBeFalsy();
		expect(dispatchSlideShowStartKey(makeKeyEvent({ key: 'F6' }), false, actions)).toBeFalsy();
		expect(actions.presentFromBeginning).not.toHaveBeenCalled();
		expect(actions.startPresenting).not.toHaveBeenCalled();
	});
});
