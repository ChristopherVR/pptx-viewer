import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import DesignTab from './DesignTab.svelte';

/**
 * DesignTab tests: the four commands React's Design tab offers, and that the
 * theme presets moved behind "Browse Themes" instead of sitting loose on the
 * tab where no other binding has them.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

function mountTab(overrides: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(DesignTab, {
		target,
		props: { editor: makeEditor(), theme: undefined, onsettheme: vi.fn(), ...overrides },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function topLevelButtons(target: HTMLElement): string[] {
	return [...target.querySelectorAll<HTMLButtonElement>('button')]
		.filter((button) => !button.closest('[role="menu"]'))
		.map((button) => button.textContent?.trim() ?? '');
}

describe('designTab', () => {
	it('offers exactly React’s four Design commands', () => {
		expect(topLevelButtons(mountTab())).toStrictEqual([
			'Browse Themes',
			'Edit Theme',
			'Slide Size',
			'Format Background',
		]);
	});

	it('keeps the theme presets inside the Browse Themes menu', () => {
		const target = mountTab();
		expect(target.querySelector('[role="menu"]')).toBeNull();

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent?.trim() === 'Browse Themes')
			?.click();
		flushSync();

		const presets = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
		expect(presets.map((button) => button.textContent?.trim())).toContain('Dark (Vermilion)');
	});

	it('applies a preset and closes the menu', () => {
		const onsettheme = vi.fn();
		const target = mountTab({ onsettheme });

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent?.trim() === 'Browse Themes')
			?.click();
		flushSync();
		target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]?.click();
		flushSync();

		expect(onsettheme).toHaveBeenCalledOnce();
		expect(target.querySelector('[role="menu"]')).toBeNull();
	});

	it('opens the document-properties dialog from Slide Size', () => {
		const onslidesize = vi.fn();
		const target = mountTab({ onslidesize });

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent?.trim() === 'Slide Size')
			?.click();

		expect(onslidesize).toHaveBeenCalledOnce();
	});

	it('opens the chrome-theme editor from Edit Theme', () => {
		const target = mountTab();

		[...target.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent?.trim() === 'Edit Theme')
			?.click();
		flushSync();

		expect(target.querySelectorAll('input[type="color"]').length).toBeGreaterThan(0);
	});
});
