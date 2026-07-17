import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RIBBON_TABS } from './ribbon-tabs';
import RibbonTabBar from './RibbonTabBar.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function tabLabels(target: HTMLElement): string[] {
	return [...target.querySelectorAll('[role="tab"]')].map((el) => el.textContent?.trim() ?? '');
}

describe('ribbonTabBar hiddenActions', () => {
	it('renders every ribbon tab when hiddenActions is omitted (backward compatible default)', () => {
		const target = document.createElement('div');
		const instance = mount(RibbonTabBar, { target, props: { active: 'home', onselect: vi.fn() } });
		cleanup = () => unmount(instance);

		expect(target.querySelectorAll('[role="tab"]')).toHaveLength(RIBBON_TABS.length);
	});

	it('omits a hidden tab from the tab strip', () => {
		const target = document.createElement('div');
		const instance = mount(RibbonTabBar, {
			target,
			props: { active: 'home', onselect: vi.fn(), hiddenActions: ['design', 'record'] },
		});
		cleanup = () => unmount(instance);

		expect(target.querySelectorAll('[role="tab"]')).toHaveLength(RIBBON_TABS.length - 2);
		expect(tabLabels(target)).not.toContain('Design');
		expect(tabLabels(target)).not.toContain('Record');
	});
});
