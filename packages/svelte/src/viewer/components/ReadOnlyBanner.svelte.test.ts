import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReadOnlyBanner from './ReadOnlyBanner.svelte';

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

		(
			target.querySelector('[data-testid="pptx-readonly-edit-anyway"]') as HTMLButtonElement
		).click();
		expect(oneditanyway).toHaveBeenCalledOnce();

		(target.querySelector('[data-testid="pptx-readonly-dismiss"]') as HTMLButtonElement).click();
		expect(ondismiss).toHaveBeenCalledOnce();
	});
});
