import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createReadOnlyBanner } from './read-only-banner';

const NOT_CHECKING = { promptOpen: false, error: null, checking: false } as const;

function mount() {
	const onEditAnyway = vi.fn();
	const onDismiss = vi.fn();
	const onSubmitPassword = vi.fn();
	const onCancelPassword = vi.fn();
	const banner = createReadOnlyBanner(
		document,
		(key) => key,
		onEditAnyway,
		onDismiss,
		onSubmitPassword,
		onCancelPassword,
	);
	return { banner, onEditAnyway, onDismiss, onSubmitPassword, onCancelPassword };
}

const MODIFY_VERIFIER: ReadOnlyRecommendation = {
	kind: 'modifyVerifier',
	messageKey: 'pptx.readOnly.modifyVerifierRecommended',
	defaultReadOnly: true,
	requiresPassword: false,
};

const PASSWORD_PROTECTED: ReadOnlyRecommendation = {
	kind: 'modifyVerifier',
	messageKey: 'pptx.readOnly.modifyVerifierRecommended',
	defaultReadOnly: true,
	requiresPassword: true,
};

const MARKED_FINAL: ReadOnlyRecommendation = {
	kind: 'markedFinal',
	messageKey: 'pptx.readOnly.markedFinal',
	defaultReadOnly: true,
	requiresPassword: false,
};

describe('read-only recommendation banner', () => {
	it('starts hidden', () => {
		const { banner } = mount();

		expect(banner.el.hidden).toBeTruthy();
	});

	it('shows the modifyVerifier recommendation with its kind and message', () => {
		const { banner } = mount();

		banner.update(MODIFY_VERIFIER, false, NOT_CHECKING);

		expect(banner.el.hidden).toBeFalsy();
		expect(banner.el.dataset.kind).toBe('modifyVerifier');
		expect(banner.el.textContent).toContain('pptx.readOnly.modifyVerifierRecommended');
	});

	it('shows the markedFinal recommendation with its own kind and message', () => {
		const { banner } = mount();

		banner.update(MARKED_FINAL, false, NOT_CHECKING);

		expect(banner.el.dataset.kind).toBe('markedFinal');
		expect(banner.el.textContent).toContain('pptx.readOnly.markedFinal');
	});

	it('stays hidden when there is no recommendation', () => {
		const { banner } = mount();

		banner.update(null, false, NOT_CHECKING);

		expect(banner.el.hidden).toBeTruthy();
	});

	it('hides when dismissed even with a live recommendation', () => {
		const { banner } = mount();

		banner.update(MODIFY_VERIFIER, true, NOT_CHECKING);

		expect(banner.el.hidden).toBeTruthy();
	});

	it('fires onEditAnyway from the edit-anyway button', () => {
		const { banner, onEditAnyway } = mount();
		banner.update(MODIFY_VERIFIER, false, NOT_CHECKING);

		banner.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-edit-anyway"]')!
			.click();

		expect(onEditAnyway).toHaveBeenCalledOnce();
	});

	it('fires onDismiss from the dismiss button', () => {
		const { banner, onDismiss } = mount();
		banner.update(MODIFY_VERIFIER, false, NOT_CHECKING);

		banner.el.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-dismiss"]')!.click();

		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it('carries the pptx-readonly-banner testid', () => {
		const { banner } = mount();

		expect(banner.el.dataset.testid).toBe('pptx-readonly-banner');
	});

	describe('password prompt', () => {
		it('shows the password form instead of the edit-anyway/dismiss buttons when open', () => {
			const { banner } = mount();
			banner.update(PASSWORD_PROTECTED, false, { promptOpen: true, error: null, checking: false });

			const form = banner.el.querySelector<HTMLFormElement>(
				'[data-testid="pptx-readonly-password-form"]',
			)!;
			expect(form.hidden).toBeFalsy();
			expect(
				banner.el.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-edit-anyway"]')!
					.hidden,
			).toBeTruthy();
			expect(
				banner.el.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-dismiss"]')!.hidden,
			).toBeTruthy();
			const input = banner.el.querySelector<HTMLInputElement>(
				'[data-testid="pptx-readonly-password-input"]',
			)!;
			expect(input.type).toBe('password');
			expect(input.getAttribute('aria-invalid')).toBe('false');
		});

		it('submits the typed password on form submit', () => {
			const { banner, onSubmitPassword } = mount();
			banner.update(PASSWORD_PROTECTED, false, { promptOpen: true, error: null, checking: false });

			const form = banner.el.querySelector<HTMLFormElement>(
				'[data-testid="pptx-readonly-password-form"]',
			)!;
			const input = banner.el.querySelector<HTMLInputElement>(
				'[data-testid="pptx-readonly-password-input"]',
			)!;
			input.value = 'secret';
			form.dispatchEvent(new Event('submit', { cancelable: true }));

			expect(onSubmitPassword).toHaveBeenCalledWith('secret');
		});

		it('fires onCancelPassword from the cancel button', () => {
			const { banner, onCancelPassword } = mount();
			banner.update(PASSWORD_PROTECTED, false, { promptOpen: true, error: null, checking: false });

			banner.el
				.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-password-cancel"]')!
				.click();

			expect(onCancelPassword).toHaveBeenCalledOnce();
		});

		it('marks the input aria-invalid and shows the error text on wrong-password', () => {
			const { banner } = mount();
			banner.update(PASSWORD_PROTECTED, false, {
				promptOpen: true,
				error: 'wrong-password',
				checking: false,
			});

			const input = banner.el.querySelector<HTMLInputElement>(
				'[data-testid="pptx-readonly-password-input"]',
			)!;
			expect(input.getAttribute('aria-invalid')).toBe('true');
			const error = banner.el.querySelector<HTMLElement>(
				'[data-testid="pptx-readonly-password-error"]',
			)!;
			expect(error.hidden).toBeFalsy();
			expect(error.getAttribute('role')).toBe('alert');
			expect(error.textContent).toContain('pptx.readOnly.wrongPassword');
		});

		it('disables the input and unlock button while checking', () => {
			const { banner } = mount();
			banner.update(PASSWORD_PROTECTED, false, { promptOpen: true, error: null, checking: true });

			expect(
				banner.el.querySelector<HTMLInputElement>('[data-testid="pptx-readonly-password-input"]')!
					.disabled,
			).toBeTruthy();
			expect(
				banner.el.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-unlock"]')!
					.disabled,
			).toBeTruthy();
		});
	});
});
