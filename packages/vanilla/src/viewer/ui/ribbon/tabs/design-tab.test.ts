import { THEME_PRESETS } from 'pptx-viewer-core';
import { GALLERY_THEME_PRESETS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createRibbonGalleryHub } from '../gallery/gallery-hub';
import { createDesignTab } from './design-tab';

/**
 * Design > Browse Themes and Edit Theme act on the PRESENTATION theme (as in
 * React, Vue and Angular), never the viewer chrome.
 */
function mountTab() {
	const handlers = { applyPresentationTheme: vi.fn(), applyThemeEdit: vi.fn() };
	const hub = createRibbonGalleryHub(vi.fn());
	const tab = createDesignTab(document, createTranslator(), handlers, vi.fn(), vi.fn(), hub);
	document.body.appendChild(tab.el);
	tab.setEditable(true);
	hub.sync(
		{
			element: null,
			theme: {
				name: 'Office Theme',
				colorScheme: THEME_PRESETS[0].colorScheme,
				fontScheme: THEME_PRESETS[0].fontScheme,
			},
		},
		true,
	);
	return { tab, handlers };
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
	const match = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.getAttribute('aria-label') === label || node.textContent?.trim() === label,
	);
	if (!match) {
		throw new Error(`missing design control: ${label}`);
	}
	return match;
}

describe('createDesignTab', () => {
	it('lists the shared gallery deck themes behind Browse Themes, the active one checked', () => {
		const { tab } = mountTab();
		const control = tab.el.querySelector<HTMLElement>(
			'[data-ribbon-control="design.themes.browseThemes"]',
		);
		const presets = [...(control?.querySelectorAll<HTMLElement>('[data-theme-preset]') ?? [])];
		expect(presets.map((node) => node.dataset.themePreset)).toStrictEqual(
			GALLERY_THEME_PRESETS.map((preset) => preset.id),
		);
		expect(tab.el.textContent).not.toContain('Vermilion');
		const checked = presets.filter((node) => node.getAttribute('aria-checked') === 'true');
		expect(checked.map((node) => node.dataset.themePreset)).toStrictEqual(['office']);
		tab.el.remove();
	});

	it('re-themes the presentation from a Browse Themes pick', () => {
		const { tab, handlers } = mountTab();
		button(tab.el, 'Browse Themes').click();
		tab.el.querySelector<HTMLButtonElement>('[data-theme-preset="berlin"]')?.click();
		expect(handlers.applyPresentationTheme).toHaveBeenCalledWith('berlin');
		tab.el.remove();
	});

	it('opens the deck theme editor from Edit Theme and applies it to the presentation', () => {
		const { tab, handlers } = mountTab();
		const panel = tab.el.querySelector<HTMLElement>('[data-deck-theme-editor]');
		expect(panel?.hidden).toBeTruthy();

		button(tab.el, 'Edit Theme').click();

		expect(panel?.hidden).toBeFalsy();
		const name = panel?.querySelector<HTMLInputElement>('input[type="text"]');
		expect(name?.value).toBe('Office Theme');
		expect(name?.disabled).toBeFalsy();
		button(panel as HTMLElement, 'Apply to Presentation').click();
		expect(handlers.applyThemeEdit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Office Theme',
				colorScheme: expect.objectContaining({ accent1: THEME_PRESETS[0].colorScheme.accent1 }),
			}),
		);
		expect(panel?.hidden).toBeTruthy();
		tab.el.remove();
	});
});
