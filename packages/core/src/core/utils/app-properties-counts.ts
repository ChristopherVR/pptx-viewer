/**
 * The `docProps/app.xml` values PowerPoint itself recomputes on every save,
 * derived the way PowerPoint derives them.
 *
 * Measured over COM (PowerPoint 16.0, `Presentations.Add` + `SaveAs`, and an
 * open / edit / `Save` of a PowerPoint-authored deck):
 *
 * - `Notes` is the number of slides that HAVE a notes page (a `notesSlide`
 *   part), whether or not it holds any text. A slide whose notes page was
 *   merely opened counts; a deck whose three notes pages are all empty
 *   records 3, not 0.
 * - A slide with no title text (no title placeholder, or an empty one) is
 *   listed in `TitlesOfParts` as "PowerPoint Presentation", not as an empty
 *   `vt:lpstr`.
 *
 * @module app-properties-counts
 */

import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import type { XmlObject } from '../types';

/** The `TitlesOfParts` entry PowerPoint writes for a slide with no title text. */
export const UNTITLED_SLIDE_TITLE = 'PowerPoint Presentation';

const SLIDE_REL_TYPE_SUFFIX = '/relationships/slide';
const NOTES_SLIDE_REL_TYPE_SUFFIX = '/relationships/notesSlide';

/** Map derived slide titles onto the entries PowerPoint records for them. */
export function toAppTitleEntries(titles: string[]): string[] {
	return titles.map((title) => (title.length > 0 ? title : UNTITLED_SLIDE_TITLE));
}

function relationshipsOf(parsed: XmlObject): XmlObject[] {
	const root = parsed['Relationships'] as XmlObject | undefined;
	const raw = root?.['Relationship'];
	if (Array.isArray(raw)) {
		return raw as XmlObject[];
	}
	return raw && typeof raw === 'object' ? [raw as XmlObject] : [];
}

async function readRelationships(
	zip: JSZip,
	parser: XMLParser,
	path: string,
): Promise<XmlObject[] | undefined> {
	const file = zip.file(path);
	if (!file) {
		return undefined;
	}
	return relationshipsOf(parser.parse(await file.async('string')) as XmlObject);
}

/** Resolve a relationship target relative to the part directory it sits in. */
function resolveTarget(baseDir: string, target: string): string {
	if (target.startsWith('/')) {
		return target.slice(1);
	}
	const parts = baseDir.split('/').filter(Boolean);
	for (const segment of target.split('/')) {
		if (segment === '..') {
			parts.pop();
		} else if (segment !== '.' && segment.length > 0) {
			parts.push(segment);
		}
	}
	return parts.join('/');
}

/**
 * Count the saved package's slides that carry a notes page, following
 * `presentation.xml.rels` to each slide and that slide's own rels, so an
 * orphaned `notesSlide` part left behind by a deleted slide is not counted.
 * Returns `undefined` when the package has no presentation rels to follow.
 */
export async function countNotesPages(zip: JSZip, parser: XMLParser): Promise<number | undefined> {
	const presentationRels = await readRelationships(zip, parser, 'ppt/_rels/presentation.xml.rels');
	if (!presentationRels) {
		return undefined;
	}
	let count = 0;
	for (const rel of presentationRels) {
		const type = String(rel['@_Type'] ?? '');
		if (!type.endsWith(SLIDE_REL_TYPE_SUFFIX)) {
			continue;
		}
		const slidePath = resolveTarget('ppt', String(rel['@_Target'] ?? ''));
		const slash = slidePath.lastIndexOf('/');
		const relsPath = `${slidePath.slice(0, slash)}/_rels/${slidePath.slice(slash + 1)}.rels`;
		const slideRels = (await readRelationships(zip, parser, relsPath)) ?? [];
		if (slideRels.some((r) => String(r['@_Type'] ?? '').endsWith(NOTES_SLIDE_REL_TYPE_SUFFIX))) {
			count++;
		}
	}
	return count;
}
