import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RIBBON_TAB_IDS, TOOLBAR_BUTTON_IDS } from 'pptx-viewer-shared';
import type { ViewerCustomization, ViewerCustomizationApi } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as publicApi from '../index';
import PowerPointViewer from './PowerPointViewer.svelte';
import type { PowerPointViewerProps } from './types';

/**
 * The `customization` prop and the imperative customisation helpers, against
 * the full viewer and a real deck: hidden ribbon tabs, live imperative edits,
 * prop-identity replacement, and the panel gates.
 */
const FIXTURE = resolve(process.cwd(), '../../e2e/fixtures/sample-deck.pptx');

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

type ViewerInstance = ViewerCustomizationApi;

async function mountViewer(
	props: Partial<PowerPointViewerProps> = {},
): Promise<{ target: HTMLElement; instance: ViewerInstance }> {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const onload = vi.fn();
	// Defaults are defined onto the caller's object (not spread), so a getter
	// the caller passed stays live for the prop-identity test.
	const merged = Object.assign(props, {
		source: new Uint8Array(readFileSync(FIXTURE)),
		editable: props.editable ?? true,
		onload,
	});
	const instance = mount(PowerPointViewer, { target, props: merged }) as unknown as ViewerInstance;
	flushSync();
	cleanup = () => {
		unmount(instance as unknown as Record<string, unknown>);
		target.remove();
	};
	await vi.waitFor(() => expect(onload).toHaveBeenCalledOnce(), { timeout: 15000 });
	flushSync();
	return { target, instance };
}

function tabLabels(target: HTMLElement): string[] {
	return Array.from(target.querySelectorAll('.pptx-svelte-ribbon-tabs [role="tab"]')).map((tab) =>
		(tab.textContent ?? '').trim(),
	);
}

describe('powerPointViewer customization', () => {
	it('drops a ribbon tab hidden through the customization prop', async () => {
		const { target } = await mountViewer({ customization: { ribbon: { hiddenTabs: ['draw'] } } });
		const labels = tabLabels(target);
		expect(labels).toContain('Insert');
		expect(labels).not.toContain('Draw');
	});

	it('applies the imperative helpers live on the component instance', async () => {
		const { target, instance } = await mountViewer();
		expect(tabLabels(target)).toContain('Insert');

		instance.hideRibbonTab('insert');
		flushSync();
		expect(tabLabels(target)).not.toContain('Insert');
		expect(instance.getCustomization().ribbon?.hiddenTabs).toStrictEqual(['insert']);

		instance.showRibbonTab('insert');
		flushSync();
		expect(tabLabels(target)).toContain('Insert');
	});

	it('replaces the customisation when the prop changes identity', async () => {
		const state = $state<{ customization: ViewerCustomization }>({
			customization: { ribbon: { hiddenTabs: ['draw'] } },
		});
		const { target, instance } = await mountViewer({
			get customization() {
				return state.customization;
			},
		});
		instance.hideRibbonTab('insert');
		flushSync();
		expect(tabLabels(target)).not.toContain('Insert');

		state.customization = { ribbon: { hiddenTabs: ['design'] } };
		flushSync();
		const labels = tabLabels(target);
		// The new object replaces the imperative edit as well as the old list.
		expect(labels).toContain('Insert');
		expect(labels).toContain('Draw');
		expect(labels).not.toContain('Design');
	});

	it('removes the status bar, slides pane and title bar through hiddenPanels', async () => {
		const { target, instance } = await mountViewer();
		expect(target.querySelector('.pptx-svelte-statusbar')).not.toBeNull();
		expect(target.querySelector('[data-pptx-title-bar]')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-thumb')).not.toBeNull();

		instance.setPanelVisible('statusBar', false);
		instance.setPanelVisible('titleBar', false);
		instance.setPanelVisible('slidesPane', false);
		flushSync();
		expect(target.querySelector('.pptx-svelte-statusbar')).toBeNull();
		expect(target.querySelector('[data-pptx-title-bar]')).toBeNull();
		expect(target.querySelector('.pptx-svelte-thumb')).toBeNull();
	});

	it('unions the legacy hiddenActions prop with the customisation', async () => {
		const { target } = await mountViewer({
			hiddenActions: ['review'],
			customization: { ribbon: { hiddenTabs: ['help'] } },
		});
		const labels = tabLabels(target);
		expect(labels).not.toContain('Review');
		expect(labels).not.toContain('Help');
		expect(labels).toContain('Home');
	});
});

describe('public customisation exports', () => {
	it('re-exports the id catalogues from the package entry', () => {
		expect(publicApi.RIBBON_TAB_IDS).toBe(RIBBON_TAB_IDS);
		expect(publicApi.TOOLBAR_BUTTON_IDS).toBe(TOOLBAR_BUTTON_IDS);
		const catalogues = [
			publicApi.OPTIONS_PAGE_IDS,
			publicApi.OPTIONS_SECTION_IDS,
			publicApi.OPTIONS_SETTING_IDS,
			publicApi.BACKSTAGE_PAGE_IDS,
			publicApi.BACKSTAGE_CARD_IDS,
			publicApi.ELEMENT_CONTEXT_MENU_COMMAND_IDS,
			publicApi.CANVAS_CONTEXT_MENU_COMMAND_IDS,
			publicApi.EDITOR_SHORTCUT_ACTION_IDS,
			publicApi.VIEWER_PANEL_IDS,
			publicApi.VIEWER_FEATURE_IDS,
			publicApi.VIEWER_DIALOG_IDS,
			publicApi.VIEWER_EXPORT_FORMAT_IDS,
		];
		expect(catalogues.every((list) => Array.isArray(list) && list.length > 0)).toBeTruthy();
	});
});
