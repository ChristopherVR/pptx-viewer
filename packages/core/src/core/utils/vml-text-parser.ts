/**
 * VML text extraction from `v:textbox` elements.
 *
 * Extracts plain text content and basic text styling from VML text boxes,
 * which contain HTML-like content wrapped in `<div>`, `<p>`, or `<span>`
 * tags.
 *
 * @module vml-text-parser
 */

import type { TextSegment, TextStyle, XmlObject } from '../types';
import { parseCssDimension, parseVmlStyle } from './vml-style-parser';

// ── Text extraction ──────────────────────────────────────────────────

/**
 * Recursively extract plain text from an XML node.
 *
 * Handles nested `div`, `p`, `span`, `b`, `i`, `u`, `font`, `body`,
 * and `html` elements as well as `#text` nodes.
 *
 * @param node - XML node (object or raw string) to extract text from.
 * @returns Concatenated plain text, with paragraphs separated by newlines.
 */
export function extractTextFromXmlNode(node: XmlObject | string | undefined): string {
	if (!node) {
		return '';
	}
	if (typeof node === 'string') {
		return node;
	}

	const parts: string[] = [];

	// Direct text
	if (node['#text'] !== undefined) {
		parts.push(String(node['#text']));
	}

	// Process known container tags
	const containerTags = ['div', 'p', 'span', 'b', 'i', 'u', 'font', 'body', 'html'];
	for (const tag of containerTags) {
		const children = node[tag];
		if (children) {
			const arr = Array.isArray(children) ? children : [children];
			for (const child of arr) {
				const childText = extractTextFromXmlNode(child as XmlObject);
				if (childText.length > 0) {
					parts.push(childText);
				}
			}
		}
	}

	return parts.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Extract text content from a VML `v:textbox` child element.
 *
 * Returns the plain text, a {@link TextStyle} with optional body insets
 * and text direction, and a single {@link TextSegment} wrapping the text.
 *
 * @param node - Parsed XML node of the VML element.
 * @returns Text extraction result, or `null` if the element has no textbox
 *   or the textbox is empty.
 */
export function extractVmlText(node: XmlObject): {
	text: string;
	textStyle: TextStyle;
	textSegments: TextSegment[];
} | null {
	const textbox = node['v:textbox'] as XmlObject | undefined;
	if (!textbox) {
		return null;
	}

	// VML textbox can contain div > p structure or direct text
	const textContent = extractTextFromXmlNode(textbox);
	if (!textContent || textContent.trim().length === 0) {
		return null;
	}

	const textStyle: TextStyle = {};
	const textSegments: TextSegment[] = [];

	// Check textbox inset for margins
	const inset = String(textbox['@_inset'] || '').trim();
	if (inset.length > 0) {
		const parts = inset.split(',').map((s) => s.trim());
		if (parts.length >= 4) {
			textStyle.bodyInsetLeft = parseCssDimension(parts[0]);
			textStyle.bodyInsetTop = parseCssDimension(parts[1]);
			textStyle.bodyInsetRight = parseCssDimension(parts[2]);
			textStyle.bodyInsetBottom = parseCssDimension(parts[3]);
		}
	}

	// Check textbox style for writing direction
	const tbStyle = parseVmlStyle(String(textbox['@_style'] || ''));
	if (tbStyle['layout-flow'] === 'vertical') {
		textStyle.textDirection = 'vertical';
	}

	// Build segments from the text content
	textSegments.push({
		text: textContent,
		style: { ...textStyle },
	});

	return {
		text: textContent,
		textStyle,
		textSegments,
	};
}
