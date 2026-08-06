import type { PptxSlide } from 'pptx-viewer-core';
import {
	applyAcceptAllSlides,
	applyAcceptSlide,
	applyRehearsalTimings,
	compareSlides,
	openPptxFile,
} from 'pptx-viewer-shared';
import type {
	ThemeCatalogEntry,
	ViewerOptionsStore,
	ViewerOptionsTabId,
	ViewerTheme,
} from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';

import type { EditorController } from './editor';
import type { PrintOptions } from './export/export-print';
import type { Translator } from './i18n';
import { loadPresentation, revokeBlobUrls } from './load/load-presentation';
import { createOutlineWorkflow } from './outline-workflow';
import type { Store, ViewerState } from './state';
import { openCommentsPanel } from './ui/comments-panel';
import { openComparePanel } from './ui/compare-panel';
import { openCustomShowsDialog } from './ui/custom-shows-dialog';
import { openHeaderFooterDialog } from './ui/header-footer-dialog';
import { openHyperlinkEditDialog } from './ui/hyperlink-edit-dialog';
import { openPrintSettingsDialog } from './ui/print-settings-dialog';
import type { ReadingViewHandle } from './ui/reading-view';
import { openReadingViewOverlay } from './ui/reading-view';
import { openRehearseTimings } from './ui/rehearse-timings';
import { openSelectionPane } from './ui/selection-pane';
import { openSettingsDialog } from './ui/settings-dialog';
import { openSlideShowDialog } from './ui/slide-show-dialog';
import { openSlideSorterOverlay } from './ui/slide-sorter-overlay';

export interface ParityWorkflowHost {
	doc: Document;
	t: Translator;
	store: Store<ViewerState>;
	editor: EditorController;
	/** The File > Options store the Options dialog reads and writes. */
	optionsStore: ViewerOptionsStore;
	/** Options > Save > "Delete cached files". */
	clearOptionsCache(): void;
	/** Whether the host enabled the `ai` option (adds the Options > AI section). */
	aiEnabled: boolean;
	root(): HTMLElement;
	setAutosaveEnabled(enabled: boolean): void;
	print(options: PrintOptions): Promise<boolean>;
	goToSlide(index: number): void;
	/** Static single-slide render (`RenderController.renderSlideNode`) for Reading View. */
	renderSlideNode(slide: PptxSlide, scale: number): HTMLElement;
	enterPresentation(): Promise<void>;
	/** Apply a viewer chrome theme (same mechanism as `PptxViewer.setTheme`); persists via the viewer's own precedence. */
	setTheme(theme: ViewerTheme | undefined): void;
	/** Switch the UI locale (same mechanism as `PptxViewer.setLocale`); persists via the viewer's own precedence. */
	setLocale(locale: string): void;
	/** The viewer's live theme catalog + currently active key, read fresh each time Options opens. */
	getThemeState(): { key: string; catalog: readonly ThemeCatalogEntry[] };
	/** The viewer's live locale catalog + currently active code, read fresh each time Options opens. */
	getLocaleState(): { code: string; catalog: readonly LocaleCatalogEntry[] };
}

export interface ParityWorkflows {
	openSettings(tab?: 'general' | 'shortcuts'): void;
	openSetUpSlideShow(): void;
	openHeaderFooter(): void;
	openCompare(): void;
	openPrintDialog(): void;
	startRehearsal(): void;
	openSelectionPane(): void;
	openSlideSorter(): void;
	openReadingView(): void;
	/** Tear the Reading View down (viewer teardown; it owns a document listener). */
	closeReadingView(): void;
	/** Open Outline view (the deck as editable indented text). */
	openOutlineView(): void;
	/** Tear Outline view down (viewer teardown; it owns a store subscription). */
	closeOutlineView(): void;
	openComments(): void;
	openHyperlink(): void;
	openCustomShows(): void;
}

export function createParityWorkflows(host: ParityWorkflowHost): ParityWorkflows {
	const state = (): ViewerState => host.store.get();
	// Held so the viewer can tear the overlay (and its document key listener)
	// down on destroy, and so a second open never leaves an orphan behind.
	let readingView: ReadingViewHandle | null = null;
	const outline = createOutlineWorkflow(host);
	return {
		openSettings(tab = 'general') {
			const themeState = host.getThemeState();
			const localeState = host.getLocaleState();
			// The shortcut reference lives inside the Customize Ribbon pane now.
			const initialTab: ViewerOptionsTabId = tab === 'shortcuts' ? 'ribbon' : 'general';
			// A LIVE translator, not the current `host.t` value: picking a language
			// inside the dialog reassigns the viewer's translator, and the open
			// dialog re-renders itself with whatever `host.t` is by then.
			openSettingsDialog(host.doc, (key, params) => host.t(key, params), {
				store: host.optionsStore,
				initialTab,
				aiEnabled: host.aiEnabled,
				onClearCache: () => host.clearOptionsCache(),
				themeOptions: {
					catalog: themeState.catalog,
					currentKey: themeState.key,
					onSelect: (theme) => host.setTheme(theme),
				},
				localeOptions: {
					catalog: localeState.catalog,
					currentCode: localeState.code,
					onSelect: (code) => host.setLocale(code),
				},
			});
		},
		openSetUpSlideShow() {
			const current = state();
			openSlideShowDialog(
				host.doc,
				host.t,
				current.presentationProperties,
				current.slides.length,
				(value) => host.editor.updatePresentationProperties(value),
			);
		},
		openHeaderFooter() {
			openHeaderFooterDialog(host.doc, host.t, {
				value: state().headerFooter,
				onApply: (value) => host.editor.updateHeaderFooter(value),
			});
		},
		openCompare() {
			void comparePresentation(host);
		},
		openPrintDialog() {
			openPrintSettingsDialog(host.doc, host.t, state().slides.length, (options) => {
				void host.print(options);
			});
		},
		startRehearsal() {
			openRehearseTimings(host.doc, host.root(), host.t, {
				slideCount: state().slides.length,
				currentSlide: () => state().currentSlide,
				navigate: host.goToSlide,
				onSave: (timings) =>
					host.editor.commitSlides(applyRehearsalTimings(state().slides, timings)),
			});
		},
		openSelectionPane() {
			openObjectSelection(host);
		},
		openSlideSorter() {
			openSorter(host);
		},
		openReadingView() {
			const current = state();
			readingView?.close();
			readingView = openReadingViewOverlay(host.doc, host.root(), host.t, {
				slides: current.slides,
				canvasSize: current.canvasSize,
				initialSlideIndex: current.currentSlide,
				renderStage: (slide, scale) => host.renderSlideNode(slide, scale),
				// Reading View hands the reader back on the slide they stopped at.
				onExit: (slideIndex) => {
					readingView = null;
					host.goToSlide(slideIndex);
				},
			});
		},
		closeReadingView() {
			readingView?.close();
			readingView = null;
		},
		openOutlineView() {
			outline.open();
		},
		closeOutlineView() {
			outline.close();
		},
		openComments() {
			openCommentsPanel(
				host.doc,
				host.root(),
				host.t,
				{
					getComments: () => {
						const current = state();
						return current.slides[current.currentSlide]?.comments ?? [];
					},
					subscribe: (listener) => host.store.subscribe(() => listener()),
				},
				host.editor.getEditActions().comments,
			);
		},
		openHyperlink() {
			const current = state();
			const element = current.slides[current.currentSlide]?.elements.find(
				({ id }) => id === current.selectedElementId,
			);
			if (element) {
				openHyperlinkEditDialog(host.doc, host.t, element, (patch) =>
					host.editor.applyElementPatch(element.id, patch),
				);
			}
		},
		openCustomShows() {
			const current = state();
			openCustomShowsDialog(host.doc, host.t, {
				shows: current.customShows,
				slides: current.slides,
				activeShowId: current.activeCustomShowId,
				onSave: (shows) => host.editor.updateCustomShows(shows),
				// The id lives in viewer state, not the editor's document state: it is
				// a playback choice for this session, not an edit to the deck, so it
				// must not enter the undo history or mark the file dirty.
				onSetActive: (id) => host.store.set({ activeCustomShowId: id }),
				onRun: (show) => {
					const first = state().slides.findIndex(({ rId }) => show.slideRIds.includes(rId));
					if (first >= 0) {
						host.goToSlide(first);
					}
					void host.enterPresentation();
				},
			});
		},
	};
}

async function comparePresentation(host: ParityWorkflowHost): Promise<void> {
	const picked = await openPptxFile();
	if (!picked) {
		return;
	}
	const incoming = await loadPresentation(picked.buffer);
	try {
		const result = compareSlides(host.store.get().slides, incoming.slides);
		openComparePanel(host.doc, host.root(), host.t, {
			result,
			onAccept: (diff) => host.editor.commitSlides(applyAcceptSlide(host.store.get().slides, diff)),
			onAcceptAll: () =>
				host.editor.commitSlides(applyAcceptAllSlides(host.store.get().slides, result)),
		});
	} finally {
		revokeBlobUrls(incoming.blobUrls);
		incoming.handler.dispose();
	}
}

function openObjectSelection(host: ParityWorkflowHost): void {
	const current = host.store.get();
	const slide = current.slides[current.currentSlide];
	openSelectionPane(host.doc, host.root(), host.t, {
		elements: slide?.elements ?? [],
		selectedIds: current.selectedElementIds,
		onSelect: (id) => host.editor.selectElements([id]),
		onToggleHidden: (id) =>
			host.editor.applyElementPatch(id, {
				hidden: !slide?.elements.find((element) => element.id === id)?.hidden,
			}),
		onReorder: (from, to) => {
			if (!slide || from === to) {
				return;
			}
			const elements = [...slide.elements];
			const [moved] = elements.splice(from, 1);
			elements.splice(to, 0, moved);
			host.editor.commitSlides(
				current.slides.map((item, index) =>
					index === current.currentSlide ? { ...item, elements } : item,
				),
			);
		},
	});
}

function openSorter(host: ParityWorkflowHost): void {
	const current = host.store.get();
	openSlideSorterOverlay(host.doc, host.root(), host.t, {
		slides: current.slides,
		current: current.currentSlide,
		onSelect: host.goToSlide,
		onReorder: (from, to) => reorderSlides(host, from, to),
		onDelete: (index) => host.editor.commitSlides(current.slides.filter((_, i) => i !== index)),
		onDuplicate: (index) => {
			const next = [...current.slides];
			next.splice(index + 1, 0, structuredClone(next[index]));
			host.editor.commitSlides(next, index + 1);
		},
		onToggleHidden: (index) =>
			host.editor.commitSlides(
				current.slides.map((slide, i) =>
					i === index ? { ...slide, hidden: !slide.hidden } : slide,
				),
			),
	});
}

function reorderSlides(host: ParityWorkflowHost, from: number, to: number): void {
	const next = [...host.store.get().slides];
	const [slide] = next.splice(from, 1);
	if (slide) {
		next.splice(to, 0, slide);
		host.editor.commitSlides(next, to);
	}
}
