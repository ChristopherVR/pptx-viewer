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

	it('shows "Dismiss all" with a SINGLE toast too, and calls onDismissAll', () => {
		const onDismissAll = vi.fn();
		act(() =>
			root.render(
				<CompatibilityToasts toasts={toasts} onDismiss={() => {}} onDismissAll={onDismissAll} />,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-compat-toasts-dismiss-all"]',
		) as HTMLButtonElement;
		expect(button).not.toBeNull();
		act(() => button.click());
		expect(onDismissAll).toHaveBeenCalledOnce();
	});

	it('positions the stack relative to its containing block, above the status bar', () => {
		act(() =>
			root.render(
				<CompatibilityToasts toasts={toasts} onDismiss={() => {}} onDismissAll={() => {}} />,
			),
		);
		const stack = container.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
		expect(stack.style.position).toBe('absolute');
		// Status bar (29px) + margin (12px): the container must clear the status
		// bar's "Slide show" button, not the viewport bottom.
		expect(stack.style.bottom).toBe('41px');
		expect(stack.style.pointerEvents).toBe('none');
	});

	// The viewer root the stack is anchored to spans the FULL chrome width,
	// including a right-docked format/inspector panel when one is open, so
	// without `rightInset` the stack renders UNDER that panel's own content
	// (it visually overlapped the Properties panel's "Presentation" section)
	// instead of clear of it.
	it('adds rightInset (the open format/inspector panel width) to the right offset', () => {
		act(() =>
			root.render(
				<CompatibilityToasts
					toasts={toasts}
					onDismiss={() => {}}
					onDismissAll={() => {}}
					rightInset={288}
				/>,
			),
		);
		const stack = container.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
		expect(stack.style.right).toBe('300px');
	});

	it('defaults rightInset to 0 when no panel is open', () => {
		act(() =>
			root.render(
				<CompatibilityToasts toasts={toasts} onDismiss={() => {}} onDismissAll={() => {}} />,
			),
		);
		const stack = container.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
		expect(stack.style.right).toBe('12px');
	});

	// The docked "Speaker notes" strip sits between the canvas and the status
	// bar in the same containing block, so the stack must clear its height.
	it('adds bottomInset (the measured notes-strip height) to the bottom offset', () => {
		const render = (bottomInset?: number) => {
			act(() =>
				root.render(
					<CompatibilityToasts
						toasts={toasts}
						onDismiss={() => {}}
						onDismissAll={() => {}}
						bottomInset={bottomInset}
					/>,
				),
			);
			return (container.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement).style
				.bottom;
		};
		const base = Number.parseFloat(render());
		expect(Number.parseFloat(render(52))).toBe(base + 52);
	});
});
