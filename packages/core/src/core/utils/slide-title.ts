/**
 * Derive the display title of a slide from its title placeholder.
 *
 * PowerPoint records each slide's title in `docProps/app.xml`
 * (`TitlesOfParts` / `HeadingPairs`). The canonical source is the slide's
 * title placeholder (`<p:ph type="title"|"ctrTitle">`). This helper mirrors
 * that: it walks the slide's elements, finds the title placeholder, and
 * returns its plain text. Slides with no title placeholder text yield an
 * empty string (PowerPoint stores an empty `vt:lpstr` for such slides).
 *
 * @module slide-title
 */

import type { PptxElement, PptxSlide } from '../types';
import { xmlAttr, xmlPath } from './xml-access';

/** Placeholder types PowerPoint treats as the slide's title. */
const TITLE_PLACEHOLDER_TYPES = new Set(['title', 'ctrtitle']);

interface MaybeTextElement {
	placeholderType?: unknown;
	text?: unknown;
	textSegments?: Array<{ text?: unknown }>;
}

/**
 * Resolve an element's placeholder type. Prefers an explicit
 * `placeholderType` field when a caller has set one (e.g. the markdown
 * converter tests), otherwise reads `p:nvSpPr > p:nvPr > p:ph/@type` from the
 * preserved raw XML.
 */
function getElementPlaceholderType(element: PptxElement): string | undefined {
	const explicit = (element as MaybeTextElement).placeholderType;
	if (typeof explicit === 'string' && explicit.trim().length > 0) {
		return explicit.trim().toLowerCase();
	}
	const ph = xmlPath(element.rawXml, 'p:nvSpPr', 'p:nvPr', 'p:ph');
	const type = xmlAttr(ph, 'type');
	return type ? type.trim().toLowerCase() : undefined;
}

/** Extract the plain text of an element from `text` or joined `textSegments`. */
function getElementPlainText(element: PptxElement): string {
	const maybe = element as MaybeTextElement;
	if (typeof maybe.text === 'string' && maybe.text.trim().length > 0) {
		return maybe.text.trim();
	}
	if (Array.isArray(maybe.textSegments)) {
		const joined = maybe.textSegments
			.map((segment) => (typeof segment?.text === 'string' ? segment.text : ''))
			.join('');
		return joined.trim();
	}
	return '';
}

/**
 * Derive a single slide's title. Returns the title placeholder's text, or an
 * empty string when the slide has no title placeholder with text.
 */
export function deriveSlideTitle(slide: PptxSlide): string {
	const elements = slide.elements ?? [];
	for (const element of elements) {
		const phType = getElementPlaceholderType(element);
		if (phType && TITLE_PLACEHOLDER_TYPES.has(phType)) {
			const text = getElementPlainText(element);
			if (text) {
				return text;
			}
		}
	}
	return '';
}

/** Derive the ordered list of slide titles for an entire deck. */
export function deriveSlideTitles(slides: PptxSlide[]): string[] {
	return slides.map((slide) => deriveSlideTitle(slide));
}
