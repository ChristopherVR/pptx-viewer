import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReadOnlyBanner from './ReadOnlyBanner.svelte';

/** The banner renders inside the shared element's open shadow root. */
const inner = (target: HTMLElement, selector: string): HTMLElement | null =>
	target
		.querySelector('pptx-ui-read-only-banner')
		?.shadowRoot?.querySelector<HTMLElement>(selector) ?? null;
const visible = (target: HTMLElement, selector: string): boolean =>
	inner(target, selector)?.hidden === false;

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('readOnlyBanner', () => {
	it('renders nothing when kind is null', () => {
		const target = document.createElement('div');
		const instance = mount(ReadOnlyBanner, {
			target,
			props: {
				kind: null,
				messageKey: 'pptx.readOnly.modifyVerifierRecommended',
				oneditanyway: vi.fn(),
				ondismiss: vi.fn(),
			},
		});
		cleanup = () => unmount(instance);
		flushSync();

		expect(target.querySelector('[data-testid="pptx-readonly-banner"]')).toBeNull();
	});

	it('renders the banner with data-kind and both action buttons, wired to the callbacks', () => {
		const oneditanyway = vi.fn();
		const ondismiss = vi.fn();
		const target = document.createElement('div');
		const instance = mount(ReadOnlyBanner, {
			target,
			props: {
				kind: 'modifyVerifier',
				messageKey: 'pptx.readOnly.modifyVerifierRecommended',
				oneditanyway,
				ondismiss,
			},
		});
		cleanup = () => unmount(instance);
		flushSync();

		const banner = target.querySelector('[data-testid="pptx-readonly-banner"]');
		expect(banner).not.toBeNull();
		expect(banner?.getAttribute('data-kind')).toBe('modifyVerifier');

		(inner(target, '[data-testid="pptx-readonly-edit-anyway"]') as HTMLButtonElement).click();
		expect(oneditanyway).toHaveBeenCalledOnce();

		(inner(target, '[data-testid="pptx-readonly-dismiss"]') as HTMLButtonElement).click();
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	describe('password prompt', () => {
		function mountBanner(props: Record<string, unknown>) {
			const target = document.createElement('div');
			// Attached to the document: a `<form>` submit only fires for a
			// type=submit button click when the form is actually in the DOM tree.
			document.body.appendChild(target);
			const instance = mount(ReadOnlyBanner, {
				target,
				props: {
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					oneditanyway: vi.fn(),
					ondismiss: vi.fn(),
					...props,
				},
			});
			cleanup = () => {
				unmount(instance);
				target.remove();
			};
			flushSync();
			return target;
		}

		it('renders the password form instead of the two buttons when open', () => {
			const target = mountBanner({ passwordpromptopen: true });
			expect(visible(target, '[data-testid="pptx-readonly-password-form"]')).toBeTruthy();
			expect(visible(target, '[data-testid="pptx-readonly-edit-anyway"]')).toBeFalsy();
			expect(visible(target, '[data-testid="pptx-readonly-dismiss"]')).toBeFalsy();
			const input = inner(
				target,
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			expect(input.type).toBe('password');
			expect(input.getAttribute('aria-invalid')).toBe('false');
		});

		it('submits the typed password when "Unlock" is clicked', () => {
			const onsubmitpassword = vi.fn();
			const target = mountBanner({ passwordpromptopen: true, onsubmitpassword });
			const input = inner(
				target,
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			input.value = 'secret';
			(
				inner(target, '[data-testid="pptx-readonly-password-form"]') as HTMLFormElement
			).dispatchEvent(new Event('submit', { cancelable: true }));
			expect(onsubmitpassword).toHaveBeenCalledWith('secret');
		});

		it('calls oncancelpassword when "Cancel" is clicked', () => {
			const oncancelpassword = vi.fn();
			const target = mountBanner({ passwordpromptopen: true, oncancelpassword });
			(inner(target, '[data-testid="pptx-readonly-password-cancel"]') as HTMLButtonElement).click();
			expect(oncancelpassword).toHaveBeenCalledOnce();
		});

		it('marks the input aria-invalid and shows the error text on wrong-password', () => {
			const target = mountBanner({ passwordpromptopen: true, passworderror: 'wrong-password' });
			const input = inner(
				target,
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			expect(input.getAttribute('aria-invalid')).toBe('true');
			const error = inner(target, '[data-testid="pptx-readonly-password-error"]');
			expect(visible(target, '[data-testid="pptx-readonly-password-error"]')).toBeTruthy();
			expect(error?.getAttribute('role')).toBe('alert');
		});
	});
});
