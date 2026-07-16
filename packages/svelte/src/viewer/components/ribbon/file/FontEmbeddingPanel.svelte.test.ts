import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FontEmbeddingPanel from './FontEmbeddingPanel.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('font embedding panel', () => {
	it('lists used and embedded fonts and updates the toggle', async () => {
		const target = document.createElement('div');
		const ontoggle = vi.fn();
		const instance = mount(FontEmbeddingPanel, {
			target,
			props: {
				usedFontFamilies: ['Aptos', 'Brand Font'],
				embeddedFonts: ['Brand Font'],
				enabled: false,
				ontoggle,
				onclose: vi.fn(),
			},
		});
		cleanup = () => unmount(instance);
		await Promise.resolve();
		flushSync();

		expect(target.textContent).toContain('Aptos');
		expect(target.textContent).toContain('Brand Font');
		const toggle = target.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		toggle.checked = true;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));
		expect(ontoggle).toHaveBeenCalledWith(true);
	});
});
