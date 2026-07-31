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
		},
		primary: { undo: vi.fn(), redo: vi.fn(), save: vi.fn() },
		file: {
			openFile: vi.fn(),
			openRecentFile: vi.fn(),
			createPresentation: vi.fn(),
			openSettings: vi.fn(),
			openShare: vi.fn(),
			openDocumentProperties: vi.fn(),
			openFontEmbedding: vi.fn(),
			openDigitalSignatures: vi.fn(),
			openPasswordProtection: vi.fn(),
			openVersionHistory: vi.fn(),
			save: vi.fn(),
			saveAsPpsx: vi.fn(),
			saveAsPptm: vi.fn(),
			packageForSharing: vi.fn(),
			exportPng: vi.fn(),
			copySlideAsImage: vi.fn(),
			exportPdf: vi.fn(),
			exportGif: vi.fn(),
			exportVideo: vi.fn(),
			print: vi.fn(),
		},
		slideShow: {
			startFromBeginning: vi.fn(),
			startFromCurrent: vi.fn(),
			openPresenterView: vi.fn(),
			openBroadcast: vi.fn(),
			openSetUp: vi.fn(),
			startRehearsal: vi.fn(),
			openCustomShows: vi.fn(),
			toggleSubtitles: vi.fn(),
			openSubtitleSettings: vi.fn(),
			toggleHideSlide: vi.fn(),
		},
		insert: fakeActions<RibbonInsertHandlers>(),
		edit: fakeActions<EditActions>(),
		findReplace: fakeActions<FindReplaceActions>(),
		design: { setTheme: vi.fn(), applyPresentationTheme: vi.fn() },
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
		expect(visible[0].querySelector('.pptxv-select-button')).toBeTruthy();
	});

	it('dispatches the supported Slide Show actions', () => {
		const t = createTranslator();
		const handlers = buildHandlers();
		const ribbon = createRibbon(document, t, handlers);
		const tabs = ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab');
		tabs[7].click();
		ribbon.el
			.querySelector<HTMLButtonElement>(`[aria-label="${t('pptx.slideShow.fromBeginning')}"]`)
			?.click();
		Array.from(
			ribbon.el.querySelectorAll<HTMLButtonElement>(
				'.pptxv-ribbon-tab-content:not([hidden]) button',
			),
		)
			.find((button) => button.textContent === t('pptx.slideShow.subtitles'))
			?.click();
		Array.from(
			ribbon.el.querySelectorAll<HTMLButtonElement>(
				'.pptxv-ribbon-tab-content:not([hidden]) button',
			),
		)
			.find((button) => button.textContent === t('pptx.slideShow.subtitleSettings'))
			?.click();
		ribbon.el
			.querySelector<HTMLButtonElement>(`[aria-label="${t('pptx.slideShow.fromCurrent')}"]`)
			?.click();
		ribbon.el
			.querySelector<HTMLButtonElement>(`[aria-label="${t('pptx.slideShow.broadcast')}"]`)
			?.click();
		expect(handlers.slideShow.startFromBeginning).toHaveBeenCalledOnce();
		expect(handlers.slideShow.startFromCurrent).toHaveBeenCalledOnce();
		expect(handlers.slideShow.openBroadcast).toHaveBeenCalledOnce();
		expect(handlers.slideShow.toggleSubtitles).toHaveBeenCalledOnce();
		expect(handlers.slideShow.openSubtitleSettings).toHaveBeenCalledOnce();
		ribbon.setSubtitlesVisible(true);
		expect(
			ribbon.el
				.querySelector(`button[aria-label="${t('pptx.slideShow.subtitles')}"]`)
				?.getAttribute('aria-pressed'),
		).toBe('true');
	});

	it('opens language settings and starts recording from either record command', () => {
		const t = createTranslator();
		const handlers = buildHandlers();
		const ribbon = createRibbon(document, t, handlers);
		const tabs = ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab');
		tabs[8].click();
		const recordButtons = Array.from(
			ribbon.el.querySelectorAll<HTMLButtonElement>(
				'.pptxv-ribbon-tab-content:not([hidden]) button',
			),
		);
		// Camera / Manage / Help are disabled placeholders, as in React; only the
		// two Record commands do anything.
		const byLabel = (label: string) =>
			recordButtons.find((button) => button.getAttribute('aria-label') === label);
		expect(byLabel('Cameo')?.disabled).toBeTruthy();
		expect(byLabel('Learn More')?.disabled).toBeTruthy();
		byLabel(t('pptx.slideShow.fromBeginning'))?.click();
		byLabel(t('pptx.slideShow.fromCurrent'))?.click();
		expect(handlers.slideShow.startRehearsal).toHaveBeenCalledTimes(2);

		tabs[9].click();
		Array.from(
			ribbon.el.querySelectorAll<HTMLButtonElement>(
				'.pptxv-ribbon-tab-content:not([hidden]) button',
			),
		)
			.find((button) => button.textContent === t('pptx.review.language'))
			?.click();
		expect(handlers.nav.openSettings).toHaveBeenCalledWith('general');
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

	it('opens the PowerPoint-style backstage with save and export pages', () => {
		const t = createTranslator();
		const handlers = buildHandlers();
		const ribbon = createRibbon(document, t, handlers);
		const fileTab = Array.from(
			ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab'),
		).find((button) => button.textContent === 'File');
		fileTab?.click();
		const backstage = ribbon.el.querySelector<HTMLElement>('.pptxv-backstage');
		expect(backstage?.hidden).toBeFalsy();
		expect(backstage?.textContent).toContain('Blank Presentation');
		expect(backstage?.textContent).toContain('Recent');
		expect(backstage?.textContent).toContain('Save As');
		expect(backstage?.textContent).toContain('Export');
		const navButtons = backstage?.querySelectorAll('nav button') ?? [];
		expect(backstage?.querySelectorAll('nav button svg')).toHaveLength(navButtons.length);
		const infoButton = Array.from(navButtons).find(
			(button) => button.textContent?.trim() === 'Info',
		);
		infoButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(backstage?.querySelectorAll('.pptxv-bs-actions svg')).toHaveLength(5);
	});

	it('opens viewer settings immediately from File Options', () => {
		const handlers = buildHandlers();
		const ribbon = createRibbon(document, createTranslator(), handlers);
		Array.from(ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab'))
			.find((button) => button.textContent === 'File')
			?.click();
		const backstage = ribbon.el.querySelector<HTMLElement>('.pptxv-backstage');
		Array.from(backstage?.querySelectorAll<HTMLButtonElement>('nav button') ?? [])
			.find((button) => button.textContent?.trim() === 'Options')
			?.click();
		expect(handlers.file.openSettings).toHaveBeenCalledOnce();
	});

	it('opens the collaboration workflow from Share with People', () => {
		const handlers = buildHandlers();
		const ribbon = createRibbon(document, createTranslator(), handlers);
		Array.from(ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab'))
			.find((button) => button.textContent === 'File')
			?.click();
		const backstage = ribbon.el.querySelector<HTMLElement>('.pptxv-backstage');
		Array.from(backstage?.querySelectorAll<HTMLButtonElement>('nav button') ?? [])
			.find((button) => button.textContent?.trim() === 'Share')
			?.click();
		Array.from(backstage?.querySelectorAll<HTMLButtonElement>('main button') ?? [])
			.find((button) => button.textContent?.includes('Share with People'))
			?.click();
		expect(handlers.file.openShare).toHaveBeenCalledOnce();
	});

	it('disables editing-only Review and View commands in read-only mode', () => {
		const t = createTranslator();
		const ribbon = createRibbon(document, t, buildHandlers());
		ribbon.setEditable(false);
		const button = (label: string) =>
			ribbon.el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
		expect(button(t('pptx.ribbon.compare'))?.disabled).toBeTruthy();
		expect(button(t('pptx.master.title'))?.disabled).toBeTruthy();
		expect(button(t('pptx.ribbon.templatesOff'))?.disabled).toBeTruthy();
		expect(button(t('pptx.ribbon.eyedropper'))?.disabled).toBeTruthy();

		ribbon.setEditable(true);
		expect(button(t('pptx.ribbon.compare'))?.disabled).toBeFalsy();
		expect(button(t('pptx.master.title'))?.disabled).toBeFalsy();
		expect(button(t('pptx.ribbon.templatesOff'))?.disabled).toBeFalsy();
		expect(button(t('pptx.ribbon.eyedropper'))?.disabled).toBeFalsy();
	});

	describe('hiddenActions', () => {
		it('omitting hiddenActions renders every tab (backward compatible default)', () => {
			const t = createTranslator();
			const ribbon = createRibbon(document, t, buildHandlers());
			const tabs = ribbon.el.querySelectorAll('.pptxv-ribbon-tab');
			expect(tabs).toHaveLength(12);
		});

		it('never constructs a hidden ribbon tab: no tab button and no pane content', () => {
			const t = createTranslator();
			const ribbon = createRibbon(document, t, buildHandlers(), ['insert']);
			const tabLabels = Array.from(ribbon.el.querySelectorAll('.pptxv-ribbon-tab')).map(
				(btn) => btn.textContent,
			);
			expect(tabLabels).not.toContain(t('pptx.ribbon.tab.insert'));
			expect(ribbon.el.querySelector('.pptxv-ribbon-insert-content')).toBeNull();
		});

		it('falls back to the first visible tab (File) when the default (Home) tab is hidden', () => {
			const t = createTranslator();
			const ribbon = createRibbon(document, t, buildHandlers(), ['home']);
			// File's pane (`.pptxv-backstage`) isn't a `.pptxv-ribbon-tab-content`
			// pane like the others, so check it directly plus every other pane.
			expect(ribbon.el.querySelector<HTMLElement>('.pptxv-backstage')?.hidden).toBeFalsy();
			const otherPanes = ribbon.el.querySelectorAll<HTMLElement>('.pptxv-ribbon-tab-content');
			expect(Array.from(otherPanes).every((pane) => pane.hidden)).toBeTruthy();
		});

		it('hides the Broadcast action from the Slide Show tab', () => {
			const t = createTranslator();
			const ribbon = createRibbon(document, t, buildHandlers(), ['broadcast']);
			const tabs = ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab');
			tabs[7].click();
			expect(ribbon.el.querySelector(`[aria-label="${t('pptx.slideShow.broadcast')}"]`)).toBeNull();
		});

		it('hides the Export actions grid in the File tab', () => {
			const t = createTranslator();
			const ribbon = createRibbon(document, t, buildHandlers(), ['export']);
			const fileTab = Array.from(
				ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab'),
			).find((button) => button.textContent === 'File');
			fileTab?.click();
			const backstage = ribbon.el.querySelector<HTMLElement>('.pptxv-backstage');
			const exportNav = Array.from(backstage?.querySelectorAll('nav button') ?? []).find(
				(button) => button.textContent?.trim() === 'Export',
			);
			exportNav?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			expect(backstage?.querySelectorAll('.pptxv-bs-actions button')).toHaveLength(0);
		});

		it('hides the zoom commands from the View tab', () => {
			const t = createTranslator();
			const ribbon = createRibbon(document, t, buildHandlers(), ['zoom']);
			const tabs = ribbon.el.querySelectorAll<HTMLButtonElement>('.pptxv-ribbon-tab');
			const viewTabIndex = Array.from(tabs).findIndex(
				(button) => button.textContent === t('pptx.ribbon.tab.view'),
			);
			tabs[viewTabIndex].click();
			expect(ribbon.el.querySelector(`[aria-label="${t('pptx.view.zoomToFit')}"]`)).toBeNull();
			expect(ribbon.el.querySelector(`[aria-label="${t('pptx.slideSorter.zoom')}"]`)).toBeNull();
			// An unrelated View action stays, proving the hide is scoped to that id.
			expect(ribbon.el.querySelector(`[aria-label="${t('pptx.view.normal')}"]`)).not.toBeNull();
		});
	});
});
