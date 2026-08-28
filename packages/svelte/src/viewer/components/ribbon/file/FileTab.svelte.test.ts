import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExportUiState } from '../../../export/export-ui.svelte';
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

	it('runs the deck-JSON export when the Export as JSON card is clicked', () => {
		const target = document.createElement('div');
		const onclose = vi.fn();
		const runJson = vi.fn();
		const noop = vi.fn();
		const instance = mount(FileTab, {
			target,
			props: {
				onclose,
				oncreatepresentation: noop,
				ondownload: noop,
				ondownloadppsx: noop,
				ondownloadpptm: noop,
				hasMacros: false,
				exportUi: { runJson } as unknown as ExportUiState,
			},
		});
		cleanup = () => unmount(instance);

		const exportNav = [...target.querySelectorAll('nav button')].find(
			(button) => button.textContent?.trim() === 'Export',
		) as HTMLButtonElement;
		exportNav.click();
		flushSync();

		const jsonCard = [...target.querySelectorAll('.actions button')].find((button) =>
			button.textContent?.includes('Export as JSON'),
		) as HTMLButtonElement;
		jsonCard.click();

		expect(runJson).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledOnce();
	});
});
