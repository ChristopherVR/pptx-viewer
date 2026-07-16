import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RecordTab from './RecordTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('recordTab', () => {
	it('starts recording from the beginning or current slide', () => {
		const target = document.createElement('div');
		const onfrombeginning = vi.fn();
		const onfromcurrent = vi.fn();
		const instance = mount(RecordTab, {
			target,
			props: { onfrombeginning, onfromcurrent },
		});
		cleanup = () => unmount(instance);

		const buttons = target.querySelectorAll<HTMLButtonElement>('button');
		buttons[0].click();
		buttons[1].click();
		expect(onfrombeginning).toHaveBeenCalledOnce();
		expect(onfromcurrent).toHaveBeenCalledOnce();
	});
});
