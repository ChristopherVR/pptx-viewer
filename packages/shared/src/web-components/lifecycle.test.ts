// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';
import type { PptxUiSlideShowOptionsElement } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('shared web control lifecycle', () => {
	it('keeps separate option state and one intent listener after disconnect/reconnect', () => {
		const first = document.createElement(
			'pptx-ui-slide-show-options',
		) as PptxUiSlideShowOptionsElement;
		const second = document.createElement(
			'pptx-ui-slide-show-options',
		) as PptxUiSlideShowOptionsElement;
		first.presentationProperties = { advanceMode: 'manual' };
		second.presentationProperties = { advanceMode: 'useTimings' };
		document.body.append(first, second);
		const firstEdit = vi.fn();
		const secondEdit = vi.fn();
		first.addEventListener('show-options-change', firstEdit);
		second.addEventListener('show-options-change', secondEdit);
		for (let i = 0; i < 3; i++) {
			first.remove();
			document.body.append(first);
		}
		const timing = (host: HTMLElement) =>
			host.shadowRoot!.querySelectorAll<HTMLElement & { checked: boolean }>('pptx-ui-checkbox')[1];
		expect(timing(first).checked).toBeFalsy();
		expect(timing(second).checked).toBeTruthy();
		timing(first).click();
		expect(firstEdit).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ detail: { advanceMode: 'useTimings' } }),
		);
		expect(secondEdit).not.toHaveBeenCalled();
		expect(timing(first).checked).toBeFalsy();
		expect(timing(second).checked).toBeTruthy();
	});

	it('closes select popups, releases global listeners and clears typeahead on disconnect', () => {
		const select = document.createElement('pptx-ui-select');
		select.innerHTML = '<option value="a">Alpha</option><option value="b">Beta</option>';
		document.body.append(select);
		const trigger = select.shadowRoot!.querySelector('button')!;
		const removeDocument = vi.spyOn(document, 'removeEventListener');
		const removeWindow = vi.spyOn(window, 'removeEventListener');
		const clear = vi.spyOn(window, 'clearTimeout');
		const event = new KeyboardEvent('keydown', { key: 'b', bubbles: true });
		trigger.dispatchEvent(event);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		select.remove();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(removeDocument).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
		expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(removeWindow).toHaveBeenCalledWith('scroll', expect.any(Function), true);
		expect(clear).toHaveBeenCalledWith(expect.any(Number));
		document.body.append(select);
		const change = vi.fn();
		select.addEventListener('change', change);
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(select.value).toBe('a');
		expect(change).not.toHaveBeenCalled();
	});
});
