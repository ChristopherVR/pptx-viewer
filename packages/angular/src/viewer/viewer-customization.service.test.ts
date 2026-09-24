/**
 * The Angular wiring of the shared UI customisation model: the per-viewer
 * service, the imperative handle, the options-store locks, and the render
 * sites that map the shared descriptors (ribbon tabs, File > Options, the
 * File tab, both context menus, the editor keymap, print).
 *
 * No full-viewer TestBed here (see `vitest.config.ts`), so each render site is
 * exercised through the component or service that owns it, constructed inside
 * an injector that provides the viewer's `ViewerCustomizationService`.
 */
import { ElementRef, Injector, runInInjectionContext, signal } from '@angular/core';
import type { OutputEmitterRef, Provider, StaticProvider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { filterVisibleTabs, TOOLBAR_TABS } from '../internal/shared';
import type { ViewerCustomization, ViewerOptionsToggleControl } from '../internal/shared';
import { EditorContextMenuComponent } from './editor-context-menu.component';
import { EditorStateService } from './editor-state.service';
import { OptionsPaneComponent } from './options-pane.component';
import type { OptionValueChange } from './options-pane.component';
import { PrintService } from './print.service';
import { RibbonFileSectionComponent } from './ribbon-file-section.component';
import { SettingsDialogComponent } from './settings-dialog.component';
import { SlideCanvasContextMenuComponent } from './slide-canvas-context-menu.component';
import { ViewerCustomizationHandle } from './viewer-customization-handle';
import { ViewerCustomizationService } from './viewer-customization.service';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';
import { ViewerOptionsService } from './viewer-options.service';

function makeInjector(extra: (Provider | StaticProvider)[] = []): Injector {
	return Injector.create({
		providers: [
			{ provide: ViewerOptionsService, deps: [] },
			{ provide: ViewerCustomizationService, deps: [] },
			...extra,
		],
	});
}

function construct<T>(injector: Injector, create: () => T): T {
	return runInInjectionContext(injector, create);
}

/** The ribbon tab ids the viewer would render for a service's hidden actions. */
function ribbonTabIds(service: ViewerCustomizationService, legacy: string[] = []): string[] {
	return filterVisibleTabs(
		TOOLBAR_TABS,
		service.effectiveHiddenActions(legacy as Parameters<typeof service.effectiveHiddenActions>[0]),
	).map((tab) => tab.id);
}

beforeEach(() => localStorage.clear());

describe('viewerCustomizationService', () => {
	it('drops a hidden ribbon tab from the effective hidden actions', () => {
		const service = construct(makeInjector(), () => new ViewerCustomizationService());
		expect(ribbonTabIds(service)).toContain('draw');
		service.api.setCustomization({ ribbon: { hiddenTabs: ['draw'] } });
		expect(ribbonTabIds(service)).not.toContain('draw');
	});

	it('unions the legacy hiddenActions input with the customisation', () => {
		const service = construct(makeInjector(), () => new ViewerCustomizationService());
		service.api.hideRibbonTab('draw');
		const ids = ribbonTabIds(service, ['review']);
		expect(ids).not.toContain('draw');
		expect(ids).not.toContain('review');
		expect(service.effectiveHiddenActions([])).toStrictEqual(['draw']);
	});

	it('folds dialogs and features into the hidden actions and gates', () => {
		const service = construct(makeInjector(), () => new ViewerCustomizationService());
		service.api.updateCustomization({
			disabledFeatures: ['collaboration', 'ai'],
			hiddenPanels: ['statusBar'],
		});
		expect(service.effectiveHiddenActions([])).toStrictEqual(
			expect.arrayContaining(['share', 'broadcast']),
		);
		expect(service.dialogAvailable('share')).toBeFalsy();
		expect(service.featureEnabled('ai')).toBeFalsy();
		expect(service.panelVisible('statusBar')).toBeFalsy();
		expect(service.panelVisible('notes')).toBeTruthy();
	});

	it('switches the quick access strip off when the host hides it', () => {
		const service = construct(makeInjector(), () => new ViewerCustomizationService());
		const options = construct(makeInjector(), () => new ViewerOptionsService()).options();
		expect(service.quickAccess(options.quickAccess)).toBe(options.quickAccess);
		service.api.setPanelVisible('quickAccessToolbar', false);
		expect(service.quickAccess(options.quickAccess).visible).toBeFalsy();
	});

	it('pushes locks and host defaults into the viewer options store', () => {
		const injector = makeInjector();
		const service = injector.get(ViewerCustomizationService);
		const options = injector.get(ViewerOptionsService);
		service.api.lockSetting('advanced.showGrid', true);
		expect(options.options().advanced.showGrid).toBeTruthy();
		expect(options.store.isLocked('advanced', 'showGrid')).toBeTruthy();
		options.setValue('advanced', 'showGrid', false);
		expect(options.options().advanced.showGrid).toBeTruthy();
		service.api.unlockSetting('advanced.showGrid');
		expect(options.store.isLocked('advanced', 'showGrid')).toBeFalsy();
		service.api.setSettingDefault('advanced.maximumUndoSteps', 42);
		expect(options.options().advanced.maximumUndoSteps).toBe(42);
	});
});

describe('viewerCustomizationHandle (the component imperative API)', () => {
	class Handle extends ViewerCustomizationHandle {
		readonly customizationService = construct(
			makeInjector(),
			() => new ViewerCustomizationService(),
		);
	}

	it('updates the resolved customisation live through hide/show', () => {
		const handle = new Handle();
		const resolved = handle.customizationService.resolved;
		handle.hideRibbonTab('insert');
		expect(ribbonTabIds(handle.customizationService)).not.toContain('insert');
		expect(resolved().hiddenActions.has('insert')).toBeTruthy();
		handle.showRibbonTab('insert');
		expect(ribbonTabIds(handle.customizationService)).toContain('insert');
		expect(handle.getCustomization().ribbon?.hiddenTabs).toStrictEqual([]);
		handle.resetCustomization();
		expect(handle.getCustomization()).toStrictEqual({});
	});
});

beforeAll(() => {
	try {
		TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	} catch {
		// Already initialised by another spec in this worker.
	}
});
afterEach(() => TestBed.resetTestingModule());

/** A TestBed injector (effects need its scheduler) with the viewer's two services. */
function testBedService(): ViewerCustomizationService {
	TestBed.configureTestingModule({ providers: [ViewerOptionsService, ViewerCustomizationService] });
	return TestBed.inject(ViewerCustomizationService);
}

function mountSettingsDialog(): {
	service: ViewerCustomizationService;
	dialog: SettingsDialogComponent;
} {
	const service = testBedService();
	return { service, dialog: TestBed.runInInjectionContext(() => new SettingsDialogComponent()) };
}

describe('customization input binding', () => {
	it('replaces the customisation whenever the input identity changes', () => {
		const service = testBedService();
		const input = signal<ViewerCustomization | undefined>(undefined);
		TestBed.runInInjectionContext(() => service.bindInput(input));
		service.api.hideRibbonTab('view');
		TestBed.tick();
		// The initial undefined input does not wipe an imperative edit.
		expect(service.resolved().hiddenActions.has('view')).toBeTruthy();
		input.set({ ribbon: { hiddenTabs: ['draw'] } });
		TestBed.tick();
		expect(service.resolved().hiddenActions.has('draw')).toBeTruthy();
		expect(service.resolved().hiddenActions.has('view')).toBeFalsy();
		input.set(undefined);
		TestBed.tick();
		expect(service.resolved().hiddenActions.size).toBe(0);
	});
});

describe('settings dialog under customisation', () => {
	it('drops hidden pages and falls back from a hidden active page', () => {
		const { service, dialog } = mountSettingsDialog();
		const view = dialog as unknown as {
			tabs: () => readonly { id: string }[];
			activeTabId: { set: (id: string) => void };
			shownTabId: () => string;
			aiTabVisible: () => boolean;
		};
		view.activeTabId.set('proofing');
		expect(view.shownTabId()).toBe('proofing');
		service.api.hideOptionsPage('proofing');
		expect(view.tabs().map((tab) => tab.id)).not.toContain('proofing');
		expect(view.shownTabId()).toBe('general');
		service.api.hideOptionsPage('general');
		expect(view.shownTabId()).toBe(view.tabs()[0]?.id);
		expect(view.aiTabVisible()).toBeFalsy();
	});

	it('removes a hidden setting and marks a locked one read-only', () => {
		const { service, dialog } = mountSettingsDialog();
		const controls = (): { group: string; key: string; readOnly?: boolean }[] =>
			(
				dialog as unknown as {
					tabs: () => readonly {
						sections: readonly { controls: readonly { group: string; key: string }[] }[];
					}[];
				}
			)
				.tabs()
				.flatMap((tab) => tab.sections.flatMap((section) => section.controls));
		const find = (key: string) => controls().find((control) => control.key === key);
		expect(find('userName')).toBeDefined();
		service.api.hideSetting('general.userName');
		expect(find('userName')).toBeUndefined();
		service.api.lockSetting('advanced.showGrid', true);
		expect(find('showGrid')?.readOnly).toBeTruthy();
	});
});

describe('options pane read-only controls', () => {
	it('never emits a change for a locked control', () => {
		const pane = construct(Injector.create({ providers: [] }), () => new OptionsPaneComponent());
		const emitted: OptionValueChange[] = [];
		vi.spyOn(pane.valueChange as OutputEmitterRef<OptionValueChange>, 'emit').mockImplementation(
			(value) => emitted.push(value),
		);
		const control: ViewerOptionsToggleControl = {
			kind: 'toggle',
			group: 'advanced',
			key: 'showGrid',
			labelKey: 'pptx.options.advanced.showGrid',
		};
		const box = document.createElement('input');
		box.type = 'checkbox';
		box.checked = true;
		const toggle = (target: ViewerOptionsToggleControl) =>
			(
				pane as unknown as { emitToggle: (c: ViewerOptionsToggleControl, e: Event) => void }
			).emitToggle(target, { target: box } as unknown as Event);
		toggle({ ...control, readOnly: true });
		expect(emitted).toStrictEqual([]);
		toggle(control);
		expect(emitted).toStrictEqual([{ group: 'advanced', key: 'showGrid', value: true }]);
	});
});

describe('backstage under customisation', () => {
	it('hides nav pages and cards, and leaves a hidden page for home', () => {
		const injector = makeInjector();
		const service = injector.get(ViewerCustomizationService);
		const file = construct(injector, () => new RibbonFileSectionComponent());
		const view = file as unknown as {
			mainNav: () => readonly { id: string }[];
			page: { set: (id: string) => void };
			currentPage: () => string;
			actions: () => readonly { titleKey: string }[];
		};
		view.page.set('export');
		expect(view.currentPage()).toBe('export');
		const pdfTitle = 'pptx.backstage.card.pdf.title';
		expect(view.actions().some((a) => a.titleKey === pdfTitle)).toBeTruthy();
		service.api.hideBackstageCard('pdf');
		expect(view.actions().some((a) => a.titleKey === pdfTitle)).toBeFalsy();
		service.api.hideBackstagePage('export');
		expect(view.mainNav().map((item) => item.id)).not.toContain('export');
		expect(view.currentPage()).toBe('home');
	});
});

describe('context menus under customisation', () => {
	it('drops a hidden element command and renders nothing when disabled', () => {
		const editor = new EditorStateService();
		editor.setSlides([
			{
				id: 's1',
				rId: 'r1',
				slideNumber: 1,
				elements: [{ id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10 }],
			},
		]);
		editor.selectedIds.set(['a']);
		const injector = makeInjector([
			{ provide: EditorStateService, useValue: editor },
			{ provide: ViewerInspectorPanelService, useValue: {} },
			{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
		]);
		const service = injector.get(ViewerCustomizationService);
		const menu = construct(injector, () => new EditorContextMenuComponent());
		Object.defineProperty(menu, 'slideIndex', { value: () => 0 });
		const ids = () =>
			(menu as unknown as { entries: () => { id: string }[] }).entries().map((e) => e.id);
		expect(ids()).toContain('copy');
		service.api.hideContextMenuCommand('copy');
		expect(ids()).not.toContain('copy');
		expect(ids().length).toBeGreaterThan(0);
		service.api.updateCustomization({ contextMenu: { disableElementMenu: true } });
		expect(ids()).toStrictEqual([]);
	});

	it('drops a hidden canvas command', () => {
		const injector = makeInjector([
			{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
		]);
		const service = injector.get(ViewerCustomizationService);
		const menu = construct(injector, () => new SlideCanvasContextMenuComponent());
		const ids = () =>
			(menu as unknown as { entries: () => { id: string }[] }).entries().map((e) => e.id);
		expect(ids()).toContain('grid-and-guides');
		service.api.hideCanvasContextMenuCommand('grid-and-guides');
		expect(ids()).not.toContain('grid-and-guides');
		service.api.updateCustomization({ contextMenu: { disableCanvasMenu: true } });
		expect(ids()).toStrictEqual([]);
	});
});

describe('print dialog gate', () => {
	it('makes openDialog a no-op once the host removes the print dialog', () => {
		const injector = makeInjector([
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
			PrintService,
		]);
		const print = injector.get(PrintService);
		injector.get(ViewerCustomizationService).api.setDialogAvailable('print', false);
		print.openDialog();
		expect(print.isDialogOpen()).toBeFalsy();
		injector.get(ViewerCustomizationService).api.setDialogAvailable('print', true);
		print.openDialog();
		expect(print.isDialogOpen()).toBeTruthy();
	});
});
