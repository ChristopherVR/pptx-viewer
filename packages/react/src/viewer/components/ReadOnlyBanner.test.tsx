// @vitest-environment happy-dom
import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadOnlyBanner } from './ReadOnlyBanner';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const modifyVerifierRecommendation: ReadOnlyRecommendation = {
	kind: 'modifyVerifier',
	messageKey: 'pptx.readOnly.modifyVerifierRecommended',
	defaultReadOnly: true,
	requiresPassword: false,
};

describe('readOnlyBanner', () => {
	it('carries the pptx-readonly-banner testid with data-kind set from the recommendation', () => {
		act(() =>
			root.render(
				<ReadOnlyBanner
					recommendation={modifyVerifierRecommendation}
					onEditAnyway={() => {}}
					onDismiss={() => {}}
				/>,
			),
		);
		const banner = container.querySelector('[data-testid="pptx-readonly-banner"]');
		expect(banner).not.toBeNull();
		expect(banner?.getAttribute('data-kind')).toBe('modifyVerifier');
	});

	it('calls onEditAnyway when "Edit anyway" is clicked', () => {
		const onEditAnyway = vi.fn();
		act(() =>
			root.render(
				<ReadOnlyBanner
					recommendation={modifyVerifierRecommendation}
					onEditAnyway={onEditAnyway}
					onDismiss={() => {}}
				/>,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-readonly-edit-anyway"]',
		) as HTMLButtonElement;
		act(() => button.click());
		expect(onEditAnyway).toHaveBeenCalledOnce();
	});

	it('calls onDismiss when "Dismiss" is clicked', () => {
		const onDismiss = vi.fn();
		act(() =>
			root.render(
				<ReadOnlyBanner
					recommendation={modifyVerifierRecommendation}
					onEditAnyway={() => {}}
					onDismiss={onDismiss}
				/>,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-readonly-dismiss"]',
		) as HTMLButtonElement;
		act(() => button.click());
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	describe('password prompt', () => {
		it('renders the password form instead of the two buttons when open', () => {
			act(() =>
				root.render(
					<ReadOnlyBanner
						recommendation={modifyVerifierRecommendation}
						onEditAnyway={() => {}}
						onDismiss={() => {}}
						passwordPromptOpen
						onSubmitPassword={() => {}}
						onCancelPassword={() => {}}
					/>,
				),
			);
			expect(container.querySelector('[data-testid="pptx-readonly-password-form"]')).not.toBeNull();
			expect(container.querySelector('[data-testid="pptx-readonly-edit-anyway"]')).toBeNull();
			expect(container.querySelector('[data-testid="pptx-readonly-dismiss"]')).toBeNull();
			const input = container.querySelector(
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			expect(input.type).toBe('password');
			expect(input.getAttribute('aria-invalid')).toBe('false');
		});

		it('submits the typed password when "Unlock" is clicked', () => {
			const onSubmitPassword = vi.fn();
			act(() =>
				root.render(
					<ReadOnlyBanner
						recommendation={modifyVerifierRecommendation}
						onEditAnyway={() => {}}
						onDismiss={() => {}}
						passwordPromptOpen
						onSubmitPassword={onSubmitPassword}
						onCancelPassword={() => {}}
					/>,
				),
			);
			const input = container.querySelector(
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			const nativeSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)?.set;
			act(() => {
				nativeSetter?.call(input, 'secret');
				input.dispatchEvent(new Event('input', { bubbles: true }));
			});
			const unlockButton = container.querySelector(
				'[data-testid="pptx-readonly-unlock"]',
			) as HTMLButtonElement;
			act(() => unlockButton.click());
			expect(onSubmitPassword).toHaveBeenCalledWith('secret');
		});

		it('calls onCancelPassword when "Cancel" is clicked', () => {
			const onCancelPassword = vi.fn();
			act(() =>
				root.render(
					<ReadOnlyBanner
						recommendation={modifyVerifierRecommendation}
						onEditAnyway={() => {}}
						onDismiss={() => {}}
						passwordPromptOpen
						onSubmitPassword={() => {}}
						onCancelPassword={onCancelPassword}
					/>,
				),
			);
			const cancelButton = container.querySelector(
				'[data-testid="pptx-readonly-password-cancel"]',
			) as HTMLButtonElement;
			act(() => cancelButton.click());
			expect(onCancelPassword).toHaveBeenCalledOnce();
		});

		it('marks the input aria-invalid and shows the error text on wrong-password', () => {
			act(() =>
				root.render(
					<ReadOnlyBanner
						recommendation={modifyVerifierRecommendation}
						onEditAnyway={() => {}}
						onDismiss={() => {}}
						passwordPromptOpen
						passwordError='wrong-password'
						onSubmitPassword={() => {}}
						onCancelPassword={() => {}}
					/>,
				),
			);
			const input = container.querySelector(
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			expect(input.getAttribute('aria-invalid')).toBe('true');
			const error = container.querySelector('[data-testid="pptx-readonly-password-error"]');
			expect(error).not.toBeNull();
			expect(error?.getAttribute('role')).toBe('alert');
		});
	});
});
