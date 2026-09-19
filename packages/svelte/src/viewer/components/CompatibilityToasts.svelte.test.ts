/**
 * CompatibilityToasts.svelte: the bottom-right load-diagnostic stack.
 *
 * The viewer root this stack is anchored to spans the FULL chrome width,
 * including a right-docked format/inspector panel when one is open, so
 * without `rightInset` the stack's `right: 12px` lands under that panel's
 * own content (it visually overlapped the Properties panel's "Presentation"
 * section) instead of clear of it. Mirrors React's/Vue's/Angular's
 * equivalent regression test.
 */
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CompatibilityToasts from './CompatibilityToasts.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountToasts(
	toasts: readonly CompatibilityWarningToast[],
	rightInset?: number,
	bottomInset?: number,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(CompatibilityToasts, {
		target,
		props: {
			toasts,
			overflowCount: 0,
			ondismiss: vi.fn(),
			ondismissall: vi.fn(),
			rightInset,
			bottomInset,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

const toast: CompatibilityWarningToast = {
	id: 'UNMODELLED_SLIDE_MARKUP',
	code: 'UNMODELLED_SLIDE_MARKUP',
	severity: 'warning',
	messageKey: 'pptx.compatibility.unmodelledSlideMarkup',
};

describe('svelte compatibilityToasts', () => {
	it('defaults rightInset to 0 (no panel open)', () => {
		const target = mountToasts([toast]);
		const stack = target.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
		expect(stack.style.right).toBe('12px');
	});

	it('adds rightInset (the open format/inspector panel width) to the right offset', () => {
		const target = mountToasts([toast], 288);
		const stack = target.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
		expect(stack.style.right).toBe('300px');
		expect(stack.style.maxWidth).toBe('calc(100% - 300px)');
	});

	// The docked "Speaker notes" strip sits between the canvas and the status
	// bar in the same containing block, so the stack must clear its height.
	it('adds bottomInset (the measured notes-strip height) to the bottom offset', () => {
		const bottomOf = (bottomInset?: number): number => {
			const target = mountToasts([toast], 0, bottomInset);
			const stack = target.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
			const value = Number.parseFloat(stack.style.bottom);
			cleanup?.();
			cleanup = undefined;
			return value;
		};
		expect(bottomOf(52)).toBe(bottomOf() + 52);
	});
});
