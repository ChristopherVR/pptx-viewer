// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { COMPAT_TOAST_VISIBLE_LIMIT } from '../render';
import type { CompatToastViewItem } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const q = <T extends Element>(host: HTMLElement, selector: string) =>
	host.shadowRoot!.querySelector<T>(selector);
const listen = (host: HTMLElement, type: string) => {
	const spy = vi.fn();
	host.addEventListener(type, (event) => spy((event as CustomEvent).detail));
	return spy;
};

describe('pptx-ui-read-only-banner', () => {
	const mount = (state = {}) => {
		const host = document.createElement('pptx-ui-read-only-banner');
		host.state = { kind: 'markAsFinal', messageKey: 'msg', ...state };
		document.body.append(host);
		return host;
	};

	it('renders the message, host hooks and the two actions', () => {
		const host = mount({ translate: (key: string) => `t:${key}` });
		expect(host.dataset.testid).toBe('pptx-readonly-banner');
		expect(host.dataset.kind).toBe('markAsFinal');
		expect(q(host, '.text')!.textContent).toBe('t:pptx.readOnly.bannerTitle: t:msg');
		expect(q<HTMLElement>(host, '[data-testid="pptx-readonly-edit-anyway"]')!.hidden).toBeFalsy();
		expect(
			q<HTMLElement>(host, '[data-testid="pptx-readonly-password-form"]')!.hidden,
		).toBeTruthy();
	});

	it('emits one intent per action', () => {
		const host = mount();
		const spy = listen(host, 'read-only-request');
		q<HTMLButtonElement>(host, '[data-testid="pptx-readonly-edit-anyway"]')!.click();
		q<HTMLButtonElement>(host, '[data-testid="pptx-readonly-dismiss"]')!.click();
		expect(spy.mock.calls).toStrictEqual([[{ id: 'editAnyway' }], [{ id: 'dismiss' }]]);
	});

	it('swaps to the password form, focuses it and submits the typed password', () => {
		const host = mount();
		host.state = { ...host.state, passwordPromptOpen: true };
		const input = q<HTMLInputElement>(host, '[data-testid="pptx-readonly-password-input"]')!;
		expect(host.shadowRoot!.activeElement).toBe(input);
		expect(q<HTMLElement>(host, '[data-testid="pptx-readonly-edit-anyway"]')!.hidden).toBeTruthy();
		const spy = listen(host, 'read-only-request');
		input.value = 'letmeedit123';
		q<HTMLButtonElement>(host, '[data-testid="pptx-readonly-unlock"]')!.form!.requestSubmit();
		q<HTMLButtonElement>(host, '[data-testid="pptx-readonly-password-cancel"]')!.click();
		expect(spy).toHaveBeenCalledWith({ id: 'submitPassword', password: 'letmeedit123' });
		expect(spy).toHaveBeenCalledWith({ id: 'cancelPassword' });
	});

	it('reflects the error and busy state and clears the input when the prompt closes', () => {
		const host = mount({ passwordPromptOpen: true });
		const input = q<HTMLInputElement>(host, '[data-testid="pptx-readonly-password-input"]')!;
		input.value = 'wrong';
		host.state = {
			...host.state,
			passwordError: 'wrong-password',
			checkingPassword: true,
		};
		const error = q<HTMLElement>(host, '[data-testid="pptx-readonly-password-error"]')!;
		expect(error.hidden).toBeFalsy();
		expect(error.textContent).toBe('pptx.readOnly.wrongPassword');
		expect(error.getAttribute('role')).toBe('alert');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(error.id);
		expect(input.disabled).toBeTruthy();
		host.state = { ...host.state, passwordPromptOpen: false, passwordError: null };
		expect(input.value).toBe('');
	});
});

describe('pptx-ui-paste-options', () => {
	it('positions the strip, names it and emits the chosen format', () => {
		const host = document.createElement('pptx-ui-paste-options');
		host.state = { left: 100, top: 50, translate: (key: string) => `t:${key}` };
		document.body.append(host);
		expect(host.hasAttribute('data-pptx-paste-options')).toBeTruthy();
		const toolbar = q<HTMLElement>(host, '[role="toolbar"]')!;
		expect(toolbar.style.left).toBe('104px');
		expect(toolbar.style.top).toBe('54px');
		expect(toolbar.getAttribute('aria-label')).toBe('t:pptx.pasteSpecial.optionsLabel');
		const buttons = host.shadowRoot!.querySelectorAll('button');
		expect(buttons).toHaveLength(4);
		expect(buttons[2].textContent).toBe('t:pptx.pasteSpecial.picture');
		expect(buttons[2].title).toBe('t:pptx.pasteSpecial.picture');
		const spy = listen(host, 'paste-options-request');
		buttons[2].click();
		expect(spy).toHaveBeenCalledWith({ format: 'picture' });
	});

	it('arms outside dismissal after a task and ignores presses on the strip', async () => {
		vi.useFakeTimers();
		try {
			const host = document.createElement('pptx-ui-paste-options');
			host.state = { left: 0, top: 0 };
			document.body.append(host);
			const spy = listen(host, 'paste-options-dismiss');
			document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
			expect(spy).not.toHaveBeenCalled();
			await vi.runAllTimersAsync();
			q<HTMLElement>(host, '[role="toolbar"]')!.dispatchEvent(
				new Event('pointerdown', { bubbles: true, composed: true }),
			);
			expect(spy).not.toHaveBeenCalled();
			document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
			document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
			expect(spy).toHaveBeenCalledTimes(2);
			host.remove();
			document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
			expect(spy).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('pptx-ui-compat-toasts', () => {
	const toast = (n: number, severity: 'info' | 'warning' = 'warning'): CompatToastViewItem => ({
		id: `id${n}`,
		code: `CODE_${n}`,
		severity,
		messageKey: `msg${n}`,
	});

	it('hides when empty and positions itself against the viewer root', () => {
		const host = document.createElement('pptx-ui-compat-toasts');
		host.state = { toasts: [], rightInset: 288, bottomInset: 40 };
		document.body.append(host);
		expect(host.hidden).toBeTruthy();
		expect(host.dataset.testid).toBe('pptx-compat-toasts');
		expect(host.style.position).toBe('absolute');
		expect(host.style.right).toBe('300px');
		expect(host.style.pointerEvents).toBe('none');
	});

	it('renders toast hooks, caps the list and shows the overflow count', () => {
		const host = document.createElement('pptx-ui-compat-toasts');
		const toasts = Array.from({ length: COMPAT_TOAST_VISIBLE_LIMIT + 2 }, (_, i) => toast(i));
		host.state = { toasts, overflowCount: 1 };
		document.body.append(host);
		const items = host.shadowRoot!.querySelectorAll('[data-testid="pptx-compat-toast"]');
		expect(items).toHaveLength(COMPAT_TOAST_VISIBLE_LIMIT);
		expect(items[0].getAttribute('data-code')).toBe('CODE_0');
		expect(items[0].getAttribute('data-severity')).toBe('warning');
		expect(q(host, '.overflow')!.textContent).toBe('+3');
	});

	it('emits dismiss and dismiss-all intents and keeps focus across inset updates', () => {
		const host = document.createElement('pptx-ui-compat-toasts');
		host.state = { toasts: [toast(1), toast(2, 'info')] };
		document.body.append(host);
		const spy = listen(host, 'compat-toasts-request');
		const dismiss = host.shadowRoot!.querySelectorAll<HTMLButtonElement>(
			'[data-testid="pptx-compat-toast-dismiss"]',
		);
		expect(dismiss[0].getAttribute('aria-label')).toBe('pptx.compatibility.dismiss');
		dismiss[1].click();
		q<HTMLButtonElement>(host, '[data-testid="pptx-compat-toasts-dismiss-all"]')!.click();
		expect(spy.mock.calls).toStrictEqual([
			[{ id: 'dismiss', toastId: 'id2' }],
			[{ id: 'dismissAll' }],
		]);
		dismiss[1].focus();
		host.state = { ...host.state, bottomInset: 80 };
		expect(host.shadowRoot!.activeElement).toBe(dismiss[1]);
	});
});

describe('pptx-ui-dialog-footer', () => {
	it('renders variants, icons, disabled state and hooks, and emits the action id', () => {
		const host = document.createElement('pptx-ui-dialog-footer');
		host.state = {
			actions: [
				{ id: 'cancel', label: 'Cancel', variant: 'secondary', testId: 'cancel-hook' },
				{ id: 'ok', label: 'Print', variant: 'primary', icon: 'print' },
				{ id: 'busy', label: 'Wait', disabled: true },
			],
		};
		document.body.append(host);
		const buttons = host.shadowRoot!.querySelectorAll('button');
		expect(Array.from(buttons).map((b) => b.textContent)).toStrictEqual([
			'Cancel',
			'Print',
			'Wait',
		]);
		expect(buttons[0].dataset.testid).toBe('cancel-hook');
		expect(buttons[1].className).toBe('primary');
		expect(buttons[1].querySelector('svg')).not.toBeNull();
		expect(buttons[2].disabled).toBeTruthy();
		const spy = listen(host, 'dialog-footer-request');
		buttons[1].click();
		expect(spy).toHaveBeenCalledWith({ id: 'ok' });
	});

	it('keeps the focused action when the actions change around it', () => {
		const host = document.createElement('pptx-ui-dialog-footer');
		const actions = [
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B', variant: 'primary' as const },
		];
		host.state = { actions };
		document.body.append(host);
		host.shadowRoot!.querySelectorAll('button')[1].focus();
		host.state = { actions: [...actions, { id: 'c', label: 'C' }] };
		expect((host.shadowRoot!.activeElement as HTMLElement).dataset.action).toBe('b');
	});
});
