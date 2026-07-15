// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { activateModalFocus } from './modal-focus';

afterEach(() => {
	document.body.replaceChildren();
});

function setup(): {
	opener: HTMLButtonElement;
	panel: HTMLDivElement;
	controls: HTMLButtonElement[];
} {
	const opener = document.createElement('button');
	opener.textContent = 'Open';
	const panel = document.createElement('div');
	panel.tabIndex = -1;
	const first = document.createElement('button');
	const last = document.createElement('button');
	panel.append(first, last);
	document.body.append(opener, panel);
	opener.focus();
	return { opener, panel, controls: [first, last] };
}

describe('activateModalFocus', () => {
	it('moves focus into the modal and restores the opener', async () => {
		const { opener, panel, controls } = setup();
		const release = activateModalFocus(panel);
		await Promise.resolve();
		expect(document.activeElement).toBe(controls[0]);
		release();
		expect(document.activeElement).toBe(opener);
	});

	it('wraps Tab and Shift+Tab within the modal', async () => {
		const { panel, controls } = setup();
		const release = activateModalFocus(panel);
		await Promise.resolve();
		controls[1].focus();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		expect(document.activeElement).toBe(controls[0]);
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
		);
		expect(document.activeElement).toBe(controls[1]);
		release();
	});

	it('consumes Escape and invokes the close callback', async () => {
		const { panel } = setup();
		const onEscape = vi.fn();
		const release = activateModalFocus(panel, { onEscape });
		await Promise.resolve();
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		document.dispatchEvent(event);
		expect(event.defaultPrevented).toBeTruthy();
		expect(onEscape).toHaveBeenCalledOnce();
		release();
	});
});
