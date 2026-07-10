import type { PptxSlide } from 'pptx-viewer-core';
import { resolveNotesSegments, segmentsToPlainText } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/** State the panel needs to reflect: the slide to read notes from, and whether edits are allowed. */
export interface NotesPanelUpdate {
	slide: PptxSlide | undefined;
	editable: boolean;
}

export interface NotesPanel {
	el: HTMLElement;
	/**
	 * Sync the panel to the given slide/editable state. The textarea's value is
	 * only reseeded when the slide id actually changes (never on every render),
	 * so an in-progress edit is never interrupted mid-typing.
	 */
	update(update: NotesPanelUpdate): void;
	/** Expand or collapse the notes body (header stays visible either way). */
	setExpanded(expanded: boolean): void;
}

/**
 * The plain-text speaker-notes panel: a collapsible strip docked below the
 * slide stage. Vanilla counterpart of the Vue binding's `NotesPanel.vue`
 * plain `<textarea>` surface only; there is no rich contentEditable chrome
 * here (that is out of scope for this binding).
 *
 * The textarea is uncontrolled: its `value` is set imperatively and only
 * re-seeded on a genuine slide swap (keyed by slide id), matching the
 * mobile-safe rationale documented on the Vue editor. Edits commit on
 * `change` / `blur`, never per keystroke.
 */
export function createNotesPanel(
	doc: Document,
	t: Translator,
	onToggle: () => void,
	onCommit: (notes: string) => void,
): NotesPanel {
	const el = createEl(doc, 'div', 'pptxv-notes');

	const header = createEl(doc, 'button', 'pptxv-notes-header');
	header.type = 'button';
	header.setAttribute('aria-expanded', 'false');
	header.setAttribute('aria-controls', 'pptxv-notes-body');
	header.addEventListener('click', onToggle);
	el.appendChild(header);

	const title = createEl(doc, 'span', 'pptxv-notes-title');
	title.textContent = t('pptx.notes.title');
	header.appendChild(title);

	const chevron = createEl(doc, 'span', 'pptxv-notes-chevron');
	chevron.setAttribute('aria-hidden', 'true');
	header.appendChild(chevron);

	const body = createEl(doc, 'div', 'pptxv-notes-body');
	body.id = 'pptxv-notes-body';
	el.appendChild(body);

	const textarea = doc.createElement('textarea');
	textarea.className = 'pptxv-notes-textarea';
	textarea.name = 'slide-notes';
	textarea.spellcheck = true;
	textarea.setAttribute('aria-label', t('pptx.presenter.speakerNotes'));
	body.appendChild(textarea);

	let expanded = false;
	let seededSlideId: string | null = null;
	let editable = false;

	const commit = (): void => {
		if (!editable) {
			return;
		}
		onCommit(textarea.value);
	};
	textarea.addEventListener('change', commit);
	textarea.addEventListener('blur', commit);

	const applyExpanded = (): void => {
		el.dataset.collapsed = expanded ? 'false' : 'true';
		header.setAttribute('aria-expanded', String(expanded));
		body.hidden = !expanded;
		chevron.textContent = expanded ? '▾' : '▸';
	};
	applyExpanded();

	return {
		el,
		update({ slide, editable: nextEditable }) {
			editable = nextEditable;
			const hasSlide = slide !== undefined;
			textarea.disabled = !hasSlide;
			textarea.readOnly = !editable;
			textarea.placeholder = hasSlide ? t('pptx.notes.addSpeakerNotes') : t('pptx.notes.noSlide');

			const slideId = slide?.id ?? null;
			if (slideId === seededSlideId) {
				return;
			}
			seededSlideId = slideId;
			textarea.value = segmentsToPlainText(resolveNotesSegments(slide));
		},
		setExpanded(next) {
			expanded = next;
			applyExpanded();
		},
	};
}
