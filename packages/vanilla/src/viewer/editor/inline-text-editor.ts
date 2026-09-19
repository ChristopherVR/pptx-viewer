import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	canInteractWithElement,
	attachInlineListController,
	attachCollaborationInlineEditor,
	buildInlineTextCommitPatch,
	createInlineListSeed,
	initializeInlineListDom,
	getInlineEditorSelection,
	placeCaretAtEnd,
	readEditableText,
	restoreEditorKeyboardFocus,
} from 'pptx-viewer-shared';
import type {
	InlineListController,
	InlineTextEditSnapshot,
	CollaborationInlineEditor,
} from 'pptx-viewer-shared';

import { createEl, getTextBlockStyle } from '../render';
import type { InlineEditorSession, OpenInlineEditorOptions } from './inline-text-editor-types';
import { activateInlineTextList } from './inline-text-list-activation';
import { markInsertedParagraph } from './inline-text-paragraph-marker';
import { seedPlainInlineText } from './inline-text-seed';
export type { InlineEditorSession, OpenInlineEditorOptions } from './inline-text-editor-types';

/**
 * Inline text editing: a contenteditable surface positioned over the element
 * (in the editor overlay layer). On commit the plain text is remapped back
 * onto the original rich segments through the shared `remapTextToSegments`,
 * so per-run styles and metadata (fields, bullets) survive the round trip.
 */

/**
 * Only elements that carry text (and are not locked) get the inline editor.
 * Equation-bearing text NEVER enters inline editing: the editor would only see
 * the literal "[Equation]" placeholder and committing would permanently drop
 * the OMML (`textSegments[].equationXml`). Mirrors the Vue/React/Angular guard.
 */
export function canInlineEditElement(element: PptxElement | undefined): boolean {
	// The lock composition (`noSelect` subsumes `noTextEdit`) is decided once, in
	// shared, so this never drifts from the gates on the stage.
	if (!element || !hasTextProperties(element) || !canInteractWithElement(element, 'textEdit')) {
		return false;
	}
	return !element.textSegments?.some((seg) => seg.equationXml);
}

export { readEditableText };
export {
	remapInlineText,
	resolveInlineTextAutoFitHeight,
	resolveInlineTextNormAutofitShrink,
} from './inline-text-commit';

/**
 * The live (uncommitted) plain text of the currently open inline editor, or
 * `undefined` when none is open. This binding's `[data-inline-editor]`
 * surface is a single global overlay (`inline` in `editor-stage-interactions.ts`
 * holds at most one), so a live editor is always for the currently selected
 * element - `enterInlineEdit` selects before opening it.
 *
 * The surface is UNCONTROLLED: typing mutates its DOM directly and `onInput`
 * only forwards to collaboration broadcast, never the store, so
 * `state.selectedElement().textSegments` can be stale relative to what is on
 * screen for the whole edit session, not just mid-keystroke. A toolbar/inspector
 * action reached through `applyToSelected` must reconcile against this (via
 * `remapInlineText`/`remapTextToSegments`) before it touches segments, or its
 * change lands on stale content and is discarded when the session commits.
 */
export function currentInlineEditorText(): string | undefined {
	if (typeof document === 'undefined') {
		return undefined;
	}
	const surface = document.querySelector<HTMLElement>('[data-inline-editor]');
	return surface ? readEditableText(surface) : undefined;
}

/**
 * Open the contenteditable editing surface over an element. Commits on blur
 * and on Escape; all keystrokes stay local (never trigger viewer shortcuts).
 */
export function openInlineEditor(options: OpenInlineEditorOptions): InlineEditorSession {
	const { doc, overlayRoot, box, scale, element } = options;
	const withText = hasTextProperties(element) ? element : undefined;
	const initialText = withText?.text ?? '';
	const fontSize = withText?.textStyle?.fontSize;

	const fontFamily = withText?.textStyle?.fontFamily;
	/**
	 * The surface is placed in the overlay's own (scaled) space, then given the
	 * element's SLIDE-space typography and shrunk back onto it with a scale
	 * transform - the same trick the stage uses, and the reason the block style
	 * below can be handed over untouched.
	 *
	 * Two things were wrong before. The surface was positioned with `left`/`top`
	 * but nothing ever gave `.pptxv-inline-editor` a `position`, so a static
	 * block ignored both and the editor opened at the overlay's origin, a whole
	 * slide away from the words it was editing (the size was right, which is why
	 * it looked like a stray box rather than a missing one). And it carried only
	 * the font size and family, so a centred or right-aligned paragraph jumped to
	 * the left edge the moment editing began, in a different weight and colour.
	 * `getTextBlockStyle` is what the renderer itself paints with.
	 */
	const surface = createEl(doc, 'div', 'pptxv-inline-editor pptxv-inline-text-editor', {
		// The block style first: it carries the element's own box sizing, which
		// the editor's geometry then has to win over.
		...getTextBlockStyle(element),
		...(typeof fontSize === 'number' ? { fontSize: `${fontSize}px` } : {}),
		...(fontFamily !== undefined ? { fontFamily } : {}),
		left: `${box.x * scale}px`,
		top: `${box.y * scale}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		transform: `scale(${scale})`,
		transformOrigin: 'top left',
	});
	surface.contentEditable = 'true';
	surface.spellcheck = options.spellCheck ?? false;
	surface.dataset.inlineEditor = '';
	surface.setAttribute('role', 'textbox');
	surface.setAttribute('aria-multiline', 'true');
	let textContainer: HTMLElement = surface;
	const collaborative = Boolean(options.collaboration?.patcher.isActive());
	const listSeed = collaborative ? undefined : createInlineListSeed(element);
	let listController: InlineListController | undefined;
	let connected: CollaborationInlineEditor | undefined;
	if (listSeed) {
		textContainer = doc.createElement('div');
		textContainer.dataset.pptxTextFlow = '';
		initializeInlineListDom(textContainer, listSeed);
		surface.append(textContainer);
	} else if (!collaborative) {
		textContainer = seedPlainInlineText(surface, withText?.textSegments, initialText);
	}
	// Compare commits against the same authored-text projection used on close.
	// `element.text` can include core-generated bullet markers, while the editor
	// correctly excludes their display-only spans.
	const initialEditableText = readEditableText(surface);

	let closed = false;
	const readSnapshot = (): InlineTextEditSnapshot | undefined => {
		const read = listController?.read();
		return read?.kind === 'supported' ? read.snapshot : undefined;
	};
	const close = (commitText: string | null): void => {
		if (closed) {
			return;
		}
		const read = listController?.read();
		if (
			commitText !== null &&
			collaborative &&
			read?.kind === 'unsupported' &&
			(read.reason === 'composition-active' || read.reason === 'input-active')
		)
			return;
		const snapshot = read?.kind === 'supported' ? read.snapshot : undefined;
		if (collaborative && !snapshot) commitText = null;
		if (commitText !== null && snapshot) {
			commitText = snapshot.text;
		}
		closed = true;
		// A synchronous commit can replace the overlay before close returns.
		// Restore focus while the surface still has its viewer ancestor.
		if (surface.contains(doc.activeElement)) {
			restoreEditorKeyboardFocus(surface);
		}
		// `onCommit` fires BEFORE the surface is removed: `a:spAutoFit`
		// ("Resize shape to fit text") needs to measure the still-mounted,
		// still-`[data-inline-editor]`-attributed node from inside that
		// callback (`EditorOperations.commitInlineText`), and a detached node
		// reports `offsetWidth: 0`, which would break the measurement.
		if (
			commitText !== null &&
			(snapshot
				? buildInlineTextCommitPatch(element, commitText, snapshot)
				: commitText !== initialEditableText)
		) {
			if (snapshot) {
				options.onCommit(commitText, snapshot);
			} else {
				options.onCommit(commitText);
			}
		}
		listController?.dispose();
		surface.remove();
		options.onClose();
	};

	surface.addEventListener('input', (event) => {
		if (listController) {
			listController.refresh();
			return;
		}
		// Chrome can represent Enter between rich-run spans as a cloned sibling
		// span. Its placeholder BR disappears as soon as the user types, leaving
		// no delimiter for commit, so annotate the browser-created span itself.
		if ((event as InputEvent).inputType === 'insertParagraph') {
			markInsertedParagraph(doc, surface);
		}
		options.onInput?.(readEditableText(surface));
	});
	surface.addEventListener('blur', () => close(readEditableText(surface)));
	surface.addEventListener('keydown', (event) => {
		// Keep every keystroke local so viewer navigation/editor shortcuts
		// (arrows, space, Delete, Ctrl+Z...) never fire while typing.
		event.stopPropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			close(readEditableText(surface));
		}
	});
	surface.addEventListener('pointerdown', (event) => event.stopPropagation());
	const notifySelection = (): void => {
		const list = listController?.readSelection();
		options.onSelectionChange?.(
			list
				? list.kind === 'supported'
					? list.selection
					: null
				: getInlineEditorSelection(withText?.textSegments),
		);
	};
	surface.addEventListener('keyup', notifySelection);
	surface.addEventListener('pointerup', notifySelection);

	const attachList = (root: HTMLElement, seed: NonNullable<typeof listSeed>) => {
		surface.style.textDecoration = 'none';
		surface.style.textDecorationLine = 'none';
		textContainer = root;
		listController = attachInlineListController(root, seed, {
			isCurrent: () => !closed && surface.isConnected,
			onRead: (read) =>
				options.onInput?.(
					read.kind === 'supported' ? read.snapshot.text : read.text,
					read.kind === 'supported' ? read.snapshot : undefined,
				),
		});
	};
	overlayRoot.appendChild(surface);
	if (collaborative) {
		connected = attachCollaborationInlineEditor(surface, element, {
			...options.collaboration!,
			onCancel: () => close(null),
		});
		listController = connected;
		if (!connected) close(null);
	} else if (listSeed) {
		attachList(textContainer, listSeed);
	}
	if (!closed) surface.focus();
	// Caret at the END of the seeded text so typing appends (the contract the
	// other bindings follow; focus alone leaves the caret at the start).
	if (!closed) placeCaretAtEnd(textContainer);

	return {
		el: surface,
		checkModel: connected?.checkModel,
		readAccepted: connected?.readAccepted,
		activateList: (model) =>
			!closed && (Boolean(listController) || activateInlineTextList(surface, model, attachList)),
		readSnapshot,
		readList: () => listController?.read(),
		formatSnapshot: (snapshot) => listController?.format(snapshot).kind === 'supported',
		commit: () => close(readEditableText(surface)),
		cancel: () => close(null),
	};
}
