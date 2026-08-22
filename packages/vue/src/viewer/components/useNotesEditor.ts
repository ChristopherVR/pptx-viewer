import type { PptxSlide, PptxTextStyleLevels } from 'pptx-viewer-core';
import type { NotesInlineCommand, NotesParagraphCommand } from 'pptx-viewer-shared';
import {
	DEBOUNCE_MS,
	applyInlineCommand,
	applyParagraphCommand,
	buildNotesPrintHtml,
	createPlainNotesSegments,
	defaultRichEnabled,
	handleEditorAnchorClick,
	insertHyperlinkAtSelection,
	normalizeNotesLinkUrl,
	readEditorSegments,
	resolveNotesSegments,
	segmentsToEditorHtml,
	segmentsToPlainText,
} from 'pptx-viewer-shared';
import type { Ref } from 'vue';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * useNotesEditor: the reactive wiring behind `NotesPanel.vue`'s rich speaker-
 * notes editor. All framework-agnostic logic (segment maths, contentEditable
 * HTML serialise/parse, caret-aware toolbar commands, print document) lives in
 * `pptx-viewer-shared`; this composable owns only the Vue refs, the seeding
 * lifecycle, and the debounce.
 *
 * The host's `update` contract is a single plain-text notes string (see
 * NotesPanel.vue), so the editor commits plain text. Rich `notesSegments`
 * loaded from a .pptx are honoured for display/editing within the session.
 *
 * @param getNotesStyle Returns the deck's notes master `<p:notesStyle>`
 *   (`PptxData.notesMaster.notesStyle`), when the host has it. Threaded
 *   through to `resolveNotesSegments`/`buildNotesPrintHtml` so an authored
 *   deck's notes-text defaults (font size/family/colour/indent) fill in gaps
 *   left by segments that do not already carry an explicit value, instead of
 *   being silently replaced by this editor's hardcoded look.
 */
export function useNotesEditor(
	getSlide: () => PptxSlide | undefined,
	emitUpdate: (notes: string) => void,
	getNotesStyle: () => PptxTextStyleLevels | undefined = () => undefined,
) {
	const richEditorRef = ref<HTMLDivElement | null>(null);
	const textareaRef = ref<HTMLTextAreaElement | null>(null);

	const isRichEnabled = ref<boolean>(defaultRichEnabled());
	const showLinkPopover = ref(false);
	const savedSelectionText = ref('');

	// Plain-text + segment drafts. The active surface (contentEditable or
	// textarea) owns the live content during an edit; these mirror it for
	// seeding and for the toggle between surfaces.
	let draftText = '';
	let draftSegments = resolveNotesSegments(getSlide(), getNotesStyle());
	draftText = segmentsToPlainText(draftSegments);

	let debounceId: ReturnType<typeof setTimeout> | null = null;
	let seededId: string | null = getSlide()?.id ?? null;

	function emitNow(text: string): void {
		if (debounceId) {
			clearTimeout(debounceId);
			debounceId = null;
		}
		emitUpdate(text);
	}

	function scheduleSave(text: string): void {
		if (debounceId) {
			clearTimeout(debounceId);
		}
		debounceId = setTimeout(() => {
			emitUpdate(text);
			debounceId = null;
		}, DEBOUNCE_MS);
	}

	/** Seed the currently active surface from the current drafts. */
	function seedActiveSurface(): void {
		if (isRichEnabled.value) {
			if (richEditorRef.value) {
				richEditorRef.value.innerHTML = segmentsToEditorHtml(draftSegments);
			}
		} else if (textareaRef.value) {
			textareaRef.value.value = draftText;
		}
	}

	function reseedFromSlide(): void {
		draftSegments = resolveNotesSegments(getSlide(), getNotesStyle());
		draftText = segmentsToPlainText(draftSegments);
		void nextTick(seedActiveSurface);
	}

	onMounted(() => {
		void nextTick(seedActiveSurface);
	});

	// Re-seed only on a genuine slide swap (keyed by id), never on each keystroke,
	// so an in-progress edit is never remounted (which on touch dismisses the
	// keyboard / jumps the caret). Mirrors the uncontrolled-field rationale of the
	// original plain textarea.
	watch(
		() => getSlide()?.id,
		(id) => {
			const nextId = id ?? null;
			if (nextId === seededId) {
				return;
			}
			seededId = nextId;
			reseedFromSlide();
		},
	);

	onBeforeUnmount(() => {
		if (debounceId) {
			clearTimeout(debounceId);
		}
	});

	/* --- Rich editor handlers --- */

	function onRichInput(): void {
		const editor = richEditorRef.value;
		if (!editor) {
			return;
		}
		const next = readEditorSegments(editor);
		draftSegments = next.segments;
		draftText = next.text;
		scheduleSave(next.text);
	}

	function inlineCommand(command: NotesInlineCommand): void {
		applyInlineCommand(command);
		onRichInput();
		richEditorRef.value?.focus();
	}

	function paragraphCommand(command: NotesParagraphCommand): void {
		const editor = richEditorRef.value;
		if (!editor) {
			return;
		}
		const next = applyParagraphCommand(editor, draftSegments, command);
		draftSegments = next.segments;
		draftText = next.text;
		// List/indent changes the block structure, so re-seed the DOM (unlike inline
		// typing, where the live DOM is already correct).
		editor.innerHTML = segmentsToEditorHtml(next.segments);
		scheduleSave(next.text);
		editor.focus();
	}

	function onRichKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			emitNow(draftText);
			richEditorRef.value?.blur();
			return;
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			paragraphCommand(event.shiftKey ? 'outdent' : 'indent');
		}
	}

	function onEditorClick(event: MouseEvent): void {
		if (handleEditorAnchorClick(event.target, event.ctrlKey || event.metaKey)) {
			event.preventDefault();
		}
	}

	/* --- Hyperlink popover --- */

	function openLinkPopover(): void {
		savedSelectionText.value = window.getSelection()?.toString() ?? '';
		showLinkPopover.value = true;
	}

	function insertLink(url: string, displayText: string): void {
		showLinkPopover.value = false;
		const editor = richEditorRef.value;
		if (!editor) {
			return;
		}
		editor.focus();
		const finalUrl = normalizeNotesLinkUrl(url);
		insertHyperlinkAtSelection(finalUrl, displayText || finalUrl);
		onRichInput();
	}

	/* --- Plain textarea handlers --- */

	function onPlainCommit(event: Event): void {
		const value = (event.target as HTMLTextAreaElement).value;
		draftText = value;
		draftSegments = createPlainNotesSegments(value);
		emitNow(value);
	}

	/* --- Toggle + print --- */

	function toggleRich(): void {
		// Capture the live content from the surface we are leaving so the drafts
		// stay in sync across the switch.
		if (isRichEnabled.value && richEditorRef.value) {
			const next = readEditorSegments(richEditorRef.value);
			draftSegments = next.segments;
			draftText = next.text;
		} else if (!isRichEnabled.value && textareaRef.value) {
			draftText = textareaRef.value.value;
			draftSegments = createPlainNotesSegments(draftText);
		}
		isRichEnabled.value = !isRichEnabled.value;
		void nextTick(seedActiveSurface);
	}

	function printNotes(): void {
		const slide = getSlide();
		if (!slide || typeof document === 'undefined') {
			return;
		}
		const html = buildNotesPrintHtml([slide], (n) => `Slide ${n}`, getNotesStyle());
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.style.position = 'fixed';
		frame.style.right = '0';
		frame.style.bottom = '0';
		frame.style.width = '0';
		frame.style.height = '0';
		frame.style.border = '0';
		document.body.appendChild(frame);
		const doc = frame.contentWindow?.document;
		if (!doc) {
			frame.remove();
			return;
		}
		doc.open();
		doc.write(html);
		doc.close();
		setTimeout(() => {
			frame.contentWindow?.focus();
			frame.contentWindow?.print();
			setTimeout(() => frame.remove(), 1000);
		}, 200);
	}

	return {
		richEditorRef: richEditorRef as Ref<HTMLDivElement | null>,
		textareaRef: textareaRef as Ref<HTMLTextAreaElement | null>,
		isRichEnabled,
		showLinkPopover,
		savedSelectionText,
		onRichInput,
		inlineCommand,
		paragraphCommand,
		onRichKeydown,
		onEditorClick,
		openLinkPopover,
		insertLink,
		closeLinkPopover: () => {
			showLinkPopover.value = false;
		},
		onPlainCommit,
		toggleRich,
		printNotes,
	};
}
