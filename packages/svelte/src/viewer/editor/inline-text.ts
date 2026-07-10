import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { remapTextToSegments } from 'pptx-viewer-shared';

/**
 * Pure helpers for inline text editing. The editable surface itself is a
 * Svelte component (`InlineTextEditor.svelte`); this module only holds the
 * framework-agnostic logic: which elements are editable, remapping edited
 * plain text back onto the original rich segments (via the shared
 * `remapTextToSegments`, so per-run styles and field metadata survive), and
 * reading plain text out of a contenteditable surface.
 */

/**
 * Only elements that carry text (and are not locked) get the inline editor.
 * Equation-bearing text NEVER enters inline editing: the editor would only see
 * the literal "[Equation]" placeholder and committing would permanently drop
 * the OMML (`textSegments[].equationXml`). Mirrors the vanilla/Vue/React guard.
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

/** Initial plain text + optional font style for the inline surface. */
export interface InlineTextSurface {
	text: string;
	fontSize: number | undefined;
	fontFamily: string | undefined;
}

/** Resolve the seed text and font hints for an element's inline editor. */
export function resolveInlineSurface(element: PptxElement): InlineTextSurface {
	const withText = hasTextProperties(element) ? element : undefined;
	return {
		text: withText?.text ?? '',
		fontSize: withText?.textStyle?.fontSize,
		fontFamily: withText?.textStyle?.fontFamily,
	};
}
