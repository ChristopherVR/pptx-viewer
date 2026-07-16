import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FileTab from './FileTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('fileTab', () => {
	it('opens Settings immediately when Options is selected', () => {
		const target = document.createElement('div');
		const onclose = vi.fn();
		const onsettings = vi.fn();
		const noop = vi.fn();
		const instance = mount(FileTab, {
			target,
			props: {
				onclose,
				onsettings,
				oncreatepresentation: noop,
				ondownload: noop,
				ondownloadppsx: noop,
				ondownloadpptm: noop,
				onpackage: noop,
				hasMacros: false,
			},
		});
		cleanup = () => unmount(instance);

		const options = [...target.querySelectorAll('nav button')].find(
			(button) => button.textContent?.trim() === 'Options',
		) as HTMLButtonElement;
		options.click();

		expect(onsettings).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledOnce();
	});
});
