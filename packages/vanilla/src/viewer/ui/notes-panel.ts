import type { PptxSlide, TextSegment } from 'pptx-viewer-core';
import {
	applyInlineCommand,
	applyParagraphCommand,
	createPlainNotesSegments,
	defaultRichEnabled,
	insertHyperlinkAtSelection,
	normalizeNotesLinkUrl,
	readEditorSegments,
	resolveNotesSegments,
	segmentsToEditorHtml,
	segmentsToPlainText,
} from 'pptx-viewer-shared';

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
	onCommit: (notes: string, notesSegments?: TextSegment[]) => void,
): NotesPanel {
	const el = createEl(doc, 'div', 'pptxv-notes');

	const header = createEl(doc, 'button', 'pptxv-notes-header');
	header.type = 'button';
	header.setAttribute('aria-expanded', 'false');
	// `slide-notes-content` matches the id/aria-controls pair the React/Vue
	// notes panels emit (see e.g. `SlideNotesPanel.tsx`), part of the
	// framework-neutral e2e DOM contract documented in `playwright.config.ts`.
	header.setAttribute('aria-controls', 'slide-notes-content');
	header.addEventListener('click', onToggle);
	el.appendChild(header);

	const title = createEl(doc, 'span', 'pptxv-notes-title');
	title.textContent = t('pptx.notes.title');
	header.appendChild(title);

	const chevron = createEl(doc, 'span', 'pptxv-notes-chevron');
	chevron.setAttribute('aria-hidden', 'true');
	header.appendChild(chevron);

	const body = createEl(doc, 'div', 'pptxv-notes-body');
	body.id = 'slide-notes-content';
	el.appendChild(body);

	const toolbar = createEl(doc, 'div', 'pptxv-notes-toolbar');
	body.appendChild(toolbar);
	const editorMode = doc.createElement('button');
	editorMode.type = 'button';
	editorMode.className = 'pptxv-notes-mode';
	toolbar.appendChild(editorMode);

	const richEditor = createEl(doc, 'div', 'pptxv-notes-rich-editor');
	richEditor.contentEditable = 'true';
	richEditor.setAttribute('role', 'textbox');
	richEditor.setAttribute('aria-multiline', 'true');
	richEditor.setAttribute('aria-label', t('pptx.presenter.speakerNotes'));
	body.appendChild(richEditor);

	const textarea = doc.createElement('textarea');
	textarea.className = 'pptxv-notes-textarea';
	textarea.name = 'slide-notes';
	textarea.spellcheck = true;
	textarea.setAttribute('aria-label', t('pptx.presenter.speakerNotes'));
	body.appendChild(textarea);

	let expanded = false;
	let seededSlideId: string | null = null;
	let editable = false;
	let richEnabled = defaultRichEnabled();
	let segments: TextSegment[] = [];

	const setMode = (nextRichEnabled: boolean): void => {
		richEnabled = nextRichEnabled;
		richEditor.hidden = !richEnabled;
		textarea.hidden = richEnabled;
		toolbar.hidden = !editable;
		editorMode.textContent = richEnabled ? t('pptx.notes.plainEditor') : t('pptx.notes.richEditor');
		editorMode.setAttribute('aria-pressed', String(richEnabled));
	};

	const commitRich = (): void => {
		if (!editable) {
			return;
		}
		const result = readEditorSegments(richEditor);
		segments = result.segments;
		onCommit(result.text, result.segments);
	};
	const addCommand = (label: string, commandTitle: string, action: () => void): void => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'pptxv-notes-tool';
		button.textContent = label;
		button.title = commandTitle;
		button.setAttribute('aria-label', commandTitle);
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', () => {
			richEditor.focus();
			action();
			commitRich();
		});
		toolbar.insertBefore(button, editorMode);
	};
	addCommand('B', t('pptx.notes.bold'), () => applyInlineCommand('bold'));
	addCommand('I', t('pptx.notes.italic'), () => applyInlineCommand('italic'));
	addCommand('U', t('pptx.notes.underline'), () => applyInlineCommand('underline'));
	addCommand('S', t('pptx.notes.strikethrough'), () => applyInlineCommand('strikeThrough'));
	addCommand('•', t('pptx.notes.bulletList'), () => {
		const result = applyParagraphCommand(richEditor, segments, 'bullet');
		segments = result.segments;
		richEditor.innerHTML = segmentsToEditorHtml(segments);
	});
	addCommand('1.', t('pptx.notes.numberedList'), () => {
		const result = applyParagraphCommand(richEditor, segments, 'numbered');
		segments = result.segments;
		richEditor.innerHTML = segmentsToEditorHtml(segments);
	});
	addCommand('→', t('pptx.notes.indent'), () => {
		const result = applyParagraphCommand(richEditor, segments, 'indent');
		segments = result.segments;
		richEditor.innerHTML = segmentsToEditorHtml(segments);
	});
	addCommand('←', t('pptx.notes.outdent'), () => {
		const result = applyParagraphCommand(richEditor, segments, 'outdent');
		segments = result.segments;
		richEditor.innerHTML = segmentsToEditorHtml(segments);
	});
	addCommand('↗', t('pptx.notes.insertLink'), () => {
		const selected = doc.getSelection()?.toString() ?? '';
		const url = window.prompt(t('pptx.notes.linkUrl'), 'https://');
		if (!url) {
			return;
		}
		const displayText = window.prompt(t('pptx.notes.linkDisplayText'), selected) ?? selected;
		insertHyperlinkAtSelection(normalizeNotesLinkUrl(url), displayText);
	});
	editorMode.addEventListener('click', () => {
		if (richEnabled) {
			commitRich();
			textarea.value = segmentsToPlainText(segments);
		} else {
			segments = createPlainNotesSegments(textarea.value);
			richEditor.innerHTML = segmentsToEditorHtml(segments);
		}
		setMode(!richEnabled);
	});

	const commit = (): void => {
		if (!editable) {
			return;
		}
		onCommit(textarea.value);
	};
	textarea.addEventListener('change', commit);
	textarea.addEventListener('blur', commit);
	richEditor.addEventListener('blur', commitRich);

	const applyExpanded = (): void => {
		el.dataset.collapsed = expanded ? 'false' : 'true';
		header.setAttribute('aria-expanded', String(expanded));
		body.hidden = !expanded;
		chevron.textContent = expanded ? '▾' : '▸';
	};
	applyExpanded();
	setMode(richEnabled);

	return {
		el,
		update({ slide, editable: nextEditable }) {
			editable = nextEditable;
			const hasSlide = slide !== undefined;
			textarea.disabled = !hasSlide;
			textarea.readOnly = !editable;
			richEditor.contentEditable = String(editable && hasSlide);
			toolbar.hidden = !editable;
			textarea.placeholder = hasSlide ? t('pptx.notes.addSpeakerNotes') : t('pptx.notes.noSlide');

			const slideId = slide?.id ?? null;
			if (slideId === seededSlideId) {
				return;
			}
			seededSlideId = slideId;
			segments = resolveNotesSegments(slide);
			textarea.value = segmentsToPlainText(segments);
			richEditor.innerHTML = segmentsToEditorHtml(segments);
		},
		setExpanded(next) {
			expanded = next;
			applyExpanded();
		},
	};
}
