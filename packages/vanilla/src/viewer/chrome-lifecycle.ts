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
import { attachKeyboardNavigation, buildViewerChrome, createPresentationController } from './ui';

/** The mutable pieces `PptxViewer` owns for one chrome mount lifecycle. */
export interface ChromeLifecycle {
	chrome: ViewerChrome;
	presentation: PresentationController;
	detachKeyboard: () => void;
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
		...buildChromeCallbacks(deps),
	});
	const appliedThemeVars = applyThemeVars(chrome.root, options.theme, []);
	container.appendChild(chrome.root);

	const detachKeyboard = attachKeyboardNavigation(chrome.root, {
		next: deps.next,
		prev: deps.prev,
		first: deps.goToFirstSlide,
		last: deps.goToLastSlide,
		escape: deps.exitPresentation,
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

	return { chrome, presentation, detachKeyboard, resizeObserver, appliedThemeVars };
}

/** Tear down everything `mountChrome` set up, in reverse order. */
export function unmountChrome(lifecycle: ChromeLifecycle, detachEditorChrome: () => void): void {
	detachEditorChrome();
	lifecycle.detachKeyboard();
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
		commitNotes(notes: string): void;
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
	downloadPptx(): Promise<void>;
	toggleNotes(): void;
	goToSlide(index: number): void;
	getSlideCount(): number;
	enterPresentation(): Promise<void>;
	exitPresentation(): Promise<void>;
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
		save: () => void host.downloadPptx(),
		toggleNotes: () => host.toggleNotes(),
		goToSlide: (index) => host.goToSlide(index),
		goToFirstSlide: () => host.goToSlide(0),
		goToLastSlide: () => host.goToSlide(host.getSlideCount() - 1),
		exitPresentation: () => void host.exitPresentation(),
		commitNotes: (notes) => host.editor.commitNotes(notes),
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
