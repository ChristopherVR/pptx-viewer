import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RecentColorsRow from './RecentColorsRow.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('recentColorsRow', () => {
	it('renders nothing for an empty list', () => {
		const target = document.createElement('div');
		const instance = mount(RecentColorsRow, { target, props: { colors: [], onselect: vi.fn() } });
		cleanup = () => unmount(instance);
		flushSync();
		expect(target.querySelector('[data-testid="pptx-color-recent"]')).toBeNull();
	});

	it('renders one swatch per colour and applies it through onselect', () => {
		const onselect = vi.fn();
		const target = document.createElement('div');
		const instance = mount(RecentColorsRow, {
			target,
			props: { colors: ['#112233', '#445566'], onselect },
		});
		cleanup = () => unmount(instance);
		flushSync();

		const row = target.querySelector('[data-testid="pptx-color-recent"]');
		expect(row).not.toBeNull();
		const swatches = target.querySelectorAll('.pptx-svelte-recent-colors-swatch');
		expect(swatches).toHaveLength(2);
		(swatches[1] as HTMLButtonElement).click();
		expect(onselect).toHaveBeenCalledWith('#445566');
	});
});
