import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	canInteractWithElement,
	getInlineEditorSelection,
	placeCaretAtEnd,
	remapTextToSegments,
	resolveInlineEditAutoFitHeight,
} from 'pptx-viewer-shared';
import type { InlineTextSelection } from 'pptx-viewer-shared';

import { createEl, getTextBlockStyle } from '../render';
import type { OverlayBox } from './selection-overlay';

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

/** Remap edited plain text back onto the element's original segments. */
export function remapInlineText(
	element: PptxElement,
	text: string,
): { text: string; textSegments: TextSegment[] } {
	const withText = hasTextProperties(element) ? element : undefined;
	const segments: TextSegment[] | undefined = withText?.textSegments;
	const style: TextStyle | undefined = withText?.textStyle;
	return { text, textSegments: remapTextToSegments(text, segments, style) };
}

/**
 * Read the plain text of a contenteditable back out, translating `<br>` and
 * block-element boundaries into `\n` (contenteditable normalises Enter into
 * nested blocks or `<br>` depending on the browser).
 */
export function readEditableText(root: HTMLElement): string {
	let out = '';
	const walk = (node: Node): void => {
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType === 3) {
				out += child.nodeValue ?? '';
				continue;
			}
			if (!(child instanceof HTMLElement)) {
				continue;
			}
			if (child.tagName === 'BR') {
				out += '\n';
				continue;
			}
			const isBlock = child.tagName === 'DIV' || child.tagName === 'P';
			if (isBlock && out.length > 0 && !out.endsWith('\n')) {
				out += '\n';
			}
			walk(child);
		}
	};
	walk(root);
	return out;
}

/**
 * `a:spAutoFit` ("Resize shape to fit text") editor-commit resize: decide the
 * element's new height from its text style, current height, and the live
 * (still-mounted) editor DOM node - `undefined` when the element carries no
 * text properties, autofit isn't `'shrink'`, or the measured height did not
 * meaningfully change.
 *
 * `EditorOperations.commitInlineText` calls this before it replaces the
 * element; `editorEl` there is found via
 * `document.querySelector('[data-inline-editor]')`, which resolves to the
 * live surface because `close()` (above) fires `onCommit` - the call that
 * reaches `commitInlineText` - BEFORE `surface.remove()`.
 */
export function resolveInlineTextAutoFitHeight(
	element: PptxElement,
	editorEl: HTMLElement | null,
): number | undefined {
	if (!hasTextProperties(element)) {
		return undefined;
	}
	return resolveInlineEditAutoFitHeight(element.textStyle, element.height, editorEl);
}

export interface InlineEditorSession {
	el: HTMLElement;
	/** Commit the current text (fires `onCommit` when changed) and close. */
	commit(): void;
	/** Close without committing. */
	cancel(): void;
}

export interface OpenInlineEditorOptions {
	doc: Document;
	/** The editor overlay root the surface mounts into. */
	overlayRoot: HTMLElement;
	/** Element geometry in element px, plus the stage scale for placement. */
	box: OverlayBox;
	scale: number;
	element: PptxElement;
	spellCheck?: boolean;
	/** Called with the edited text on commit (only when it changed). */
	onCommit(text: string): void;
	/**
	 * Called with the edited text on EVERY keystroke. Used for the collaboration
	 * live preview only: it must not touch editor state or history.
	 */
	onInput?(text: string): void;
	onSelectionChange?(selection: InlineTextSelection | null): void;
	/** Called after the surface closes (commit or cancel). */
	onClose(): void;
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
	if (withText?.textSegments?.length) {
		withText.textSegments.forEach((segment, index) => {
			const span = doc.createElement('span');
			span.dataset.segIdx = String(index);
			span.textContent = segment.text;
			surface.appendChild(span);
		});
	} else {
		surface.textContent = initialText;
	}

	let closed = false;
	const close = (commitText: string | null): void => {
		if (closed) {
			return;
		}
		closed = true;
		// `onCommit` fires BEFORE the surface is removed: `a:spAutoFit`
		// ("Resize shape to fit text") needs to measure the still-mounted,
		// still-`[data-inline-editor]`-attributed node from inside that
		// callback (`EditorOperations.commitInlineText`), and a detached node
		// reports `offsetWidth: 0`, which would break the measurement.
		if (commitText !== null && commitText !== initialText) {
			options.onCommit(commitText);
		}
		surface.remove();
		options.onClose();
	};

	surface.addEventListener('input', () => options.onInput?.(readEditableText(surface)));
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
	const notifySelection = (): void =>
		options.onSelectionChange?.(getInlineEditorSelection(withText?.textSegments));
	surface.addEventListener('keyup', notifySelection);
	surface.addEventListener('pointerup', notifySelection);

	overlayRoot.appendChild(surface);
	surface.focus();
	// Caret at the END of the seeded text so typing appends (the contract the
	// other bindings follow; focus alone leaves the caret at the start).
	placeCaretAtEnd(surface);

	return {
		el: surface,
		commit: () => close(readEditableText(surface)),
		cancel: () => close(null),
	};
}
