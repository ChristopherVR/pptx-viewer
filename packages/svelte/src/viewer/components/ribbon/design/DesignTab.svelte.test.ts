import type { PptxHandler } from 'pptx-viewer-core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { GALLERY_THEME_PRESETS } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import DesignTab from './DesignTab.svelte';

/**
 * DesignTab tests: the four commands React's Design tab offers, and that both
 * theme commands act on the PRESENTATION theme (Browse Themes re-themes the
 * deck, Edit Theme opens the deck theme editor), never the viewer chrome.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function fakeHandler(): PptxHandler {
	return {
		applyTheme: vi.fn(async () => {}),
		updateThemeColorScheme: vi.fn(async () => {}),
		updateThemeFontScheme: vi.fn(async () => {}),
		updateThemeName: vi.fn(async () => {}),
	} as unknown as PptxHandler;
}

function makeEditor(handler: PptxHandler | null = null): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => handler });
	editor.editable = true;
	editor.theme = {
		name: 'Office Theme',
		colorScheme: THEME_PRESETS[0].colorScheme,
		fontScheme: THEME_PRESETS[0].fontScheme,
	};
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

function clickButton(target: HTMLElement, label: string): void {
	[...target.querySelectorAll<HTMLButtonElement>('button')]
		.find((button) => button.textContent?.trim() === label)
		?.click();
	flushSync();
}

function mountTab(overrides: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(DesignTab, {
		target,
		props: { editor: makeEditor(), ...overrides },
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
		.filter(
			(button) =>
				!button.closest('[role="menu"]') &&
				!button.closest('[data-ribbon-group="design.variants"]'),
		)
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

	it('adds the Variants group with the Colors and Fonts galleries', () => {
		const target = mountTab();
		const group = target.querySelector('[data-ribbon-group="design.variants"]');
		expect(group?.textContent).toContain('Variants');
		expect(
			group?.querySelector(
				'[data-ribbon-control="design.variants.colors"] [data-ribbon-gallery="themeColors"]',
			),
		).not.toBeNull();
		expect(
			group?.querySelector(
				'[data-ribbon-control="design.variants.fonts"] [data-ribbon-gallery="themeFonts"]',
			),
		).not.toBeNull();
		expect(target.querySelector('[data-ribbon-group="design.themes"]')).not.toBeNull();
		expect(target.querySelector('[data-ribbon-group="design.customize"]')).not.toBeNull();
	});

	it('lists the shared gallery deck themes behind Browse Themes, the active one checked', () => {
		const target = mountTab();
		expect(target.querySelector('[role="menu"]')).toBeNull();

		clickButton(target, 'Browse Themes');

		const presets = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
		expect(presets.map((button) => button.dataset.themePreset)).toStrictEqual(
			GALLERY_THEME_PRESETS.map((preset) => preset.id),
		);
		expect(target.textContent).not.toContain('Dark (Vermilion)');
		const checked = presets.filter((button) => button.getAttribute('aria-checked') === 'true');
		expect(checked.map((button) => button.dataset.themePreset)).toStrictEqual(['office']);
	});

	it('re-themes the presentation (undoably) from a Browse Themes pick', async () => {
		const handler = fakeHandler();
		const editor = makeEditor(handler);
		const target = mountTab({ editor });
		const berlin = GALLERY_THEME_PRESETS.find((preset) => preset.id === 'berlin');

		clickButton(target, 'Browse Themes');
		target.querySelector<HTMLButtonElement>('[data-theme-preset="berlin"]')?.click();
		flushSync();
		await vi.waitFor(() => expect(editor.theme?.name).toBe(berlin?.name));

		expect(handler.applyTheme).toHaveBeenCalledWith(
			berlin?.colorScheme,
			berlin?.fontScheme,
			berlin?.name,
		);
		expect(editor.theme?.colorScheme).toStrictEqual(berlin?.colorScheme);
		expect(editor.canUndo).toBeTruthy();
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

	it('opens the deck theme editor from Edit Theme', () => {
		const target = mountTab({ editor: makeEditor(fakeHandler()) });
		expect(target.querySelector('[data-deck-theme-editor]')).toBeNull();

		clickButton(target, 'Edit Theme');

		const panel = target.querySelector('[data-deck-theme-editor]');
		expect(panel?.querySelector('.pptx-svelte-theme-editor')).not.toBeNull();
		expect(panel?.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe(
			'Office Theme',
		);

		clickButton(target, 'Edit Theme');
		expect(target.querySelector('[data-deck-theme-editor]')).toBeNull();
	});
});
