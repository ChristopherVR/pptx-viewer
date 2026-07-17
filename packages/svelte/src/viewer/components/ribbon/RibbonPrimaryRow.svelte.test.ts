import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RibbonPrimaryRow from './RibbonPrimaryRow.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('ribbonPrimaryRow hiddenActions', () => {
	it('renders Share and Broadcast when hiddenActions is omitted (backward compatible default)', () => {
		const target = document.createElement('div');
		const instance = mount(RibbonPrimaryRow, {
			target,
			props: { onshare: vi.fn(), onbroadcast: vi.fn() },
		});
		cleanup = () => unmount(instance);

		expect(target.querySelector('[aria-label="Share"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Broadcast Slide Show"]')).not.toBeNull();
	});

	it('hides Share when "share" is in hiddenActions, keeping Broadcast', () => {
		const target = document.createElement('div');
		const instance = mount(RibbonPrimaryRow, {
			target,
			props: { onshare: vi.fn(), onbroadcast: vi.fn(), hiddenActions: ['share'] },
		});
		cleanup = () => unmount(instance);

		expect(target.querySelector('[aria-label="Share"]')).toBeNull();
		expect(target.querySelector('[aria-label="Broadcast Slide Show"]')).not.toBeNull();
	});

	it('hides Broadcast when "broadcast" is in hiddenActions, keeping Share', () => {
		const target = document.createElement('div');
		const instance = mount(RibbonPrimaryRow, {
			target,
			props: { onshare: vi.fn(), onbroadcast: vi.fn(), hiddenActions: ['broadcast'] },
		});
		cleanup = () => unmount(instance);

		expect(target.querySelector('[aria-label="Broadcast Slide Show"]')).toBeNull();
		expect(target.querySelector('[aria-label="Share"]')).not.toBeNull();
	});
});
