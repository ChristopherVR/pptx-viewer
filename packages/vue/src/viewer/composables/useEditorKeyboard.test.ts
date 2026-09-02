// oxlint-disable react-hooks/rules-of-hooks
/**
 * Tests for `useEditorKeyboard`'s root `onEditorKeydown` handler, focused on
 * the F5 / Shift+F5 "start the show" keys (`dispatchSlideShowStartKey`).
 *
 * These must be checked at THIS level, not just against the pure
 * `dispatchSlideShowStartKey` function, because the point of the wiring is
 * that F5 fires even when `canEdit` is false, which only this composable's
 * ordering (start-key check before the `canEdit`-gated shortcut registry)
 * proves.
 */
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { useEditorKeyboard } from './useEditorKeyboard';
import type { UseEditorKeyboardInput } from './useEditorKeyboard';

function makeKeyEvent(init: { key: string; shiftKey?: boolean }): KeyboardEvent {
	return new KeyboardEvent('keydown', {
		key: init.key,
		shiftKey: init.shiftKey ?? false,
		cancelable: true,
	});
}

function setup(overrides: Partial<UseEditorKeyboardInput> = {}) {
	const presentFromBeginning = vi.fn();
	const startPresenting = vi.fn();
	const input: UseEditorKeyboardInput = {
		canEdit: () => true,
		hasSelection: computed(() => false),
		presenting: ref(false),
		findOpen: ref(false),
		selectedElementIds: ref([]),
		activeSlide: computed(() => undefined),
		activeSlideIndex: ref(0),
		slides: ref([]),
		templateElementsBySlideId: ref({}),
		pushHistory: vi.fn(),
		undo: vi.fn(),
		redo: vi.fn(),
		copyElement: vi.fn(),
		cutElement: vi.fn(),
		pasteElement: vi.fn(),
		duplicateSelected: vi.fn(),
		deleteSelected: vi.fn(),
		goPrev: vi.fn(),
		goNext: vi.fn(),
		onEscape: vi.fn(),
		presentFromBeginning,
		startPresenting,
		...overrides,
	};
	const { onEditorKeydown } = useEditorKeyboard(input);
	return { onEditorKeydown, presentFromBeginning, startPresenting, input };
}

describe('useEditorKeyboard - F5 / Shift+F5 start-show keys', () => {
	it('f5 calls presentFromBeginning and prevents default', () => {
		const { onEditorKeydown, presentFromBeginning, startPresenting } = setup();
		const event = makeKeyEvent({ key: 'F5' });
		onEditorKeydown(event);
		expect(presentFromBeginning).toHaveBeenCalledOnce();
		expect(startPresenting).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('shift+F5 calls startPresenting (From Current Slide) and prevents default', () => {
		const { onEditorKeydown, presentFromBeginning, startPresenting } = setup();
		const event = makeKeyEvent({ key: 'F5', shiftKey: true });
		onEditorKeydown(event);
		expect(startPresenting).toHaveBeenCalledOnce();
		expect(presentFromBeginning).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('f5 while a show is already running does nothing and does not prevent default', () => {
		const { onEditorKeydown, presentFromBeginning, startPresenting } = setup({
			presenting: ref(true),
		});
		const event = makeKeyEvent({ key: 'F5' });
		onEditorKeydown(event);
		expect(presentFromBeginning).not.toHaveBeenCalled();
		expect(startPresenting).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeFalsy();
	});

	it('f5 still starts the show when editing is disabled (canEdit false)', () => {
		const { onEditorKeydown, presentFromBeginning } = setup({ canEdit: () => false });
		const event = makeKeyEvent({ key: 'F5' });
		onEditorKeydown(event);
		expect(presentFromBeginning).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBeTruthy();
	});
});
