import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ProtectedViewBanner from './ProtectedViewBanner.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('protectedViewBanner', () => {
	it('renders the banner and wires the enable-editing button', () => {
		const onenableediting = vi.fn();
		const target = document.createElement('div');
		const instance = mount(ProtectedViewBanner, {
			target,
			props: { onenableediting },
		});
		cleanup = () => unmount(instance);
		flushSync();

		const banner = target.querySelector('.pptx-svelte-protected-view-banner');
		expect(banner).not.toBeNull();
		expect(banner?.getAttribute('role')).toBe('status');

		const button = target.querySelector(
			'.pptx-svelte-protected-view-banner-enable',
		) as HTMLButtonElement;
		expect(button).not.toBeNull();
		button.click();
		expect(onenableediting).toHaveBeenCalledOnce();
	});
});
