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
	overflowCount = 0,
): {
	target: HTMLElement;
	ondismiss: ReturnType<typeof vi.fn>;
	ondismissall: ReturnType<typeof vi.fn>;
} {
	const ondismiss = vi.fn();
	const ondismissall = vi.fn();
	const target = document.createElement('div');
	const instance = mount(CompatibilityToasts, {
		target,
		props: { toasts, overflowCount, ondismiss, ondismissall },
	});
	cleanup = () => unmount(instance);
	flushSync();
	return { target, ondismiss, ondismissall };
}

describe('compatibilityToasts', () => {
	it('renders nothing for an empty toast list', () => {
		const { target } = mountToasts([]);
		expect(target.querySelector('[data-testid="pptx-compat-toasts"]')).toBeNull();
	});

	it('renders each toast with its code/severity and the overflow count', () => {
		const { target } = mountToasts(
			[
				{
					id: 'A',
					code: 'A',
					severity: 'warning',
					messageKey: 'pptx.compatibility.generic',
					params: { code: 'A' },
				},
				{
					id: 'B',
					code: 'B',
					severity: 'info',
					messageKey: 'pptx.compatibility.externalImageReference',
				},
			],
			3,
		);

		const toasts = target.querySelectorAll('[data-testid="pptx-compat-toast"]');
		expect(toasts).toHaveLength(2);
		expect(toasts[0]?.getAttribute('data-code')).toBe('A');
		expect(toasts[0]?.getAttribute('data-severity')).toBe('warning');
		expect(toasts[1]?.getAttribute('data-code')).toBe('B');
		expect(toasts[1]?.getAttribute('data-severity')).toBe('info');
		expect(target.textContent).toContain('+3');
	});

	it('renders the dismiss-all button for a single toast', () => {
		const { target } = mountToasts([
			{
				id: 'A',
				code: 'A',
				severity: 'warning',
				messageKey: 'pptx.compatibility.generic',
			},
		]);
		expect(target.querySelector('[data-testid="pptx-compat-toasts-dismiss-all"]')).not.toBeNull();
	});

	it('positions the stack relative to the containing block, above the status bar', () => {
		const { target } = mountToasts([
			{ id: 'A', code: 'A', severity: 'info', messageKey: 'pptx.compatibility.generic' },
		]);
		const stack = target.querySelector('[data-testid="pptx-compat-toasts"]') as HTMLElement;
		expect(stack.style.position).toBe('absolute');
		expect(stack.style.bottom).toBe('41px');
		expect(stack.style.right).toBe('12px');
	});

	it('dismisses a single toast and all toasts through the callbacks', () => {
		const { target, ondismiss, ondismissall } = mountToasts([
			{
				id: 'A',
				code: 'A',
				severity: 'warning',
				messageKey: 'pptx.compatibility.generic',
				params: { code: 'A' },
			},
		]);

		(
			target.querySelector('[data-testid="pptx-compat-toast-dismiss"]') as HTMLButtonElement
		).click();
		expect(ondismiss).toHaveBeenCalledWith('A');

		(
			target.querySelector('[data-testid="pptx-compat-toasts-dismiss-all"]') as HTMLButtonElement
		).click();
		expect(ondismissall).toHaveBeenCalledOnce();
	});
});
