/**
 * notes-html.ts: framework-agnostic HTML <-> segment bridge for the rich
 * speaker-notes contentEditable editor, shared by every binding.
 *
 * Ported from React's `viewer/components/notes/notes-html.tsx` (the JSX
 * read-only renderer stays per binding; only the contentEditable serialise /
 * parse pair is portable). `segmentsToEditorHtml` builds the innerHTML seeded
 * into the editor; `parseSegmentsFromRichEditor` walks the live DOM back into
 * `TextSegment[]` after each edit.
 */

import type { BulletInfo, TextSegment, TextStyle } from 'pptx-viewer-core';

import { isUrlSafe } from '../hyperlink-security';
import {
	INDENT_PX,
	escapeHtml,
	normalizeSegments,
	parsePt,
	segmentsToParagraphs,
} from './notes-utils';

/**
 * Whitelist of CSS values safe to inline into a `style` attribute that the
 * browser will then parse for a contentEditable surface. Values from PPTX text
 * styles flow through this gate before being interpolated; anything containing
 * CSS-attribute control characters (semicolons, quotes, parens, angle brackets)
 * is dropped to prevent CSS-injection or attribute-break-out.
 */
const CSS_VALUE_SAFE = /^[a-zA-Z0-9 _,.\-+#'%/]{1,100}$/u;
function isCssValueSafe(value: string | number | undefined | null): boolean {
	if (value === undefined || value === null) {
		return false;
	}
	const str = String(value);
	return str.length > 0 && CSS_VALUE_SAFE.test(str);
}

/* ------------------------------------------------------------------ */
/*  Style derivation from DOM elements                                 */
/* ------------------------------------------------------------------ */

function deriveStyleFromElement(element: HTMLElement, inheritedStyle: TextStyle): TextStyle {
	const style: TextStyle = { ...inheritedStyle };
	const tagName = element.tagName.toLowerCase();
	if (tagName === 'b' || tagName === 'strong') {
		style.bold = true;
	}
	if (tagName === 'i' || tagName === 'em') {
		style.italic = true;
	}
	if (tagName === 'u') {
		style.underline = true;
	}
	if (tagName === 's' || tagName === 'strike') {
		style.strikethrough = true;
	}
	if (tagName === 'a') {
		const href = element.getAttribute('href');
		if (href) {
			style.hyperlink = href;
		}
		style.underline = true;
		style.color = '#4a9eff';
	}

	const inlineStyle = element.style;
	if (inlineStyle.fontWeight === 'bold' || Number(inlineStyle.fontWeight) >= 600) {
		style.bold = true;
	}
	if (inlineStyle.fontStyle === 'italic') {
		style.italic = true;
	}
	if (
		inlineStyle.textDecoration.includes('underline') ||
		inlineStyle.textDecorationLine.includes('underline')
	) {
		style.underline = true;
	}
	if (
		inlineStyle.textDecoration.includes('line-through') ||
		inlineStyle.textDecorationLine.includes('line-through')
	) {
		style.strikethrough = true;
	}
	if (inlineStyle.color) {
		style.color = inlineStyle.color;
	}
	const fontSizePt = parsePt(inlineStyle.fontSize);
	if (fontSizePt !== undefined) {
		style.fontSize = fontSizePt;
	}
	if (inlineStyle.fontFamily) {
		style.fontFamily = inlineStyle.fontFamily;
	}
	return style;
}

/* ------------------------------------------------------------------ */
/*  Parse segments from a contentEditable rich editor                  */
/* ------------------------------------------------------------------ */

export function parseSegmentsFromRichEditor(root: HTMLElement): TextSegment[] {
	const segments: TextSegment[] = [];

	const walk = (node: Node, inheritedStyle: TextStyle) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const value = node.textContent ?? '';
			if (value.length > 0) {
				segments.push({ text: value, style: { ...inheritedStyle } });
			}
			return;
		}
		if (!(node instanceof HTMLElement)) {
			return;
		}

		if (node.tagName.toLowerCase() === 'br') {
			segments.push({ text: '', style: {}, isParagraphBreak: true });
			return;
		}

		const nextStyle = deriveStyleFromElement(node, inheritedStyle);
		const tag = node.tagName.toLowerCase();
		const isBlock = ['div', 'p', 'li'].includes(tag);

		let bulletInfo: BulletInfo | undefined;
		let paraIndent = 0;
		if (isBlock && node.dataset.bulletType) {
			const bt = node.dataset.bulletType;
			if (bt === 'bullet') {
				bulletInfo = { char: '•' };
			} else if (bt === 'numbered') {
				bulletInfo = { autoNumType: 'arabicPeriod' };
			}
		}
		if (isBlock && node.dataset.indentLevel) {
			paraIndent = Number.parseInt(node.dataset.indentLevel, 10) || 0;
		}

		const segStartIdx = segments.length;
		node.childNodes.forEach((child) => walk(child, nextStyle));

		if (isBlock && (bulletInfo || paraIndent > 0)) {
			for (let i = segStartIdx; i < segments.length; i++) {
				if (!segments[i].isParagraphBreak) {
					if (bulletInfo) {
						segments[i].bulletInfo = bulletInfo;
					}
					if (paraIndent > 0) {
						segments[i].style = {
							...segments[i].style,
							paragraphMarginLeft: paraIndent * INDENT_PX,
						};
					}
					break;
				}
			}
		}

		if (isBlock) {
			segments.push({ text: '', style: {}, isParagraphBreak: true });
		}
	};

	root.childNodes.forEach((child) => walk(child, {}));
	return normalizeSegments(segments);
}

/* ------------------------------------------------------------------ */
/*  Segments -> editor HTML (for contentEditable innerHTML)            */
/* ------------------------------------------------------------------ */

export function segmentsToEditorHtml(segments: TextSegment[]): string {
	const paragraphs = segmentsToParagraphs(segments);
	let numberedCounter = 0;

	return paragraphs
		.map((para) => {
			if (para.bulletType === 'numbered') {
				numberedCounter++;
			} else {
				numberedCounter = 0;
			}

			const runsHtml = para.segments
				.map((segment) => {
					if (segment.isParagraphBreak) {
						return '';
					}
					const inlineStyles: string[] = [];
					if (segment.style.bold) {
						inlineStyles.push('font-weight:700');
					}
					if (segment.style.italic) {
						inlineStyles.push('font-style:italic');
					}
					if (segment.style.underline) {
						inlineStyles.push('text-decoration:underline');
					}
					if (segment.style.strikethrough) {
						inlineStyles.push('text-decoration:line-through');
					}
					if (segment.style.color && isCssValueSafe(segment.style.color)) {
						inlineStyles.push(`color:${segment.style.color}`);
					}
					if (segment.style.fontSize && Number.isFinite(Number(segment.style.fontSize))) {
						inlineStyles.push(`font-size:${Number(segment.style.fontSize)}pt`);
					}
					if (segment.style.fontFamily && isCssValueSafe(segment.style.fontFamily)) {
						inlineStyles.push(`font-family:${segment.style.fontFamily}`);
					}

					const text = escapeHtml(segment.text);

					if (segment.style.hyperlink && isUrlSafe(segment.style.hyperlink)) {
						const href = escapeHtml(segment.style.hyperlink);
						return `<a href="${href}" style="color:#4a9eff;text-decoration:underline;cursor:pointer" data-hyperlink="${href}">${text}</a>`;
					}

					const styleAttr = inlineStyles.length > 0 ? ` style="${inlineStyles.join(';')}"` : '';
					return `<span${styleAttr}>${text}</span>`;
				})
				.join('');

			const attrs: string[] = [];
			if (para.bulletType !== 'none') {
				attrs.push(`data-bullet-type="${para.bulletType}"`);
			}
			if (para.indentLevel > 0) {
				attrs.push(`data-indent-level="${para.indentLevel}"`);
			}

			const indent = para.indentLevel * INDENT_PX;
			const divStyles: string[] = [];
			if (indent > 0) {
				divStyles.push(`padding-left:${indent}px`);
			}

			let prefix = '';
			if (para.bulletType === 'bullet') {
				prefix = `<span style="margin-right:6px;color:#9ca3af" contenteditable="false">•</span>`;
			} else if (para.bulletType === 'numbered') {
				prefix = `<span style="margin-right:6px;color:#9ca3af" contenteditable="false">${numberedCounter}.</span>`;
			}

			const styleStr = divStyles.length > 0 ? ` style="${divStyles.join(';')}"` : '';
			const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

			return `<div${attrStr}${styleStr}>${prefix}${runsHtml || '<br />'}</div>`;
		})
		.join('');
}
