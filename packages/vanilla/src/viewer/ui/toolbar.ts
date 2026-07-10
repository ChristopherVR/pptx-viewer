import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { IconName } from './icons';
import { createIcon } from './icons';

export interface ToolbarHandlers {
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	togglePresentation(): void;
	undo(): void;
	redo(): void;
	save(): void;
	toggleNotes(): void;
}

export interface ToolbarUpdate {
	/** Zero-based current slide index. */
	current: number;
	/** Total slide count. */
	total: number;
	/** Effective zoom percentage (100 = 1:1). */
	zoomPercent: number;
}

/** Editing-cluster state (Save / Undo / Redo buttons). */
export interface ToolbarEditState {
	/** Shows/hides the whole editing cluster. */
	editable: boolean;
	canUndo: boolean;
	canRedo: boolean;
}

export interface Toolbar {
	el: HTMLElement;
	update(state: ToolbarUpdate): void;
	setEditState(state: ToolbarEditState): void;
	/** Reflect the notes panel's expanded/collapsed state on the Notes button. */
	setNotesExpanded(expanded: boolean): void;
	/**
	 * Show the autosave status pill. `label` is the (already localized) text;
	 * `kind` drives the styling hook (`is-saving` / `is-error`). An empty label
	 * hides the pill.
	 */
	setAutosaveStatus(label: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void;
}

/**
 * The viewer toolbar: an editing cluster (save + undo/redo, shown only when
 * `editable`), prev/next + slide counter, zoom out/in/fit + zoom label, and
 * the presentation (fullscreen) toggle. All labels come from the shared i18n
 * dictionary; all colors from the shared theme CSS vars.
 */
export function createToolbar(doc: Document, t: Translator, handlers: ToolbarHandlers): Toolbar {
	const el = createEl(doc, 'div', 'pptxv-toolbar');
	el.setAttribute('role', 'toolbar');

	const button = (
		parent: HTMLElement,
		icon: IconName,
		label: string,
		onClick: () => void,
	): HTMLButtonElement => {
		const btn = createEl(doc, 'button', 'pptxv-btn');
		btn.type = 'button';
		btn.title = label;
		btn.setAttribute('aria-label', label);
		btn.appendChild(createIcon(doc, icon));
		btn.addEventListener('click', onClick);
		parent.appendChild(btn);
		return btn;
	};

	// Editing cluster: hidden until `setEditState({ editable: true })`.
	const editGroup = createEl(doc, 'span', 'pptxv-toolbar-edit');
	editGroup.hidden = true;
	el.appendChild(editGroup);
	button(editGroup, 'save', t('pptx.toolbar.save'), handlers.save);
	const undoBtn = button(editGroup, 'undo', t('pptx.toolbar.undo'), handlers.undo);
	const redoBtn = button(editGroup, 'redo', t('pptx.toolbar.redo'), handlers.redo);
	undoBtn.disabled = true;
	redoBtn.disabled = true;

	// Autosave status pill: lives in the editing cluster, hidden until a status
	// arrives. Uses aria-live so a save is announced to assistive tech.
	const autosaveStatus = createEl(doc, 'span', 'pptxv-autosave-status');
	autosaveStatus.setAttribute('aria-live', 'polite');
	autosaveStatus.hidden = true;
	editGroup.appendChild(autosaveStatus);

	const prevBtn = button(el, 'chevron-left', t('pptx.presenter.previousSlide'), handlers.prev);
	const counter = createEl(doc, 'span', 'pptxv-counter');
	counter.setAttribute('aria-live', 'polite');
	el.appendChild(counter);
	const nextBtn = button(el, 'chevron-right', t('pptx.presenter.nextSlide'), handlers.next);

	el.appendChild(createEl(doc, 'span', 'pptxv-toolbar-spacer'));

	button(el, 'zoom-out', t('pptx.statusBar.zoomOut'), handlers.zoomOut);
	const zoomLabel = createEl(doc, 'span', 'pptxv-zoom-label');
	el.appendChild(zoomLabel);
	button(el, 'zoom-in', t('pptx.statusBar.zoomIn'), handlers.zoomIn);
	button(el, 'fit', t('pptx.statusBar.zoomToFit'), handlers.zoomToFit);
	button(el, 'play', t('pptx.statusBar.slideShow'), handlers.togglePresentation);
	const notesBtn = button(el, 'notes', t('pptx.statusBar.toggleNotes'), handlers.toggleNotes);
	notesBtn.setAttribute('aria-pressed', 'false');

	return {
		el,
		update({ current, total, zoomPercent }) {
			counter.textContent =
				total > 0
					? t('pptx.statusBar.slideOf', { current: current + 1, total })
					: t('pptx.statusBar.noSlides');
			zoomLabel.textContent = `${Math.round(zoomPercent)}%`;
			prevBtn.disabled = current <= 0;
			nextBtn.disabled = current >= total - 1;
		},
		setEditState({ editable, canUndo, canRedo }) {
			editGroup.hidden = !editable;
			undoBtn.disabled = !canUndo;
			redoBtn.disabled = !canRedo;
		},
		setNotesExpanded(expanded) {
			notesBtn.setAttribute('aria-pressed', String(expanded));
			notesBtn.classList.toggle('is-active', expanded);
		},
		setAutosaveStatus(label, kind) {
			autosaveStatus.textContent = label;
			autosaveStatus.hidden = label.length === 0;
			autosaveStatus.classList.toggle('is-saving', kind === 'saving');
			autosaveStatus.classList.toggle('is-error', kind === 'error');
		},
	};
}
