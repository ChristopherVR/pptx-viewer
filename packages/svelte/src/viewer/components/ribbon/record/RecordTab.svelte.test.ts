import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RecordTab from './RecordTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountTab(): {
	target: HTMLElement;
	onfrombeginning: ReturnType<typeof vi.fn>;
	onfromcurrent: ReturnType<typeof vi.fn>;
} {
	const target = document.createElement('div');
	const onfrombeginning = vi.fn();
	const onfromcurrent = vi.fn();
	const instance = mount(RecordTab, { target, props: { onfrombeginning, onfromcurrent } });
	cleanup = () => unmount(instance);
	return { target, onfrombeginning, onfromcurrent };
}

/** Find a control by the accessible name the ribbon-inventory e2e spec reads. */
function byName(target: HTMLElement, name: string): HTMLButtonElement | undefined {
	return [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent?.trim() === name,
	);
}

describe('recordTab', () => {
	it('starts recording from the beginning or current slide', () => {
		const { target, onfrombeginning, onfromcurrent } = mountTab();

		byName(target, 'From Beginning')?.click();
		byName(target, 'From Current Slide')?.click();

		expect(onfrombeginning).toHaveBeenCalledOnce();
		expect(onfromcurrent).toHaveBeenCalledOnce();
	});

	it('offers the camera/manage/help placeholders React ships, all disabled', () => {
		const { target } = mountTab();

		for (const name of ['Cameo', 'Clear', 'Reset to Cameo', 'Learn More']) {
			const button = byName(target, name);
			expect(button, `${name} is missing from the Record tab`).toBeDefined();
			expect(button?.disabled, `${name} should be a disabled placeholder`).toBeTruthy();
		}
	});
});
