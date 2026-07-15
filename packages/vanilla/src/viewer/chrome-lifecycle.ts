import type { TextSegment } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';

import { buildChromeCallbacks } from './chrome-callbacks';
import type { ChromeCallbackDeps } from './chrome-callbacks';
import type { EditActions } from './editor';
import type { FindReplaceActions } from './editor/editor-find-replace-actions';
import type { Translator } from './i18n';
import type { RenderController } from './render-controller';
import type { DrawTool, Store, ViewerState } from './state';
import { applyThemeVars } from './theme-apply';
import type { PptxViewerOptions } from './types';
import type { PresentationController, ViewerChrome } from './ui';
import {
	attachKeyboardNavigation,
	attachTouchGestures,
	buildViewerChrome,
	createPresentationController,
} from './ui';
import type { CommandSearchCommand } from './ui/command-search';

/** The mutable pieces `PptxViewer` owns for one chrome mount lifecycle. */
export interface ChromeLifecycle {
	chrome: ViewerChrome;
	presentation: PresentationController;
	detachKeyboard: () => void;
	detachTouchGestures: () => void;
	resizeObserver: ResizeObserver | null;
	appliedThemeVars: string[];
}

export interface MountChromeDeps extends ChromeCallbackDeps {
	doc: Document;
	container: HTMLElement;
	t: Translator;
	options: PptxViewerOptions;
	store: Store<ViewerState>;
	renderer: RenderController;
	goToFirstSlide(): void;
	goToLastSlide(): void;
	exitPresentation(): void;
}

/**
 * Build the chrome DOM, wire keyboard nav + the Fullscreen presentation
 * controller + a fit-zoom resize observer, and mount it into `container`.
 * Extracted from `PptxViewer` so the class stays under the file-size budget;
 * pure aside from the DOM/observer side effects the chrome itself requires.
 */
export function mountChrome(deps: MountChromeDeps): ChromeLifecycle {
	const { doc, container, t, options, store, renderer } = deps;
	const chrome = buildViewerChrome(doc, t, {
		showToolbar: options.showToolbar ?? true,
		showThumbnails: options.showThumbnails ?? true,
		showFormatToolbar: options.showFormatToolbar ?? true,
		showInspector: options.showInspector ?? true,
		editable: options.editable ?? false,
		titleBar: {
			fileName: options.fileName,
			autosaveEnabled: options.autosave ?? false,
			onToggleAutosave: () => deps.toggleAutosave(),
			save: () => deps.save(),
			undo: () => deps.undo(),
			redo: () => deps.redo(),
			commands: buildTitleBarCommands(deps),
		},
		...buildChromeCallbacks(deps),
	});
	const appliedThemeVars = applyThemeVars(chrome.root, options.theme, []);
	container.appendChild(chrome.root);
	chrome.statusBar?.setNotesExpanded(store.get().notesExpanded);
	chrome.statusBar?.setDirty(store.get().dirty);
	chrome.mobileActionSheets?.setNotesExpanded(store.get().notesExpanded);
	chrome.titleBar?.setDirty(store.get().dirty);

	const detachKeyboard = attachKeyboardNavigation(chrome.root, {
		next: deps.next,
		prev: deps.prev,
		first: deps.goToFirstSlide,
		last: deps.goToLastSlide,
		escape: deps.exitPresentation,
	});
	const detachTouchGestures = attachTouchGestures(chrome.root, {
		getScale: () => renderer.effectiveScale(),
		onPinchZoom: (zoom) => store.set({ zoom }),
		isSwipeEnabled: () => {
			const state = store.get();
			return state.presenting || !state.editable;
		},
		onNext: () => deps.next(),
		onPrevious: () => deps.prev(),
	});
	const presentation = createPresentationController(chrome.root, (presenting) => {
		store.set({ presenting });
	});

	let resizeObserver: ResizeObserver | null = null;
	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			if (store.get().zoom === 'fit') {
				renderer.renderStage();
			}
		});
		resizeObserver.observe(chrome.viewport);
	}

	return {
		chrome,
		presentation,
		detachKeyboard,
		detachTouchGestures,
		resizeObserver,
		appliedThemeVars,
	};
}

/** The local command palette mirrors React's most useful quick actions. */
function buildTitleBarCommands(deps: MountChromeDeps): readonly CommandSearchCommand[] {
	return [
		{ labelKey: 'pptx.titleBar.save', run: () => deps.save() },
		{ labelKey: 'pptx.toolbar.undo', run: () => deps.undo() },
		{ labelKey: 'pptx.toolbar.redo', run: () => deps.redo() },
	];
}

/** Tear down everything `mountChrome` set up, in reverse order. */
export function unmountChrome(lifecycle: ChromeLifecycle, detachEditorChrome: () => void): void {
	detachEditorChrome();
	lifecycle.detachKeyboard();
	lifecycle.detachTouchGestures();
	lifecycle.resizeObserver?.disconnect();
	lifecycle.presentation.dispose();
	lifecycle.chrome.root.remove();
}

/** The subset of `PptxViewer` needed to build its `MountChromeDeps`. */
export interface ChromeHost {
	doc: Document;
	container: HTMLElement;
	t: Translator;
	options: PptxViewerOptions;
	store: Store<ViewerState>;
	renderer: RenderController;
	lifecycle: ChromeLifecycle;
	editor: {
		commitNotes(notes: string, notesSegments?: TextSegment[]): void;
		getEditActions(): EditActions;
		getFindReplaceActions(): FindReplaceActions;
		setDrawTool(tool: DrawTool): void;
		setDrawColor(color: string): void;
		setDrawWidth(width: number): void;
	};
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	undo(): void;
	redo(): void;
	toggleAutosave(): boolean;
	downloadPptx(): Promise<void>;
	toggleNotes(): void;
	goToSlide(index: number): void;
	getSlideCount(): number;
	enterPresentation(): Promise<void>;
	openPresenterView(): void;
	exitPresentation(): Promise<void>;
	openBroadcast(): void;
	openAccessibility(): void;
	toggleTemplateEditing(): void;
	toggleMasterNavigation(): void;
	exportSlidePng(): Promise<void>;
	exportPdf(): Promise<void>;
	exportGif(): Promise<void>;
	exportVideo(): Promise<void>;
	print(): Promise<boolean>;
	setTheme(theme: ViewerTheme | undefined): void;
}

/** Build `mountChrome`'s deps from the live viewer instance. */
export function buildMountChromeDeps(host: ChromeHost): MountChromeDeps {
	return {
		doc: host.doc,
		container: host.container,
		t: host.t,
		options: host.options,
		store: host.store,
		renderer: host.renderer,
		prev: () => host.prev(),
		next: () => host.next(),
		zoomIn: () => host.zoomIn(),
		zoomOut: () => host.zoomOut(),
		zoomToFit: () => host.zoomToFit(),
		togglePresentation: () =>
			void (host.lifecycle.presentation.isActive()
				? host.exitPresentation()
				: host.enterPresentation()),
		undo: () => host.undo(),
		redo: () => host.redo(),
		toggleAutosave: () => host.toggleAutosave(),
		startPresentationFromBeginning: () => {
			host.goToSlide(0);
			void host.enterPresentation();
		},
		startPresentationFromCurrent: () => void host.enterPresentation(),
		openPresenterView: () => host.openPresenterView(),
		openBroadcast: () => host.openBroadcast(),
		openAccessibility: () => host.openAccessibility(),
		toggleTemplateEditing: () => host.toggleTemplateEditing(),
		toggleMasterNavigation: () => host.toggleMasterNavigation(),
		save: () => void host.downloadPptx(),
		toggleNotes: () => host.toggleNotes(),
		goToSlide: (index) => host.goToSlide(index),
		goToFirstSlide: () => host.goToSlide(0),
		goToLastSlide: () => host.goToSlide(host.getSlideCount() - 1),
		exitPresentation: () => void host.exitPresentation(),
		commitNotes: (notes, notesSegments) => host.editor.commitNotes(notes, notesSegments),
		exportSlidePng: () => host.exportSlidePng(),
		exportPdf: () => host.exportPdf(),
		exportGif: () => host.exportGif(),
		exportVideo: () => host.exportVideo(),
		print: () => host.print(),
		getEditActions: () => host.editor.getEditActions(),
		getFindReplaceActions: () => host.editor.getFindReplaceActions(),
		setTheme: (theme) => host.setTheme(theme),
		setDrawTool: (tool) => host.editor.setDrawTool(tool),
		setDrawColor: (color) => host.editor.setDrawColor(color),
		setDrawWidth: (width) => host.editor.setDrawWidth(width),
	};
}
