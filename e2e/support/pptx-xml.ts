/**
 * Read one text part out of a saved `.pptx` byte buffer.
 *
 * Several specs need to inspect the raw XML of a specific slide/chart part
 * after a round-trip through the real editor (select -> edit -> Save via
 * `save-pptx.ts` -> download), rather than the parsed `PptxData` model. JSZip
 * is resolved from `pptx-viewer-core`'s dependency scope, same pattern as
 * `support/pptx-integrity.ts`, so this needs no dependency of its own.
 *
 * @module e2e/support/pptx-xml
 */
import { createRequire } from 'node:module';

import type JSZipType from 'jszip';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

/** The raw XML text of `partName` (e.g. `ppt/slides/slide1.xml`) inside `bytes`. */
export async function readZipPartText(bytes: Uint8Array, partName: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const entry = zip.file(partName);
	if (!entry) {
		throw new Error(`no such part in the package: ${partName}`);
	}
	return entry.async('string');
}

/**
 * The substring of `xml` covering the FIRST `<tag ...>...</tag>` element whose
 * opening tag or content contains `marker` - a lightweight way to isolate one
 * shape's block by its name/id without a full XML parse, matching the style
 * the fixture generators in this directory already use for injection.
 */
export function extractElementBlock(xml: string, tag: string, marker: string): string {
	const openTag = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gu');
	let match: RegExpExecArray | null;
	while ((match = openTag.exec(xml))) {
		const start = match.index;
		const closeIdx = xml.indexOf(`</${tag}>`, start);
		if (closeIdx < 0) {
			break;
		}
		const end = closeIdx + tag.length + 3;
		const block = xml.slice(start, end);
		if (block.includes(marker)) {
			return block;
		}
		openTag.lastIndex = end;
	}
	throw new Error(`no <${tag}> block containing ${JSON.stringify(marker)} found`);
}
