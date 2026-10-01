import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonNavHandlers } from '../ribbon-types';
import { createViewTab } from './view-tab';

function makeHandlers(over: Partial<RibbonNavHandlers> = {}): RibbonNavHandlers {
	return {
		prev: vi.fn(),
		next: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		zoomToFit: vi.fn(),
		togglePresentation: vi.fn(),
		normalView: vi.fn(),
		toggleNotes: vi.fn(),
		openAccessibility: vi.fn(),
		openSettings: vi.fn(),
		openHeaderFooter: vi.fn(),
		openCompare: vi.fn(),
		openSelectionPane: vi.fn(),
		openSlideSorter: vi.fn(),
		openReadingView: vi.fn(),
		openOutlineView: vi.fn(),
		openComments: vi.fn(),
		openHyperlink: vi.fn(),
		toggleViewOption: vi.fn(),
		addGuide: vi.fn(),
		activateEyedropper: vi.fn(),
		toggleSpellCheck: vi.fn(),
		...over,
	};
}

function control(tab: { el: HTMLElement }, id: string): HTMLElement {
	const match = tab.el.querySelector<HTMLElement>(`[data-ribbon-control="${id}"]`);
	if (!match) {
		throw new Error(`missing view control: ${id}`);
	}
	return match;
}
function button(tab: { el: HTMLElement }, id: string): HTMLButtonElement {
	return control(tab, id).shadowRoot!.querySelector('button')!;
}
function toggle(tab: { el: HTMLElement }, id: string): void {
	(control(tab, id).shadowRoot!.querySelector('pptx-ui-checkbox') as HTMLElement).click();
}

describe('createViewTab', () => {
	it('offers every canonical command with translated labels', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		const labels: Record<string, string> = {
			'view.presentationViews.normal': t('pptx.view.normal'),
			'view.presentationViews.slideSorter': t('pptx.slideSorter.title'),
			'view.presentationViews.outline': t('pptx.view.outlineView'),
			'view.presentationViews.readingView': t('pptx.view.readingView'),
			'view.masterViews.slideMaster': t('pptx.master.title'),
			'view.masterViews.handoutMaster': t('pptx.master.handoutMasterTitle'),
			'view.masterViews.notesMaster': t('pptx.master.notesMasterTitle'),
			'view.show.ruler': t('pptx.ruler.rulers'),
			'view.show.gridlines': t('pptx.grid.grid'),
			'view.show.guides': t('pptx.view.guides'),
			'view.show.selectionPane': t('pptx.view.selection'),
			'view.window.macros': t('pptx.view.macros'),
		};
		for (const [id, label] of Object.entries(labels)) {
			expect(control(tab, id).getAttribute('label')).toBe(label);
		}
		expect(tab.el.querySelectorAll('[data-ribbon-group]')).toHaveLength(5);
	});

	it('does not duplicate the status bar navigation', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		const labels = [...tab.el.querySelectorAll('[label]')].map((el) => el.getAttribute('label'));
		for (const label of [
			t('pptx.statusBar.zoomIn'),
			t('pptx.statusBar.zoomOut'),
			t('pptx.statusBar.slideShow'),
			t('pptx.statusBar.toggleNotes'),
		]) {
			expect(labels).not.toContain(label);
		}
	});

	it('gives Guides and Snap to shape one flag each', () => {
		const t = createTranslator();
		const toggleViewOption = vi.fn();
		const tab = createViewTab(document, t, makeHandlers({ toggleViewOption }));
		// Guides used to drive shape snapping, which left Snap to shape a
		// permanently disabled label for a feature that lived elsewhere.
		expect(button(tab, 'view.show.snapToShape').disabled).toBeFalsy();
		toggle(tab, 'view.show.guides');
		button(tab, 'view.show.snapToShape').click();
		expect(toggleViewOption).toHaveBeenNthCalledWith(1, 'showGuides');
		expect(toggleViewOption).toHaveBeenNthCalledWith(2, 'snapToShape');
	});

	it('reflects the Show group toggles from viewer state', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		tab.setViewOptions({
			showGrid: false,
			showRulers: true,
			showGuides: false,
			snapToGrid: false,
			snapToShape: true,
		});
		expect(button(tab, 'view.show.snapToShape').getAttribute('aria-pressed')).toBe('true');
		expect(control(tab, 'view.show.ruler').hasAttribute('checked')).toBeTruthy();
		expect(control(tab, 'view.show.guides').hasAttribute('checked')).toBeFalsy();
		expect(control(tab, 'view.show.gridlines').hasAttribute('checked')).toBeFalsy();
	});

	it('adds a guide per axis and returns to the normal view', () => {
		const t = createTranslator();
		const addGuide = vi.fn();
		const normalView = vi.fn();
		const tab = createViewTab(document, t, makeHandlers({ addGuide, normalView }));
		const guides = tab.el.querySelectorAll(
			'[data-ribbon-control="view.show.addGuide"] pptx-ui-ribbon-command',
		);
		for (const guide of guides) {
			guide.shadowRoot!.querySelector('button')!.click();
		}
		button(tab, 'view.presentationViews.normal').click();
		expect(addGuide).toHaveBeenNthCalledWith(1, 'h');
		expect(addGuide).toHaveBeenNthCalledWith(2, 'v');
		expect(normalView).toHaveBeenCalledOnce();
	});

	it('renders the unimplemented commands disabled rather than omitting them', () => {
		const tab = createViewTab(document, createTranslator(), makeHandlers());
		tab.setEditable(true);
		for (const id of [
			'view.masterViews.handoutMaster',
			'view.masterViews.notesMaster',
			'view.zoom.zoom',
			'view.window.macros',
		]) {
			expect(button(tab, id).disabled).toBeTruthy();
		}
	});

	it('guards edit-only commands in read-only mode and tracks template editing', () => {
		const t = createTranslator();
		const toggleTemplateEditing = vi.fn();
		const tab = createViewTab(document, t, makeHandlers({ toggleTemplateEditing }));
		tab.setEditable(false);
		expect(button(tab, 'view.window.templateEditing').disabled).toBeTruthy();
		expect(button(tab, 'view.show.eyedropper').disabled).toBeTruthy();
		tab.setEditable(true);
		tab.setTemplateEditing(true);
		expect(control(tab, 'view.window.templateEditing').getAttribute('label')).toBe(
			t('pptx.ribbon.templatesOn'),
		);
		button(tab, 'view.window.templateEditing').click();
		expect(toggleTemplateEditing).toHaveBeenCalledOnce();
	});

	/**
	 * Reading View shipped as a permanently disabled placeholder in all five
	 * bindings, so a reader who found it in the ribbon got nothing at all.
	 */
	it('offers Reading View as a live command rather than an inert placeholder', () => {
		const openReadingView = vi.fn();
		const tab = createViewTab(document, createTranslator(), makeHandlers({ openReadingView }));
		const reading = button(tab, 'view.presentationViews.readingView');
		expect(reading.disabled).toBeFalsy();
		reading.click();
		expect(openReadingView).toHaveBeenCalledOnce();
	});

	/**
	 * The ribbon inventory spec diffs every binding against React by accessible
	 * name, so both the label and the position (between Slide Sorter and Reading
	 * View) are load-bearing, not cosmetic.
	 */
	it('offers Outline View between Slide Sorter and Reading View', () => {
		const t = createTranslator();
		const openOutlineView = vi.fn();
		const tab = createViewTab(document, t, makeHandlers({ openOutlineView }));
		const outline = button(tab, 'view.presentationViews.outline');
		expect(outline.disabled).toBeFalsy();
		expect(control(tab, 'view.presentationViews.outline').getAttribute('title')).toBe(
			t('pptx.view.outlineViewTooltip'),
		);
		const order = [
			...tab.el.querySelectorAll('[data-ribbon-group="view.presentationViews"] > *'),
		].map((el) => el.getAttribute('data-ribbon-control'));
		expect(order).toStrictEqual([
			'view.presentationViews.normal',
			'view.presentationViews.slideSorter',
			'view.presentationViews.outline',
			'view.presentationViews.readingView',
		]);
		outline.click();
		expect(openOutlineView).toHaveBeenCalledOnce();
	});

	it('hides the zoom group when the zoom action is hidden', () => {
		const tab = createViewTab(document, createTranslator(), makeHandlers(), ['zoom']);
		expect(tab.el.querySelector('[data-ribbon-group="view.zoom"]')).toBeNull();
	});
});
