import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { NotesPanel } from './notes-panel';
import { createNotesPanel } from './notes-panel';
import type { ThumbnailRail } from './thumbnails';
import { createThumbnailRail } from './thumbnails';
import type { Toolbar, ToolbarHandlers } from './toolbar';
import { createToolbar } from './toolbar';

export interface ChromeOptions {
	showToolbar: boolean;
	showThumbnails: boolean;
	toolbarHandlers: ToolbarHandlers;
	onSelectSlide(index: number): void;
	/** Header click on the notes panel; shares the toolbar Notes button's handler. */
	onToggleNotes(): void;
	/** Fired when the notes textarea commits (change/blur) in editable mode. */
	onCommitNotes(notes: string): void;
}

/** The viewer's static DOM skeleton plus the mutable overlay controls. */
export interface ViewerChrome {
	/** `.pptxv` root (focusable; keyboard navigation attaches here). */
	root: HTMLElement;
	toolbar: Toolbar | null;
	thumbnails: ThumbnailRail | null;
	/** Scrollable centring viewport around the stage. */
	viewport: HTMLElement;
	/** Box sized to `canvasSize * scale`; the rendered stage goes inside. */
	stageWrap: HTMLElement;
	/** Collapsible speaker-notes panel docked below the slide area. */
	notes: NotesPanel;
	setLoading(loading: boolean): void;
	setError(message: string | null): void;
	setEmpty(empty: boolean): void;
	setPresenting(presenting: boolean): void;
}

/**
 * Build the viewer chrome: toolbar (optional), thumbnail rail (optional),
 * viewport + stage host, and the loading/error/empty overlays. Pure DOM
 * assembly; all behaviour is wired by the caller through the handlers.
 */
export function buildViewerChrome(
	doc: Document,
	t: Translator,
	options: ChromeOptions,
): ViewerChrome {
	const root = createEl(doc, 'div', 'pptxv');
	root.tabIndex = 0;
	root.setAttribute('role', 'application');

	let toolbar: Toolbar | null = null;
	if (options.showToolbar) {
		toolbar = createToolbar(doc, t, options.toolbarHandlers);
		root.appendChild(toolbar.el);
	}

	const body = createEl(doc, 'div', 'pptxv-body');
	root.appendChild(body);

	let thumbnails: ThumbnailRail | null = null;
	if (options.showThumbnails) {
		thumbnails = createThumbnailRail(doc, t, options.onSelectSlide);
		body.appendChild(thumbnails.el);
	}

	const viewport = createEl(doc, 'div', 'pptxv-viewport');
	viewport.setAttribute('data-pptx-viewport', '');
	body.appendChild(viewport);

	const stageWrap = createEl(doc, 'div', 'pptxv-stage-wrap');
	viewport.appendChild(stageWrap);

	const emptyMessage = createEl(doc, 'div', 'pptxv-empty');
	emptyMessage.textContent = t('pptx.statusBar.noSlides');
	emptyMessage.hidden = true;
	viewport.appendChild(emptyMessage);

	// Docked below the slide area (thumbnails + viewport), spanning the full
	// chrome width, so it stays visible regardless of the thumbnail rail.
	const notes = createNotesPanel(doc, t, options.onToggleNotes, options.onCommitNotes);
	root.appendChild(notes.el);

	const loadingOverlay = createEl(doc, 'div', 'pptxv-overlay pptxv-loading');
	loadingOverlay.textContent = t('common.loading');
	loadingOverlay.hidden = true;
	root.appendChild(loadingOverlay);

	const errorOverlay = createEl(doc, 'div', 'pptxv-overlay pptxv-error');
	errorOverlay.setAttribute('role', 'alert');
	const errorMessage = createEl(doc, 'div', 'pptxv-error-message');
	errorOverlay.appendChild(errorMessage);
	errorOverlay.hidden = true;
	root.appendChild(errorOverlay);

	return {
		root,
		toolbar,
		thumbnails,
		viewport,
		stageWrap,
		notes,
		setLoading(loading) {
			loadingOverlay.hidden = !loading;
		},
		setError(message) {
			errorOverlay.hidden = message === null;
			errorMessage.textContent = message ?? '';
		},
		setEmpty(empty) {
			emptyMessage.hidden = !empty;
			stageWrap.hidden = empty;
		},
		setPresenting(presenting) {
			root.classList.toggle('pptxv-presenting', presenting);
		},
	};
}
