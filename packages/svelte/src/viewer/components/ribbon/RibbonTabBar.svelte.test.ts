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

	it('renders Record and Share on the tab row right side when wired', () => {
		const onrecord = vi.fn();
		const onshare = vi.fn();
		const target = document.createElement('div');
		const instance = mount(RibbonTabBar, {
			target,
			props: { active: 'home', onselect: vi.fn(), onrecord, onshare },
		});
		cleanup = () => unmount(instance);

		const record = target.querySelector<HTMLButtonElement>('.pptx-svelte-ribbon-record');
		const share = target.querySelector<HTMLButtonElement>('.pptx-svelte-ribbon-share');
		expect(record).not.toBeNull();
		expect(share).not.toBeNull();
		record?.click();
		share?.click();
		expect(onrecord).toHaveBeenCalledOnce();
		expect(onshare).toHaveBeenCalledOnce();
	});

	it('hides the tab-row Record / Share quick actions via hiddenActions', () => {
		const target = document.createElement('div');
		const instance = mount(RibbonTabBar, {
			target,
			props: {
				active: 'home',
				onselect: vi.fn(),
				onrecord: vi.fn(),
				onshare: vi.fn(),
				hiddenActions: ['record', 'share'],
			},
		});
		cleanup = () => unmount(instance);

		expect(target.querySelector('.pptx-svelte-ribbon-record')).toBeNull();
		expect(target.querySelector('.pptx-svelte-ribbon-share')).toBeNull();
	});
});
