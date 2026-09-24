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
		inlineEditingElementId: ref(null),
		tableEditorIsEditing: () => false,
		activeTool: () => 'select',
		selectedElements: computed(() => []),
		selectElement: vi.fn(),
		ribbonUpdateTextStyle: vi.fn(),
		addSlide: vi.fn(),
		openHyperlinkForSelection: vi.fn(),
		toggleFormatPainter: vi.fn(),
		applyFormatToTarget: vi.fn(),
		cancelFormatPainter: vi.fn(),
		...overrides,
	};
	const { onEditorKeydown } = useEditorKeyboard(input);
	return { onEditorKeydown, presentFromBeginning, startPresenting, input };
}

describe('useEditorKeyboard - F5 / Shift+F5 start-show keys', () => {
	it('forwards live paste readiness without consuming an empty clipboard chord', () => {
		const available = ref(false);
		const { onEditorKeydown, input } = setup({ canPaste: () => available.value });
		const empty = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
		onEditorKeydown(empty);
		expect(empty.defaultPrevented).toBeFalsy();
		expect(input.pasteElement).not.toHaveBeenCalled();
		available.value = true;
		const populated = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
		onEditorKeydown(populated);
		expect(populated.defaultPrevented).toBeTruthy();
		expect(input.pasteElement).toHaveBeenCalledOnce();
	});

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

function mod(init: { key: string; ctrlKey?: boolean; shiftKey?: boolean }): KeyboardEvent {
	return new KeyboardEvent('keydown', {
		key: init.key,
		ctrlKey: init.ctrlKey ?? true,
		shiftKey: init.shiftKey ?? false,
		cancelable: true,
	});
}

describe('useEditorKeyboard - PowerPoint text and navigation shortcuts', () => {
	it('ctrl+E aligns the current selection via ribbonUpdateTextStyle', () => {
		const { onEditorKeydown, input } = setup({ hasSelection: computed(() => true) });
		onEditorKeydown(mod({ key: 'e' }));
		expect(input.ribbonUpdateTextStyle).toHaveBeenCalledWith({ align: 'center' });
	});

	it('ctrl+] steps the font size up along the ladder', () => {
		const { onEditorKeydown, input } = setup({
			hasSelection: computed(() => true),
			selectedElements: computed(
				() => [{ id: 'a', type: 'text', textStyle: { fontSize: 16 } }] as never,
			),
		});
		onEditorKeydown(mod({ key: ']' }));
		// 16px is 12pt; the next rung up is 14pt, back to px.
		expect(input.ribbonUpdateTextStyle).toHaveBeenCalledWith({
			fontSize: expect.closeTo(14 * (96 / 72), 5),
		});
	});

	it('ctrl+Shift+C arms the format painter and Ctrl+Shift+V applies it to the selection', () => {
		const { onEditorKeydown, input } = setup({
			hasSelection: computed(() => true),
			selectedElementIds: ref(['a', 'b']),
		});
		onEditorKeydown(mod({ key: 'c', shiftKey: true }));
		expect(input.toggleFormatPainter).toHaveBeenCalledOnce();
		onEditorKeydown(mod({ key: 'v', shiftKey: true }));
		expect(input.applyFormatToTarget).toHaveBeenCalledWith('a');
		expect(input.applyFormatToTarget).toHaveBeenCalledWith('b');
		expect(input.cancelFormatPainter).toHaveBeenCalledOnce();
	});

	it('ctrl+M inserts a new slide', () => {
		const { onEditorKeydown, input } = setup();
		onEditorKeydown(mod({ key: 'm' }));
		expect(input.addSlide).toHaveBeenCalledOnce();
	});

	it('ctrl+K opens the hyperlink dialog for the selection', () => {
		const { onEditorKeydown, input } = setup({ hasSelection: computed(() => true) });
		onEditorKeydown(mod({ key: 'k' }));
		expect(input.openHyperlinkForSelection).toHaveBeenCalledOnce();
	});

	it('ctrl+H toggles the same find/replace panel as Ctrl+F', () => {
		const findOpen = ref(false);
		const { onEditorKeydown } = setup({ findOpen });
		onEditorKeydown(mod({ key: 'h' }));
		expect(findOpen.value).toBeTruthy();
	});

	it('ctrl+Space clears character formatting on the selection', () => {
		const { onEditorKeydown, input } = setup({ hasSelection: computed(() => true) });
		onEditorKeydown(mod({ key: ' ' }));
		expect(input.ribbonUpdateTextStyle).toHaveBeenCalledWith({
			bold: false,
			italic: false,
			underline: false,
			strikethrough: false,
			highlightColor: undefined,
		});
	});

	it('tab cycles the selection to the next element on the slide', () => {
		const selectElement = vi.fn();
		const { onEditorKeydown } = setup({
			activeSlide: computed(() => ({ id: 's1', elements: [{ id: 'a' }, { id: 'b' }] }) as never),
			selectedElementIds: ref(['a']),
			selectElement,
		});
		onEditorKeydown(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
		expect(selectElement).toHaveBeenCalledWith('b', false);
	});

	it('shift+Tab cycles the selection to the previous element on the slide', () => {
		const selectElement = vi.fn();
		const { onEditorKeydown } = setup({
			activeSlide: computed(() => ({ id: 's1', elements: [{ id: 'a' }, { id: 'b' }] }) as never),
			selectedElementIds: ref(['b']),
			selectElement,
		});
		onEditorKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
		expect(selectElement).toHaveBeenCalledWith('a', false);
	});
});
