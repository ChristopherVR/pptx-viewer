import {
	applyAcceptAllSlides,
	applyAcceptSlide,
	applyRehearsalTimings,
	compareSlides,
	DEFAULT_VIEWER_SETTINGS,
	openPptxFile,
} from 'pptx-viewer-shared';
import type { ViewerSettings } from 'pptx-viewer-shared';

import type { EditorController } from './editor';
import type { PrintOptions } from './export/export-print';
import type { Translator } from './i18n';
import { loadPresentation, revokeBlobUrls } from './load/load-presentation';
import type { Store, ViewerState } from './state';
import { openCommentsPanel } from './ui/comments-panel';
import { openComparePanel } from './ui/compare-panel';
import { openCustomShowsDialog } from './ui/custom-shows-dialog';
import { openHeaderFooterDialog } from './ui/header-footer-dialog';
import { openHyperlinkEditDialog } from './ui/hyperlink-edit-dialog';
import { openPrintSettingsDialog } from './ui/print-settings-dialog';
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
	root(): HTMLElement;
	setAutosaveEnabled(enabled: boolean): void;
	print(options: PrintOptions): Promise<boolean>;
	goToSlide(index: number): void;
	enterPresentation(): Promise<void>;
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
	openComments(): void;
	openHyperlink(): void;
	openCustomShows(): void;
}

export function createParityWorkflows(
	host: ParityWorkflowHost,
	autosave: boolean,
): ParityWorkflows {
	let settings: ViewerSettings = { ...DEFAULT_VIEWER_SETTINGS, autoSave: autosave };
	const state = (): ViewerState => host.store.get();
	return {
		openSettings(tab = 'general') {
			openSettingsDialog(
				host.doc,
				host.t,
				{ ...settings },
				(next) => {
					const autosaveChanged = next.autoSave !== settings.autoSave;
					settings = next;
					const root = host.root();
					root.classList.toggle('pptxv-show-grid', next.showGrid);
					root.classList.toggle('pptxv-show-rulers', next.showRulers);
					root.classList.toggle('pptxv-reduced-motion', next.reducedMotion);
					if (autosaveChanged) {
						host.setAutosaveEnabled(next.autoSave);
					}
				},
				tab,
			);
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
		openComments() {
			const current = state();
			openCommentsPanel(
				host.doc,
				host.root(),
				host.t,
				current.slides[current.currentSlide]?.comments ?? [],
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
			openCustomShowsDialog(
				host.doc,
				host.t,
				current.customShows,
				current.slides,
				(shows) => host.editor.updateCustomShows(shows),
				(show) => {
					const first = current.slides.findIndex(({ rId }) => show.slideRIds.includes(rId));
					if (first >= 0) {
						host.goToSlide(first);
					}
					void host.enterPresentation();
				},
			);
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
