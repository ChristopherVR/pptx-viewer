import { COMPAT_TOAST_METRICS, STATUS_BAR_METRICS } from 'pptx-viewer-shared';
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createCompatToastStack } from './compat-toasts';

function toast(overrides: Partial<CompatibilityWarningToast> = {}): CompatibilityWarningToast {
	return {
		id: 'CODE',
		code: 'CODE',
		severity: 'warning',
		messageKey: 'pptx.compatibility.generic',
		...overrides,
	};
}

function mount() {
	const onDismiss = vi.fn();
	const onDismissAll = vi.fn();
	const stack = createCompatToastStack(document, (key) => key, onDismiss, onDismissAll);
	return { stack, onDismiss, onDismissAll };
}

describe('compatibility toast stack', () => {
	// B2: the stack must sit ABOVE the status bar, not merely `bottom: 12px` of
	// whatever contains it, or it covers the "Slide show" button.
	it('anchors above the status bar using the shared chrome metrics', () => {
		const { stack } = mount();

		expect(stack.el.style.position).toBe('absolute');
		expect(stack.el.style.right).toBe(`${String(COMPAT_TOAST_METRICS.insetRight)}px`);
		expect(stack.el.style.bottom).toBe(
			`${String(STATUS_BAR_METRICS.height + COMPAT_TOAST_METRICS.marginAboveStatusBar)}px`,
		);
	});

	it('starts hidden with an empty stack', () => {
		const { stack } = mount();

		expect(stack.el.hidden).toBeTruthy();
		expect(stack.el.dataset.testid).toBe('pptx-compat-toasts');
	});

	it('renders one toast per warning with code/severity data attributes', () => {
		const { stack } = mount();

		stack.update([toast({ id: 'A', code: 'A', severity: 'info' }), toast({ id: 'B', code: 'B' })]);

		expect(stack.el.hidden).toBeFalsy();
		const toasts = stack.el.querySelectorAll('[data-testid="pptx-compat-toast"]');
		expect(toasts).toHaveLength(2);
		expect((toasts[0] as HTMLElement).dataset.code).toBe('A');
		expect((toasts[0] as HTMLElement).dataset.severity).toBe('info');
		expect((toasts[1] as HTMLElement).dataset.code).toBe('B');
	});

	it('caps the visible stack at 5 and shows a +N overflow count', () => {
		const { stack } = mount();

		stack.update(Array.from({ length: 8 }, (_, i) => toast({ id: `t${i}`, code: `t${i}` })));

		expect(stack.el.querySelectorAll('[data-testid="pptx-compat-toast"]')).toHaveLength(5);
		expect(stack.el.textContent).toContain('+3');
	});

	it('fires onDismiss with the toast id from its own dismiss button', () => {
		const { stack, onDismiss } = mount();
		stack.update([toast({ id: 'A' })]);

		stack.el.querySelector<HTMLButtonElement>('[data-testid="pptx-compat-toast-dismiss"]')!.click();

		expect(onDismiss).toHaveBeenCalledWith('A');
	});

	it('fires onDismissAll from the dismiss-all button', () => {
		const { stack, onDismissAll } = mount();
		stack.update([toast()]);

		stack.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-compat-toasts-dismiss-all"]')!
			.click();

		expect(onDismissAll).toHaveBeenCalledOnce();
	});

	it('renders the translated message with params', () => {
		const { stack } = mount();

		stack.update([toast({ messageKey: 'pptx.compatibility.generic', params: { code: 'FOO' } })]);

		expect(stack.el.textContent).toContain('pptx.compatibility.generic');
	});
});
