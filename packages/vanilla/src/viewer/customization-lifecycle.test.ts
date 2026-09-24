import { createViewerOptionsStore, resolveCustomization, THEME_CATALOG } from 'pptx-viewer-shared';
import type { ViewerCustomization, ViewerOptionsStore } from 'pptx-viewer-shared';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditActions } from './editor';
import { createTranslator } from './i18n';
import { createPptxViewer } from './PptxViewer';
import { createInitialViewerState, createStore } from './state';
import type { ViewerState } from './state';
import type { PptxViewerInstance, PptxViewerOptions } from './types';
import { mountCanvasContextMenu } from './ui/canvas-context-menu';
import { openSettingsDialog } from './ui/settings-dialog';

let active: PptxViewerInstance[] = [];

function mount(options: PptxViewerOptions = {}): {
	container: HTMLElement;
	viewer: PptxViewerInstance;
} {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = createPptxViewer(container, options);
	active.push(viewer);
	return { container, viewer };
}

afterEach(() => {
	for (const viewer of active) {
		viewer.destroy();
	}
	active = [];
	document.body.replaceChildren();
});

function ribbonTabLabels(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll('.pptxv-ribbon-tab')).map((tab) =>
		(tab.textContent ?? '').trim(),
	);
}

/** The viewer's File > Options store (private on the class; read for assertions only). */
function optionsStoreOf(viewer: PptxViewerInstance): ViewerOptionsStore {
	return (viewer as unknown as { optionsController: { optionsStore: ViewerOptionsStore } })
		.optionsController.optionsStore;
}

describe('vanilla UI customisation', () => {
	it('never builds a ribbon tab the host customisation hides', () => {
		const { container } = mount({ customization: { ribbon: { hiddenTabs: ['draw'] } } });
		const labels = ribbonTabLabels(container);
		expect(labels).toContain('Insert');
		expect(labels).not.toContain('Draw');
	});

	it('still honours the legacy hiddenActions option alongside the customisation', () => {
		const { container } = mount({
			hiddenActions: ['review'],
			customization: { ribbon: { hiddenTabs: ['draw'] } },
		});
		const labels = ribbonTabLabels(container);
		expect(labels).not.toContain('Draw');
		expect(labels).not.toContain('Review');
	});

	it('applies the imperative API live, and round-trips through getCustomization', () => {
		const { container, viewer } = mount();
		expect(ribbonTabLabels(container)).toContain('Insert');
		viewer.hideRibbonTab('insert');
		expect(ribbonTabLabels(container)).not.toContain('Insert');
		expect(viewer.getCustomization().ribbon?.hiddenTabs).toStrictEqual(['insert']);
		viewer.showRibbonTab('insert');
		expect(ribbonTabLabels(container)).toContain('Insert');
		viewer.setCustomization({ ribbon: { hiddenTabs: ['view'] } });
		expect(ribbonTabLabels(container)).not.toContain('View');
		viewer.resetCustomization();
		expect(ribbonTabLabels(container)).toContain('View');
	});

	it('removes the status bar, title bar and slides pane the host hides', () => {
		const customization: ViewerCustomization = {
			hiddenPanels: ['statusBar', 'titleBar', 'slidesPane'],
		};
		const { container, viewer } = mount({ customization });
		expect(container.querySelector('.pptxv-statusbar')).toBeNull();
		expect(container.querySelector('.pptxv-titlebar')).toBeNull();
		expect(container.querySelector('.pptxv-thumbs-list')).toBeNull();
		viewer.setPanelVisible('slidesPane', true);
		expect(container.querySelector('.pptxv-thumbs-list')).not.toBeNull();
	});

	it('pushes locked settings into the options store and keeps them there', () => {
		const { viewer } = mount({
			customization: { options: { locked: { 'advanced.showGrid': true } } },
		});
		const store = optionsStoreOf(viewer);
		expect(store.isLocked('advanced', 'showGrid')).toBeTruthy();
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
		store.setValue('advanced', 'showGrid', false);
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
		viewer.unlockSetting('advanced.showGrid');
		expect(store.isLocked('advanced', 'showGrid')).toBeFalsy();
		viewer.lockSetting('advanced.snapToGrid', false);
		expect(store.isLocked('advanced', 'snapToGrid')).toBeTruthy();
	});

	it('makes openSettings a no-op when the host removes the Options dialog', () => {
		const { viewer } = mount({ customization: { hiddenDialogs: ['options'] } });
		(viewer as unknown as { openSettings(): void }).openSettings();
		expect(document.querySelector('.pptxv-options-dialog')).toBeNull();
		viewer.setDialogAvailable('options', true);
		(viewer as unknown as { openSettings(): void }).openSettings();
		expect(document.querySelector('.pptxv-options-dialog')).not.toBeNull();
	});
});

describe('file > Options dialog customisation', () => {
	function open(customization: ViewerCustomization, store = createViewerOptionsStore()): void {
		openSettingsDialog(document, createTranslator(), {
			store,
			initialTab: 'general',
			onClearCache: vi.fn(),
			themeOptions: { catalog: THEME_CATALOG, currentKey: 'default', onSelect: vi.fn() },
			localeOptions: { catalog: LOCALE_CATALOG, currentCode: 'en', onSelect: vi.fn() },
			customization: resolveCustomization(customization),
		});
	}
	function navLabels(): string[] {
		return Array.from(document.querySelectorAll('.pptxv-options-nav button')).map((button) =>
			(button.textContent ?? '').trim(),
		);
	}
	function row(label: string): HTMLElement | undefined {
		return Array.from(document.querySelectorAll<HTMLElement>('.pptxv-options-row')).find(
			(candidate) => candidate.textContent?.trim() === label,
		);
	}
	function openTab(label: string): void {
		Array.from(document.querySelectorAll<HTMLButtonElement>('.pptxv-options-nav button'))
			.find((button) => button.textContent === label)
			?.click();
	}

	it('drops a hidden page from the rail and a hidden setting from its page', () => {
		localStorage.clear();
		open({ options: { hiddenPages: ['proofing'], hiddenSettings: ['advanced.showGrid'] } });
		expect(navLabels()).not.toContain('Proofing');
		expect(navLabels()).toContain('Advanced');
		openTab('Advanced');
		expect(row('Show grid')).toBeUndefined();
		expect(row('Snap to grid')).toBeDefined();
	});

	it('renders a locked setting disabled with the managed-by-host tooltip', () => {
		localStorage.clear();
		const store = createViewerOptionsStore();
		open({ options: { locked: { 'advanced.snapToGrid': true } } }, store);
		openTab('Advanced');
		const checkbox = row('Snap to grid')?.querySelector<HTMLElement>('pptx-ui-checkbox');
		expect(checkbox?.hasAttribute('disabled')).toBeTruthy();
		expect(checkbox?.title).toBe('This setting is managed by your organization');
		const free = row('Show grid')?.querySelector<HTMLElement>('pptx-ui-checkbox');
		expect(free?.hasAttribute('disabled')).toBeFalsy();
	});

	it('falls back to the first visible page when the requested one is hidden', () => {
		localStorage.clear();
		open({ options: { hiddenPages: ['general'] } });
		expect(navLabels()).not.toContain('General');
		expect(document.querySelector('.pptxv-options-nav button.is-active')).not.toBeNull();
	});
});

describe('canvas context menu customisation', () => {
	function mountMenu(customization: ViewerCustomization): HTMLElement {
		const viewport = document.createElement('div');
		const stage = document.createElement('div');
		stage.className = 'pptxv-stage';
		viewport.appendChild(stage);
		document.body.appendChild(viewport);
		const store = createStore<ViewerState>({ ...createInitialViewerState(), editable: true });
		const resolved = resolveCustomization(customization);
		mountCanvasContextMenu({
			doc: document,
			store,
			getTranslator: () => createTranslator(),
			viewport,
			getStageRoot: () => stage,
			getEditActions: () => ({}) as EditActions,
			getCustomization: () => resolved,
		});
		return stage;
	}

	it('leaves the native menu alone when the host disables the canvas menu', () => {
		const stage = mountMenu({ contextMenu: { disableCanvasMenu: true } });
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		stage.dispatchEvent(event);
		expect(event.defaultPrevented).toBeFalsy();
		expect(document.querySelector('[data-pptx-context-menu]')).toBeNull();
	});
});
