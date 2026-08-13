import { PptxElement, TextSegment, TextStyle, hasTextProperties } from 'pptx-viewer-core';
import { buildTextBlockStyle } from 'pptx-viewer-shared';
import React from 'react';

import { cloneTextStyle } from './clone';

// Vertical-text writing-mode helpers + line-height + auto-fit scaling now live
// in pptx-viewer-shared (render/text-style-helpers). Re-exported here so
// existing React import paths (`./text-utils`) keep working.
export {
	toCssWritingMode,
	toCssTextOrientation,
	toCssVerticalDirection,
	isVerticalTextDirection,
} from 'pptx-viewer-shared';

export type ListMode = 'none' | 'bullet' | 'number';

export function createUniformTextSegments(
	text: string,
	style: TextStyle | undefined,
): TextSegment[] {
	return [
		{
			text,
			style: cloneTextStyle(style) || {},
		},
	];
}

export function getElementTextContent(element: PptxElement): string {
	if (!hasTextProperties(element)) {
		return '';
	}
	if (typeof element.text === 'string') {
		return element.text;
	}
	if (!element.textSegments || element.textSegments.length === 0) {
		return '';
	}
	return element.textSegments.map((segment: TextSegment) => String(segment.text || '')).join('');
}

export function stripListPrefix(line: string): string {
	return line.replace(/^\s*(?:[-*•◦▪]\s+|\d+[.)]\s+)/u, '');
}

export function detectListMode(text: string): ListMode {
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length === 0) {
		return 'none';
	}
	const allBullets = lines.every((line) => /^[-*•◦▪]\s+/u.test(line));
	if (allBullets) {
		return 'bullet';
	}
	const allNumbers = lines.every((line) => /^\d+[.)]\s+/u.test(line));
	if (allNumbers) {
		return 'number';
	}
	return 'none';
}

export function formatTextAsList(text: string, mode: ListMode): string {
	const lines = text.split('\n');
	if (mode === 'none') {
		return lines.map((line) => stripListPrefix(line)).join('\n');
	}
	if (mode === 'bullet') {
		return lines
			.map((line) => {
				if (line.trim().length === 0) {
					return line;
				}
				return `• ${stripListPrefix(line)}`;
			})
			.join('\n');
	}
	let visibleIndex = 0;
	return lines
		.map((line) => {
			if (line.trim().length === 0) {
				return line;
			}
			visibleIndex += 1;
			return `${visibleIndex}. ${stripListPrefix(line)}`;
		})
		.join('\n');
}

// `createEditorId` deliberately does NOT live here. `pptx-viewer-core` owns the
// one implementation (`createEditorId` in `core/utils/element-utils`), and this
// file's private copy still carried the four-digit random suffix that core
// abandoned: ids minted in the same tick share the timestamp, so that suffix
// produced ~46 duplicates per 1000 ids, and a duplicate element id becomes a
// duplicate `p:cNvPr/@id` on save. The copy had no callers, so it is gone
// rather than re-exported. Import from `pptx-viewer-core` if you need one.

/**
 * Element-level text-body CSS.
 *
 * A thin adapter over the shared {@link buildTextBlockStyle}: the maths moved to
 * `pptx-viewer-shared` so the Vue / Angular / Svelte / Vanilla bindings render
 * from the SAME builder instead of four hand-ported copies that had each lost a
 * different property (autofit, `wrap="none"`, the default font declaration).
 * React keeps its own flex/column layer in `getTextLayoutStyle`, so this call
 * asks for the typography only (`bodyLayout` off) and for React's bare-number
 * lengths, which JSX unit-suffixes.
 */
export function getTextStyleForElement(
	element: PptxElement,
	fallbackColor: string,
): React.CSSProperties {
	return buildTextBlockStyle(element, { fallbackColor }) as React.CSSProperties;
}
