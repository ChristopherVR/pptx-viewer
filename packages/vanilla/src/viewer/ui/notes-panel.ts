import type { PptxSlide, PptxTextStyleLevels, TextSegment } from 'pptx-viewer-core';
import {
	applyInlineCommand,
	applyParagraphCommand,
	buildNotesPrintHtml,
	createPlainNotesSegments,
	defaultRichEnabled,
	insertHyperlinkAtSelection,
	registerPptxWebControls,
	readEditorSegments,
	resolveNotesSegments,
	segmentsToEditorHtml,
	segmentsToPlainText,
} from 'pptx-viewer-shared';
import type { NotesToolbarRequestEvent } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/** State the panel needs to reflect: the slide to read notes from, and whether edits are allowed. */
export interface NotesPanelUpdate {
	slide: PptxSlide | undefined;
	editable: boolean;
	/** Notes-master per-level text defaults (font size, indent, etc.) to fall back to when a segment omits them. */
	notesStyle?: PptxTextStyleLevels;
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
 * The speaker-notes panel: a collapsible strip docked below the
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
	el.dataset.pptxChrome = 'notes';

	const header = createEl(doc, 'button', 'pptxv-notes-header');
	header.dataset.pptxChrome = 'notes-header';
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

	// The shared toolbar owns the buttons, link popover, roving focus and gating.
	registerPptxWebControls();
	const toolbar = doc.createElement('pptx-ui-notes-toolbar');
	toolbar.className = 'pptxv-notes-toolbar';
	body.appendChild(toolbar);

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
	let currentSlide: PptxSlide | undefined;
	let currentNotesStyle: PptxTextStyleLevels | undefined;

	const syncToolbar = (): void => {
		toolbar.hidden = !editable;
		toolbar.state = {
			rich: richEnabled,
			canFormat: richEnabled && editable && currentSlide !== undefined,
			showPrint: currentSlide !== undefined,
			disabled: currentSlide === undefined,
			translate: t,
		};
	};
	const setMode = (nextRichEnabled: boolean): void => {
		richEnabled = nextRichEnabled;
		richEditor.hidden = !richEnabled;
		textarea.hidden = richEnabled;
		syncToolbar();
	};

	const commitRich = (): void => {
		if (!editable) {
			return;
		}
		const result = readEditorSegments(richEditor);
		segments = result.segments;
		onCommit(result.text, result.segments);
	};
	const paragraph = (command: 'bullet' | 'numbered' | 'indent' | 'outdent'): void => {
		// Read the live DOM first: typing is only committed on blur.
		segments = readEditorSegments(richEditor).segments;
		segments = applyParagraphCommand(richEditor, segments, command).segments;
		richEditor.innerHTML = segmentsToEditorHtml(segments);
	};
	/**
	 * Print the current slide's speaker notes via the browser's native print
	 * dialog. Builds the document with the shared `buildNotesPrintHtml`
	 * (framework-neutral, honours `notesStyle`) and writes it into a hidden
	 * iframe, mirroring the Vue (`useNotesEditor.printNotes`) and Angular
	 * (`NotesPanelComponent.printNotes`) implementations exactly, so all logic
	 * stays in `pptx-viewer-shared` and no binding re-derives the print HTML.
	 */
	const printNotes = (): void => {
		if (!currentSlide) {
			return;
		}
		const html = buildNotesPrintHtml(
			[currentSlide],
			(n) => t('pptx.notes.slideN', { n }),
			currentNotesStyle,
		);
		// Sandbox IS set two lines down (`sandbox="allow-same-origin"`); the rule
		// only recognises the literal `document.createElement` receiver, not this
		// file's injected `doc: Document` parameter (used throughout for
		// testability - it is always the real `document` at runtime).
		// oxlint-disable-next-line react/iframe-missing-sandbox
		const frame = doc.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.setAttribute('sandbox', 'allow-same-origin');
		frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
		doc.body.appendChild(frame);
		const frameDoc = frame.contentWindow?.document;
		if (!frameDoc) {
			frame.remove();
			return;
		}
		frameDoc.open();
		frameDoc.write(html);
		frameDoc.close();
		setTimeout(() => {
			frame.contentWindow?.focus();
			frame.contentWindow?.print();
			setTimeout(() => frame.remove(), 1000);
		}, 200);
	};
	toolbar.addEventListener('notes-request', (event) => {
		const intent = (event as NotesToolbarRequestEvent).detail;
		if (intent.kind === 'print') {
			printNotes();
			return;
		}
		if (intent.kind === 'toggle-rich') {
			if (richEnabled) {
				commitRich();
				textarea.value = segmentsToPlainText(segments);
			} else {
				segments = createPlainNotesSegments(textarea.value);
				richEditor.innerHTML = segmentsToEditorHtml(segments);
			}
			setMode(!richEnabled);
			return;
		}
		if (!richEnabled || !editable) {
			return;
		}
		richEditor.focus();
		if (intent.kind === 'inline') {
			applyInlineCommand(intent.command);
		} else if (intent.kind === 'paragraph') {
			paragraph(intent.command);
		} else {
			insertHyperlinkAtSelection(intent.url, intent.text);
		}
		commitRich();
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
		update({ slide, editable: nextEditable, notesStyle }) {
			editable = nextEditable;
			currentSlide = slide;
			currentNotesStyle = notesStyle;
			syncToolbar();
			const hasSlide = slide !== undefined;
			textarea.disabled = !hasSlide;
			textarea.readOnly = !editable;
			richEditor.contentEditable = String(editable && hasSlide);
			textarea.placeholder = hasSlide ? t('pptx.notes.addSpeakerNotes') : t('pptx.notes.noSlide');

			const slideId = slide?.id ?? null;
			if (slideId === seededSlideId) {
				return;
			}
			seededSlideId = slideId;
			segments = resolveNotesSegments(slide, notesStyle);
			textarea.value = segmentsToPlainText(segments);
			richEditor.innerHTML = segmentsToEditorHtml(segments);
		},
		setExpanded(next) {
			expanded = next;
			applyExpanded();
		},
	};
}
