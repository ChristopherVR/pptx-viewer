// @vitest-environment jsdom
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';
import type { PptxUiSlideShowOptionsElement } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

function mount() {
	const host = document.createElement(
		'pptx-ui-slide-show-options',
	) as PptxUiSlideShowOptionsElement;
	host.labels = { useTimings: 'Timings', playNarrations: 'Narration' };
	document.body.append(host);
	const box = (name: string) =>
		host.shadowRoot!.querySelector<
			HTMLElement & {
				checked: boolean;
				disabled: boolean;
			}
		>(`[aria-label="${name}"]`)!;
	return { host, box };
}

describe('shared Slide Show options', () => {
	it('activates once through its label and keeps listeners stable after reconnection', () => {
		const { host } = mount();
		const change = vi.fn();
		host.addEventListener('show-options-change', change);
		host.remove();
		document.body.append(host);
		host.shadowRoot!.querySelectorAll('label')[1].click();
		expect(change).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ detail: { advanceMode: 'manual' } }),
		);
	});

	it('emits one bubbling, composed intent without mutating or retaining uncommitted state', () => {
		const { host, box } = mount();
		const properties = { loopContinuously: true };
		host.presentationProperties = properties;
		const change = vi.fn();
		document.body.addEventListener('show-options-change', change, { once: true });
		box('Timings').click();
		expect(change).toHaveBeenCalledOnce();
		const event = change.mock.calls[0][0] as CustomEvent;
		expect(event.detail).toStrictEqual({ advanceMode: 'manual' });
		expect(event.composed).toBeTruthy();
		expect(box('Timings').checked).toBeTruthy();
		expect(properties).toStrictEqual({ loopContinuously: true });
	});

	it('updates programmatically without emitting and accepts a synchronous host commit', () => {
		const { host, box } = mount();
		const change = vi.fn();
		host.addEventListener('show-options-change', change);
		host.presentationProperties = { advanceMode: 'manual', showWithNarration: false };
		expect(box('Timings').checked).toBeFalsy();
		expect(box('Narration').checked).toBeFalsy();
		expect(change).not.toHaveBeenCalled();
		host.addEventListener('show-options-change', (event) => {
			host.presentationProperties = {
				...host.presentationProperties,
				...(event as CustomEvent).detail,
			};
		});
		box('Narration').dispatchEvent(
			new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
		);
		expect(box('Narration').checked).toBeTruthy();
		expect(change).toHaveBeenCalledOnce();
	});

	it('keeps unsupported and host-disabled options inert through pointer and keyboard', () => {
		const { host, box } = mount();
		const change = vi.fn();
		host.addEventListener('show-options-change', change);
		const unsupported = host.shadowRoot!.querySelector<HTMLElement>('pptx-ui-checkbox')!;
		expect(unsupported.getAttribute('aria-disabled')).toBe('true');
		unsupported.click();
		host.disabled = true;
		box('Timings').click();
		box('Narration').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(box('Timings').tabIndex).toBe(-1);
		expect(change).not.toHaveBeenCalled();
	});
});
