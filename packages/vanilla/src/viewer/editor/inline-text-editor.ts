import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { remapTextToSegments } from 'pptx-viewer-shared';

import { createEl } from '../render';
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
	if (!element || !hasTextProperties(element) || element.locks?.noTextEdit) {
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
	/** Called with the edited text on commit (only when it changed). */
	onCommit(text: string): void;
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
	const surface = createEl(doc, 'div', 'pptxv-inline-editor', {
		left: `${box.x * scale}px`,
		top: `${box.y * scale}px`,
		width: `${box.width * scale}px`,
		minHeight: `${box.height * scale}px`,
		...(typeof fontSize === 'number' ? { fontSize: `${fontSize * scale}px` } : {}),
		...(fontFamily !== undefined ? { fontFamily } : {}),
	});
	surface.contentEditable = 'true';
	surface.setAttribute('role', 'textbox');
	surface.setAttribute('aria-multiline', 'true');
	surface.textContent = initialText;

	let closed = false;
	const close = (commitText: string | null): void => {
		if (closed) {
			return;
		}
		closed = true;
		surface.remove();
		if (commitText !== null && commitText !== initialText) {
			options.onCommit(commitText);
		}
		options.onClose();
	};

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

	overlayRoot.appendChild(surface);
	surface.focus();

	return {
		el: surface,
		commit: () => close(readEditableText(surface)),
		cancel: () => close(null),
	};
}
