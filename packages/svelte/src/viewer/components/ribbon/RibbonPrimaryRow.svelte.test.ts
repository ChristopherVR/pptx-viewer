import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChromeUiState } from '../../state/chrome-ui.svelte';
import RibbonPrimaryRow from './RibbonPrimaryRow.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountRow(props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(RibbonPrimaryRow, {
		target,
		props: { onpresent: vi.fn(), ...props },
	});
	cleanup = () => unmount(instance);
	return target;
}

describe('ribbonPrimaryRow', () => {
	it('renders the Present split button (main action + options chevron)', () => {
		const onpresent = vi.fn();
		const target = mountRow({ onpresent });

		const main = [...target.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Present',
		);
		expect(main).toBeDefined();
		main?.click();
		expect(onpresent).toHaveBeenCalledOnce();
		expect(target.querySelector('[aria-label="Presentation options"]')).not.toBeNull();
	});

	it('opens the Present dropdown with presenter view / rehearse / broadcast entries', () => {
		const onbroadcast = vi.fn();
		const target = mountRow({
			onpresenter: vi.fn(),
			onrehearse: vi.fn(),
			onsetup: vi.fn(),
			onbroadcast,
			onsubtitles: vi.fn(),
		});

		target.querySelector<HTMLButtonElement>('[aria-label="Presentation options"]')?.click();
		flushSync();
		const items = [...target.querySelectorAll('[role="menuitem"]')].map((item) =>
			item.textContent?.trim(),
		);
		expect(items).toContain('Presenter View');
		expect(items).toContain('Rehearse Timings');
		expect(items).toContain('Present Online');
		const broadcastItem = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
			(item) => item.textContent?.trim() === 'Present Online',
		);
		broadcastItem?.click();
		expect(onbroadcast).toHaveBeenCalledOnce();
	});

	it('wires the sidebar / comments / inspector toggles to ChromeUiState', () => {
		const chromeUi = new ChromeUiState();
		const target = mountRow({ chromeUi });

		target.querySelector<HTMLButtonElement>('[aria-label="Toggle slides panel"]')?.click();
		expect(chromeUi.sidebarCollapsed).toBeTruthy();

		target.querySelector<HTMLButtonElement>('[aria-label="Comments"]')?.click();
		expect(chromeUi.inspectorOpen).toBeTruthy();
		expect(chromeUi.inspectorTab).toBe('comments');

		target.querySelector<HTMLButtonElement>('[aria-label="Toggle inspector panel"]')?.click();
		expect(chromeUi.inspectorOpen).toBeFalsy();
	});

	it('renders the "+ Show" custom-shows button and the settings gear when wired', () => {
		const oncustomshows = vi.fn();
		const onsettings = vi.fn();
		const target = mountRow({ oncustomshows, onsettings });

		target.querySelector<HTMLButtonElement>('[aria-label="Create custom show"]')?.click();
		expect(oncustomshows).toHaveBeenCalledOnce();
		target.querySelector<HTMLButtonElement>('[aria-label="Settings"]')?.click();
		expect(onsettings).toHaveBeenCalledOnce();
	});
});
