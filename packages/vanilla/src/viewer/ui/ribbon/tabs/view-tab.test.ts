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
		openComments: vi.fn(),
		openHyperlink: vi.fn(),
		toggleViewOption: vi.fn(),
		addGuide: vi.fn(),
		activateEyedropper: vi.fn(),
		toggleSpellCheck: vi.fn(),
		...over,
	};
}

function button(tab: { el: HTMLElement }, label: string): HTMLButtonElement {
	const match = [...tab.el.querySelectorAll<HTMLButtonElement>('button')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing view command: ${label}`);
	}
	return match;
}

describe('createViewTab', () => {
	it('offers every command React groups under Presentation Views, Master Views and Window', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		for (const label of [
			t('pptx.view.normal'),
			t('pptx.slideSorter.title'),
			t('pptx.view.readingView'),
			t('pptx.master.title'),
			t('pptx.master.handoutMasterTitle'),
			t('pptx.master.notesMasterTitle'),
			t('pptx.view.macros'),
		]) {
			expect(button(tab, label)).toBeTruthy();
		}
	});

	it('offers the Show group including Guides and the two guide commands', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		for (const label of [
			t('pptx.ruler.rulers'),
			t('pptx.grid.grid'),
			t('pptx.view.guides'),
			t('pptx.view.snapToGrid'),
			t('pptx.view.selection'),
			t('pptx.view.hGuide'),
			t('pptx.view.vGuide'),
		]) {
			expect(button(tab, label)).toBeTruthy();
		}
	});

	it('does not duplicate the status bar navigation', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		for (const label of [
			t('pptx.statusBar.zoomIn'),
			t('pptx.statusBar.zoomOut'),
			t('pptx.statusBar.slideShow'),
			t('pptx.statusBar.toggleNotes'),
		]) {
			expect(() => button(tab, label)).toThrow();
		}
	});

	it('gives Guides and Snap to shape one flag each', () => {
		const t = createTranslator();
		const toggleViewOption = vi.fn();
		const tab = createViewTab(document, t, makeHandlers({ toggleViewOption }));
		const snapShape = button(tab, t('pptx.view.snapToShape'));
		// Guides used to drive shape snapping, which left this command a
		// permanently disabled label for a feature that lived elsewhere.
		expect(snapShape.disabled).toBeFalsy();

		button(tab, t('pptx.view.guides')).click();
		snapShape.click();
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
		expect(button(tab, t('pptx.view.snapToShape')).getAttribute('aria-pressed')).toBe('true');
		expect(button(tab, t('pptx.ruler.rulers')).getAttribute('aria-pressed')).toBe('true');
		expect(button(tab, t('pptx.view.guides')).getAttribute('aria-pressed')).toBe('false');
		expect(button(tab, t('pptx.grid.grid')).getAttribute('aria-pressed')).toBe('false');
	});

	it('adds a guide per axis and returns to the normal view', () => {
		const t = createTranslator();
		const addGuide = vi.fn();
		const normalView = vi.fn();
		const tab = createViewTab(document, t, makeHandlers({ addGuide, normalView }));
		button(tab, t('pptx.view.hGuide')).click();
		button(tab, t('pptx.view.vGuide')).click();
		button(tab, t('pptx.view.normal')).click();
		expect(addGuide).toHaveBeenNthCalledWith(1, 'h');
		expect(addGuide).toHaveBeenNthCalledWith(2, 'v');
		expect(normalView).toHaveBeenCalledOnce();
	});

	it('renders the unimplemented commands disabled rather than omitting them', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers());
		tab.setEditable(true);
		for (const label of [
			t('pptx.view.readingView'),
			t('pptx.master.handoutMasterTitle'),
			t('pptx.master.notesMasterTitle'),
			t('pptx.slideSorter.zoom'),
			t('pptx.view.macros'),
		]) {
			expect(button(tab, label).disabled).toBeTruthy();
		}
	});

	it('hides the zoom commands when the zoom action is hidden', () => {
		const t = createTranslator();
		const tab = createViewTab(document, t, makeHandlers(), ['zoom']);
		expect(() => button(tab, t('pptx.view.zoomToFit'))).toThrow();
		expect(() => button(tab, t('pptx.slideSorter.zoom'))).toThrow();
	});
});
