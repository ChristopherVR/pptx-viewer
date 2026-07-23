/**
 * Recompute the `TitlesOfParts` / `HeadingPairs` vectors in a parsed
 * `docProps/app.xml` `Properties` node from the current slide titles.
 *
 * PowerPoint records, in `app.xml`:
 *   - `HeadingPairs`: a `vt:vector` of (name, count) variant pairs, e.g.
 *     "Fonts Used"/3, "Theme"/1, "Slide Titles"/N.
 *   - `TitlesOfParts`: a flat `vt:vector` of `vt:lpstr` entries whose order
 *     matches the HeadingPairs categories: first the font names, then the
 *     theme name(s), then one entry per slide title.
 *
 * After a slide is added, removed, or retitled these go stale. This module
 * preserves the non-slide categories (fonts, theme, ...) verbatim and only
 * rewrites the "Slide Titles" category's entries + count, keeping both
 * vectors internally consistent.
 *
 * @module app-properties-titles
 */

import type { XmlObject } from '../types';
import { isXmlNode, xmlChild, xmlChildren } from './xml-access';

const SLIDE_TITLES_NAME = 'Slide Titles';

interface HeadingCategory {
	name: string;
	entries: string[];
}

/** Coerce a parsed XML leaf (string / number / `{#text}`) into a string. */
function coerceText(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (isXmlNode(value)) {
		const text = value['#text'];
		return text === undefined || text === null ? '' : String(text);
	}
	return '';
}

/** Coerce a parsed XML leaf into a non-negative integer count. */
function coerceCount(value: unknown): number {
	const parsed = Number.parseInt(coerceText(value), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Normalize an lpstr child (single value or array) into a string list. */
function readLpstrList(vector: XmlObject | undefined): string[] {
	if (!vector) {
		return [];
	}
	const raw = vector['vt:lpstr'];
	if (raw === undefined || raw === null) {
		return [];
	}
	return (Array.isArray(raw) ? raw : [raw]).map(coerceText);
}

/** A category is the slide-titles bucket if its name reads as such. */
function isSlideTitlesCategory(name: string): boolean {
	const normalized = name.trim().toLowerCase();
	return (
		normalized === 'slide titles' || (normalized.includes('slide') && normalized.includes('title'))
	);
}

/**
 * Split the existing HeadingPairs + TitlesOfParts into ordered categories,
 * pairing each heading name with the slice of title entries it owns.
 */
function readCategories(
	headingPairs: XmlObject,
	titlesOfParts: XmlObject | undefined,
): HeadingCategory[] {
	const variants = xmlChildren(xmlChild(headingPairs, 'vt:vector'), 'vt:variant');
	const entries = readLpstrList(xmlChild(titlesOfParts, 'vt:vector'));

	const categories: HeadingCategory[] = [];
	let offset = 0;
	for (let i = 0; i + 1 < variants.length; i += 2) {
		const name = coerceText(variants[i]['vt:lpstr']);
		const count = coerceCount(variants[i + 1]['vt:i4']);
		categories.push({ name, entries: entries.slice(offset, offset + count) });
		offset += count;
	}
	return categories;
}

/** Rebuild the `HeadingPairs` variant vector from the categories. */
function writeHeadingPairs(appProps: XmlObject, categories: HeadingCategory[]): void {
	const variants: XmlObject[] = [];
	for (const category of categories) {
		variants.push({ 'vt:lpstr': category.name });
		variants.push({ 'vt:i4': String(category.entries.length) });
	}
	appProps['HeadingPairs'] = {
		'vt:vector': {
			'@_size': String(variants.length),
			'@_baseType': 'variant',
			'vt:variant': variants,
		},
	};
}

/** Rebuild the `TitlesOfParts` lpstr vector from the categories. */
function writeTitlesOfParts(appProps: XmlObject, categories: HeadingCategory[]): void {
	const allEntries = categories.flatMap((category) => category.entries);
	// Represent each entry as a `#text` node so empty titles round-trip as an
	// empty `<vt:lpstr>` and the value type stays a valid XmlObject[].
	const lpstr: XmlObject[] = allEntries.map((entry) => ({ '#text': entry }));
	appProps['TitlesOfParts'] = {
		'vt:vector': {
			'@_size': String(allEntries.length),
			'@_baseType': 'lpstr',
			'vt:lpstr': lpstr,
		},
	};
}

/**
 * Recompute the slide-title portion of `app.xml` in place. Non-slide
 * categories (fonts, theme) are preserved; the slide-titles category's
 * entries become `titles` (and its count follows). When no slide-titles
 * category exists but HeadingPairs does, one is appended so the data becomes
 * consistent with the current slide set.
 *
 * If HeadingPairs is absent the structure cannot be split safely, so the
 * node is left untouched (an already-passthrough deck stays byte-stable).
 */
export function applySlideTitlesToAppProps(appProps: XmlObject, titles: string[]): void {
	const headingPairs = xmlChild(appProps, 'HeadingPairs');
	if (!headingPairs) {
		return;
	}
	const titlesOfParts = xmlChild(appProps, 'TitlesOfParts');

	const categories = readCategories(headingPairs, titlesOfParts);
	const slideCategory = categories.find((category) => isSlideTitlesCategory(category.name));
	if (slideCategory) {
		slideCategory.entries = titles;
	} else {
		categories.push({ name: SLIDE_TITLES_NAME, entries: titles });
	}

	writeHeadingPairs(appProps, categories);
	writeTitlesOfParts(appProps, categories);
}
