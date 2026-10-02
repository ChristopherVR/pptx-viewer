import { mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import QuickAccessToolbar from './QuickAccessToolbar.svelte';

describe('the below-ribbon quick-access row', () => {
	it('is the shared element in its belowRibbon placement and empty at the default position', () => {
		const target = document.createElement('div');
		const instance = mount(QuickAccessToolbar, { target, props: { onexec: vi.fn() } });
		const host = target.querySelector('pptx-ui-title-bar')!;
		expect(host.getAttribute('placement')).toBe('belowRibbon');
		expect(host.hasAttribute('data-pptx-title-bar')).toBeFalsy();
		// Default position is `above`, so nothing renders in this row.
		expect(host.hasAttribute('data-empty')).toBeTruthy();
		unmount(instance);
	});
});
