import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TitleBar from './TitleBar.svelte';

/**
 * The title bar's quick-access strip is options-driven, and this binding used
 * to hardcode Save/Undo/Redo and ignore `options.quickAccess` entirely, so it
 * rendered three commands where the shared default (and Angular) had four.
 * Mounted without an options context, so it exercises the shipped defaults.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function renderTitleBar(props: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(TitleBar, {
		target,
		props: {
			editable: true,
			isDirty: false,
			autosaveEnabled: true,
			canUndo: false,
			canRedo: false,
			findReplaceOpen: false,
			onautosavetoggle: vi.fn(),
			onsave: vi.fn(),
			onundo: vi.fn(),
			onredo: vi.fn(),
			onfindreplace: vi.fn(),
			...props,
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

/** Accessible names of the quick-access buttons, in DOM order. */
function quickAccessNames(target: HTMLElement): (string | null)[] {
	return [...target.querySelectorAll('.pptx-svelte-titlebar-actions button')].map((button) =>
		button.getAttribute('aria-label'),
	);
}

describe('the quick-access strip follows File > Options', () => {
	it('renders the shipped default, which is four commands and not three', () => {
		expect(quickAccessNames(renderTitleBar())).toStrictEqual([
			'Save',
			'Undo',
			'Redo',
			'From Beginning',
		]);
	});

	it('routes a quick-access command to the host by catalog id', () => {
		const onquickcommand = vi.fn();
		const target = renderTitleBar({ onquickcommand });
		target.querySelector<HTMLButtonElement>('button[aria-label="From Beginning"]')?.click();
		expect(onquickcommand).toHaveBeenCalledWith('presentFromStart');
	});
});

describe('the title bar is measured from the shared chrome metrics', () => {
	it('publishes them as custom properties the scoped stylesheet reads', () => {
		// The browser re-serialises the inline style, so match on the declarations
		// rather than the exact string this component wrote.
		const style = (
			renderTitleBar().querySelector('[data-pptx-title-bar]')?.getAttribute('style') ?? ''
		).replaceAll(' ', '');
		expect(style).toContain('--pptx-tb-height:36px');
		expect(style).toContain('--pptx-tb-logo-bg:#c43e1c');
		// Travel, not the "on" offset: the knob is already parked at 2px.
		expect(style).toContain('--pptx-tb-knob-travel:13px');
	});
});
