import { describe, expect, it, vi } from 'vitest';

import type { EditActions } from '../../editor/editor-edit-ops';
import type { FindReplaceActions } from '../../editor/editor-find-replace-actions';
import { createTranslator } from '../../i18n';
import { createRibbon } from './ribbon';
import type { RibbonHandlers, RibbonInsertHandlers } from './ribbon-types';

/** A fake action bag: every method access returns a fresh `vi.fn()`, memoised. */
function fakeActions<T extends object>(): T {
	const cache = new Map<string, ReturnType<typeof vi.fn>>();
	return new Proxy({} as T, {
		get(_target, prop) {
			if (typeof prop !== 'string') {
				return undefined;
			}
			let fn = cache.get(prop);
			if (!fn) {
				fn = vi.fn();
				cache.set(prop, fn);
			}
			return fn;
		},
	});
}

function buildHandlers(): RibbonHandlers {
	return {
		nav: {
			prev: vi.fn(),
			next: vi.fn(),
			zoomIn: vi.fn(),
			zoomOut: vi.fn(),
			zoomToFit: vi.fn(),
			togglePresentation: vi.fn(),
			toggleNotes: vi.fn(),
			openAccessibility: vi.fn(),
		},
		primary: { undo: vi.fn(), redo: vi.fn(), save: vi.fn() },
		file: {
			save: vi.fn(),
			exportPng: vi.fn(),
			exportPdf: vi.fn(),
			exportGif: vi.fn(),
			exportVideo: vi.fn(),
			print: vi.fn(),
		},
		slideShow: {
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
			openBroadcast: vi.fn(),
		},
		insert: fakeActions<RibbonInsertHandlers>(),
		edit: fakeActions<EditActions>(),
		findReplace: fakeActions<FindReplaceActions>(),
		design: { setTheme: vi.fn() },
		draw: { setTool: vi.fn(), setColor: vi.fn(), setWidth: vi.fn() },
	};
}

describe('createRibbon', () => {
	it('defaults to the Home tab visible, others hidden', () => {
		const t = createTranslator();
		const ribbon = createRibbon(document, t, buildHandlers());
		const panes = ribbon.el.querySelectorAll<HTMLElement>('.pptxv-ribbon-tab-content');
		const visible = Array.from(panes).filter((p) => !p.hidden);
		expect(visible).toHaveLength(1);
	});

	it('switches the visible tab pane when a tab button is clicked', () => {
		const t = createTranslator();
		const ribbon = createRibbon(document, t, buildHandlers());
		const tabs = ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab');
		// [file, home, insert, draw, design, transitions, animations, slide show, view]
		tabs[2].click();
		const panes = ribbon.el.querySelectorAll<HTMLElement>('.pptxv-ribbon-tab-content');
		const visible = Array.from(panes).filter((p) => !p.hidden);
		expect(visible).toHaveLength(1);
		expect(visible[0].querySelector('.pptxv-shape-grid')).toBeTruthy();
	});

	it('dispatches the supported Slide Show actions', () => {
		const t = createTranslator();
		const handlers = buildHandlers();
		const ribbon = createRibbon(document, t, handlers);
		const tabs = ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab');
		tabs[7].click();
		ribbon.el
			.querySelector<HTMLButtonElement>(
				`[aria-label="${t('pptx.slideShow.fromBeginningTooltip')}"]`,
			)
			?.click();
		ribbon.el
			.querySelector<HTMLButtonElement>(`[aria-label="${t('pptx.slideShow.fromCurrentTooltip')}"]`)
			?.click();
		ribbon.el
			.querySelector<HTMLButtonElement>(`[aria-label="${t('pptx.slideShow.broadcastTooltip')}"]`)
			?.click();
		expect(handlers.slideShow.startFromBeginning).toHaveBeenCalledOnce();
		expect(handlers.slideShow.startFromCurrent).toHaveBeenCalledOnce();
		expect(handlers.slideShow.openBroadcast).toHaveBeenCalledOnce();
	});

	it('setEditState hides the primary row and tab bar when not editable', () => {
		const t = createTranslator();
		const ribbon = createRibbon(document, t, buildHandlers());
		ribbon.setEditState({ editable: false, canUndo: false, canRedo: false });
		expect(ribbon.el.querySelector<HTMLElement>('.pptxv-ribbon-primary')?.hidden).toBeTruthy();
		expect(ribbon.el.querySelector<HTMLElement>('.pptxv-ribbon-tabs')?.hidden).toBeTruthy();

		ribbon.setEditState({ editable: true, canUndo: true, canRedo: false });
		expect(ribbon.el.querySelector<HTMLElement>('.pptxv-ribbon-primary')?.hidden).toBeFalsy();
		expect(ribbon.el.querySelector<HTMLElement>('.pptxv-ribbon-tabs')?.hidden).toBeFalsy();
	});

	it('does not duplicate status-bar navigation above the ribbon tabs', () => {
		const t = createTranslator();
		const ribbon = createRibbon(document, t, buildHandlers());
		ribbon.update({ current: 1, total: 5, zoomPercent: 150 });
		expect(ribbon.el.querySelector('.pptxv-ribbon-nav')).toBeNull();
		expect(ribbon.el.querySelector('.pptxv-counter')).toBeNull();
	});
});
