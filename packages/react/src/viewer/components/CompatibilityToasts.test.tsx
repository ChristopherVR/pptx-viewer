// @vitest-environment happy-dom
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompatibilityToasts } from './CompatibilityToasts';

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

const toasts: CompatibilityWarningToast[] = [
	{
		id: 'UNMODELLED_SLIDE_MARKUP',
		code: 'UNMODELLED_SLIDE_MARKUP',
		severity: 'warning',
		messageKey: 'pptx.compatibility.unmodelledSlideMarkup',
	},
];

describe('compatibilityToasts', () => {
	it('renders nothing when there are no toasts', () => {
		act(() =>
			root.render(<CompatibilityToasts toasts={[]} onDismiss={() => {}} onDismissAll={() => {}} />),
		);
		expect(container.querySelector('[data-testid="pptx-compat-toasts"]')).toBeNull();
	});

	it('renders one toast with its code/severity attributes', () => {
		act(() =>
			root.render(
				<CompatibilityToasts toasts={toasts} onDismiss={() => {}} onDismissAll={() => {}} />,
			),
		);
		const stack = container.querySelector('[data-testid="pptx-compat-toasts"]');
		expect(stack).not.toBeNull();
		const toast = container.querySelector('[data-testid="pptx-compat-toast"]');
		expect(toast?.getAttribute('data-code')).toBe('UNMODELLED_SLIDE_MARKUP');
		expect(toast?.getAttribute('data-severity')).toBe('warning');
	});

	it('calls onDismiss with the toast id', () => {
		const onDismiss = vi.fn();
		act(() =>
			root.render(
				<CompatibilityToasts toasts={toasts} onDismiss={onDismiss} onDismissAll={() => {}} />,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-compat-toast-dismiss"]',
		) as HTMLButtonElement;
		act(() => button.click());
		expect(onDismiss).toHaveBeenCalledWith('UNMODELLED_SLIDE_MARKUP');
	});

	it('shows "Dismiss all" only with more than one toast, and calls onDismissAll', () => {
		const onDismissAll = vi.fn();
		const twoToasts: CompatibilityWarningToast[] = [
			...toasts,
			{
				id: 'EXTERNAL_IMAGE_REFERENCE',
				code: 'EXTERNAL_IMAGE_REFERENCE',
				severity: 'info',
				messageKey: 'pptx.compatibility.externalImageReference',
			},
		];
		act(() =>
			root.render(
				<CompatibilityToasts toasts={twoToasts} onDismiss={() => {}} onDismissAll={onDismissAll} />,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-compat-toasts-dismiss-all"]',
		) as HTMLButtonElement;
		expect(button).not.toBeNull();
		act(() => button.click());
		expect(onDismissAll).toHaveBeenCalledOnce();
	});
});
