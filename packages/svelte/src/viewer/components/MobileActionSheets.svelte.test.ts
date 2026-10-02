import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MobileActionSheets from './MobileActionSheets.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function open(props: Record<string, unknown> = {}) {
	const editor = { insertElement: vi.fn() };
	const onactivechange = vi.fn();
	const target = document.createElement('div');
	const instance = mount(MobileActionSheets, {
		target,
		props: {
			active: null,
			onactivechange,
			editor,
			slides: [{ id: 's1' }, { id: 's2' }],
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map(),
			current: 0,
			onselect: vi.fn(),
			...props,
		},
	});
	flushSync();
	cleanup = () => unmount(instance);
	const buttons = Array.from(
		target.querySelector('pptx-ui-mobile-bar')!.shadowRoot!.querySelectorAll('button'),
	);
	return { buttons, editor, onactivechange };
}

describe('mobileActionSheets bottom bar adapter', () => {
	it('opens the tapped sheet and quick-inserts a text box for Insert', () => {
		const { buttons, editor, onactivechange } = open();
		buttons[0].click();
		expect(onactivechange).toHaveBeenLastCalledWith('slides');
		buttons[1].click();
		expect(editor.insertElement).toHaveBeenCalledOnce();
		expect(onactivechange).toHaveBeenLastCalledWith(null);
	});

	it('toggles the open sheet closed and reflects it as pressed', () => {
		const { buttons, onactivechange } = open({ active: 'notes' });
		expect(buttons[4].getAttribute('aria-pressed')).toBe('true');
		buttons[4].click();
		expect(onactivechange).toHaveBeenLastCalledWith(null);
	});

	it('disables every slot with no slides', () => {
		const { buttons } = open({ slides: [] });
		expect(buttons.every((button) => button.disabled)).toBeTruthy();
	});
});
