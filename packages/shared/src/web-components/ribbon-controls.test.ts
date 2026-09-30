// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

describe('shared ribbon controls', () => {
	it('reserves native activation keys while letting global shortcuts bubble', () => {
		const host = document.createElement('pptx-ui-ribbon-command');
		document.body.append(host);
		const button = host.shadowRoot!.querySelector('button')!;
		const keyboard = vi.fn();
		host.addEventListener('keydown', keyboard);
		for (const key of [' ', 'Enter']) {
			const event = new KeyboardEvent('keydown', {
				key,
				bubbles: true,
				composed: true,
				cancelable: true,
			});
			button.dispatchEvent(event);
			expect(event.defaultPrevented).toBeFalsy();
		}
		expect(keyboard).not.toHaveBeenCalled();
		button.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'F5', bubbles: true, composed: true }),
		);
		expect(keyboard).toHaveBeenCalledOnce();
	});

	it('registers idempotently and reflects button state without requesting an action', () => {
		const ctor = customElements.get('pptx-ui-ribbon-command');
		registerPptxWebControls();
		expect(customElements.get('pptx-ui-ribbon-command')).toBe(ctor);
		const host = document.createElement('pptx-ui-ribbon-command');
		host.setAttribute('data-ribbon-control', 'slideShow.setUp.hideSlide');
		host.setAttribute('label', 'Hide Slide');
		host.setAttribute('pressed', 'false');
		document.body.append(host);
		const button = host.shadowRoot!.querySelector('button')!;
		const request = vi.fn();
		host.addEventListener('command-request', request);
		host.setAttribute('pressed', 'true');
		host.setAttribute('label', '<Hide>');
		expect(button.textContent).toBe('<Hide>');
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(request).not.toHaveBeenCalled();
		button.click();
		expect(request).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				detail: { id: 'slideShow.setUp.hideSlide' },
				bubbles: true,
				composed: true,
			}),
		);
		host.setAttribute('disabled', '');
		button.click();
		expect(button.disabled).toBeTruthy();
		expect(request).toHaveBeenCalledOnce();
	});

	it('reflects expanded state and clears optional aria attributes', () => {
		const host = document.createElement('pptx-ui-ribbon-command');
		host.setAttribute('expanded', 'false');
		document.body.append(host);
		const button = host.shadowRoot!.querySelector('button')!;
		expect(button.getAttribute('aria-expanded')).toBe('false');
		host.removeAttribute('expanded');
		expect(button.hasAttribute('aria-expanded')).toBeFalsy();
		expect(button.hasAttribute('aria-pressed')).toBeFalsy();
	});

	it('controls toggle state through a single label intent and accepts a host commit', () => {
		const host = document.createElement('pptx-ui-ribbon-toggle');
		host.setAttribute('data-ribbon-control', 'slideShow.captions.subtitles');
		host.setAttribute('label', 'Subtitles');
		document.body.append(host);
		const checkbox = host.shadowRoot!.querySelector<HTMLElement & { checked: boolean }>(
			'pptx-ui-checkbox',
		)!;
		const request = vi.fn();
		host.addEventListener('toggle-request', request);
		host.shadowRoot!.querySelector('label')!.click();
		expect(request).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ detail: { id: 'slideShow.captions.subtitles', checked: true } }),
		);
		expect(checkbox.checked).toBeFalsy();
		host.setAttribute('checked', '');
		expect(checkbox.checked).toBeTruthy();
		expect(request).toHaveBeenCalledOnce();
		host.setAttribute('disabled', '');
		host.shadowRoot!.querySelector('label')!.click();
		expect(request).toHaveBeenCalledOnce();
	});

	it('names a slotted group and leaves control ids available to host customization', () => {
		const host = document.createElement('pptx-ui-ribbon-group');
		host.setAttribute('label', 'Start Slide Show');
		host.innerHTML =
			'<pptx-ui-ribbon-command data-ribbon-control="slideShow.startSlideShow.fromBeginning" label="From Beginning"></pptx-ui-ribbon-command>';
		document.body.append(host);
		expect(host.getAttribute('role')).toBe('group');
		expect(host.getAttribute('aria-label')).toBe('Start Slide Show');
		expect(host.querySelector('[data-ribbon-control]')).not.toBeNull();
		host.setAttribute('label', 'Start');
		expect(host.getAttribute('aria-label')).toBe('Start');
	});
});
