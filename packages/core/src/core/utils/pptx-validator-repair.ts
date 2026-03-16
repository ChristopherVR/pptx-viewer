/**
 * PPTX repair utilities.
 *
 * Provides automated repair for common PPTX structural problems:
 * rebuilding `[Content_Types].xml`, removing dangling relationships,
 * adding missing relationships, and patching malformed XML.
 *
 * @module utils/pptx-validator-repair
 */

import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import {
	createParser,
	normalisePath,
	tryOpenZip,
	tryParseXml,
	readZipText,
	extractRelationships,
	resolveRelTarget,
	relsOwnerDir,
} from './pptx-validator-helpers';
import type { RepairResult } from './pptx-validator-types';
import {
	EXTENSION_CONTENT_TYPES,
	PART_CONTENT_TYPES,
	SLIDE_CONTENT_TYPE,
	SLIDE_LAYOUT_CONTENT_TYPE,
	SLIDE_MASTER_CONTENT_TYPE,
	THEME_CONTENT_TYPE,
} from './pptx-validator-types';

// ---------------------------------------------------------------------------
// Internal repair helpers
// ---------------------------------------------------------------------------

/**
 * Rebuild `[Content_Types].xml` from the actual ZIP contents.
 *
 * Scans every entry in the archive and produces a complete content-types
 * file with appropriate `<Default>` extension mappings and `<Override>`
 * entries for well-known PPTX parts.
 */
function rebuildContentTypes(zip: JSZip): string {
	const defaults = new Map<string, string>();
	const overrides: Array<{ partName: string; contentType: string }> = [];

	// Always include rels and xml defaults
	defaults.set('rels', EXTENSION_CONTENT_TYPES.rels);
	defaults.set('xml', EXTENSION_CONTENT_TYPES.xml);

	const zipPaths = Object.keys(zip.files).filter(
		(p) => !zip.files[p].dir && p !== '[Content_Types].xml',
	);

	for (const zipPath of zipPaths) {
		if (zipPath.endsWith('.rels')) {
			continue;
		}

		const normalised = normalisePath(zipPath);

		// Check for well-known part-name overrides
		if (PART_CONTENT_TYPES[normalised]) {
			overrides.push({
				partName: normalised,
				contentType: PART_CONTENT_TYPES[normalised],
			});
			continue;
		}

		// Slides
		if (/^\/ppt\/slides\/slide\d+\.xml$/.test(normalised)) {
			overrides.push({ partName: normalised, contentType: SLIDE_CONTENT_TYPE });
			continue;
		}

		// Slide layouts
		if (/^\/ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(normalised)) {
			overrides.push({
				partName: normalised,
				contentType: SLIDE_LAYOUT_CONTENT_TYPE,
			});
			continue;
		}

		// Slide masters
		if (/^\/ppt\/slideMasters\/slideMaster\d+\.xml$/.test(normalised)) {
			overrides.push({
				partName: normalised,
				contentType: SLIDE_MASTER_CONTENT_TYPE,
			});
			continue;
		}

		// Theme
		if (/^\/ppt\/theme\/theme\d+\.xml$/.test(normalised)) {
			overrides.push({ partName: normalised, contentType: THEME_CONTENT_TYPE });
			continue;
		}

		// For everything else, ensure the extension has a default
		const ext = zipPath.split('.').pop()?.toLowerCase();
		if (ext && EXTENSION_CONTENT_TYPES[ext] && !defaults.has(ext)) {
			defaults.set(ext, EXTENSION_CONTENT_TYPES[ext]);
		}
	}

	const defaultEntries = Array.from(defaults.entries())
		.map(([ext, ct]) => `  <Default Extension="${ext}" ContentType="${ct}"/>`)
		.join('\n');

	const overrideEntries = overrides
		.map((o) => `  <Override PartName="${o.partName}" ContentType="${o.contentType}"/>`)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
${defaultEntries}
${overrideEntries}
</Types>`;
}

/**
 * Remove dangling relationship references from a `.rels` XML string.
 *
 * A relationship is considered "dangling" when its `Target` resolves
 * to a ZIP path that does not exist in the archive (external URLs and
 * `mailto:` targets are always kept).
 *
 * @returns The cleaned XML and the IDs of removed relationships.
 */
function removeDanglingRels(
	xml: string,
	zip: JSZip,
	relsPath: string,
	parser: XMLParser,
): { xml: string; removedIds: string[] } {
	const result = tryParseXml(xml, parser);
	if ('error' in result) {
		return { xml, removedIds: [] };
	}

	const rels = extractRelationships(result.data);
	const ownerDir = relsOwnerDir(relsPath);
	const removedIds: string[] = [];
	const keptRels: Array<{ id: string; type: string; target: string }> = [];

	for (const rel of rels) {
		if (/^https?:\/\//i.test(rel.target) || rel.target.startsWith('mailto:')) {
			keptRels.push(rel);
			continue;
		}

		const resolved = resolveRelTarget(ownerDir, rel.target);
		if (zip.file(resolved)) {
			keptRels.push(rel);
		} else {
			removedIds.push(rel.id);
		}
	}

	if (removedIds.length === 0) {
		return { xml, removedIds: [] };
	}

	// Rebuild the XML
	const relEntries = keptRels
		.map((r) => `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
		.join('\n');

	const rebuilt = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relEntries}
</Relationships>`;

	return { xml: rebuilt, removedIds };
}

/**
 * Add missing relationship entries for discovered parts that exist in
 * the ZIP but are not referenced by any `.rels` file.
 *
 * Currently handles the case where `ppt/presentation.xml` exists but
 * is not referenced from `_rels/.rels`.
 */
async function addMissingRelationships(
	zip: JSZip,
	parser: XMLParser,
	repairs: string[],
): Promise<void> {
	// Check root .rels for presentation.xml reference
	const rootRelsPath = '_rels/.rels';
	const rootRelsXml = await readZipText(zip, rootRelsPath);
	if (!rootRelsXml) {
		// Create a minimal root .rels if the file exists elsewhere
		if (zip.file('ppt/presentation.xml')) {
			const newRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
			zip.file(rootRelsPath, newRels);
			repairs.push('Created missing _rels/.rels with presentation.xml relationship');
		}
		return;
	}

	const result = tryParseXml(rootRelsXml, parser);
	if ('error' in result) {
		return;
	}

	const rels = extractRelationships(result.data);
	const hasPresentation = rels.some(
		(r) =>
			r.type ===
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
	);

	if (!hasPresentation && zip.file('ppt/presentation.xml')) {
		// Find a new rId
		const usedIds = new Set(rels.map((r) => r.id));
		let newId = 1;
		while (usedIds.has(`rId${newId}`)) {
			newId++;
		}

		rels.push({
			id: `rId${newId}`,
			type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
			target: 'ppt/presentation.xml',
		});

		const relEntries = rels
			.map((r) => `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
			.join('\n');
		const rebuilt = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relEntries}
</Relationships>`;

		zip.file(rootRelsPath, rebuilt);
		repairs.push('Added missing officeDocument relationship to _rels/.rels');
	}
}

/**
 * Attempt basic XML fixes: close unclosed self-closing tags.
 *
 * This is intentionally conservative -- only fixes patterns like
 * `<tag attr="val">` that should be `<tag attr="val"/>` for a small
 * set of known empty OOXML elements.
 */
function fixMalformedXml(xml: string): { fixed: string; didFix: boolean } {
	// Fix unclosed self-closing tags for known empty elements
	// Pattern: match tags that are opened but have no closing tag and no content
	const emptyElements = [
		'a:off',
		'a:ext',
		'a:chOff',
		'a:chExt',
		'a:srgbClr',
		'a:schemeClr',
		'a:latin',
		'a:ea',
		'a:cs',
		'a:buNone',
		'a:noFill',
		'a:defRPr',
	];

	let fixed = xml;
	let didFix = false;

	// Extracted outside the loop to avoid defining a function inside a loop body.
	const selfCloseReplacer = (match: string, openTag: string): string => {
		// Only fix if the tag doesn't already self-close
		if (openTag.endsWith('/')) {
			return match;
		}
		didFix = true;
		return `${openTag}/>`;
	};

	for (const tag of emptyElements) {
		// Match opening tags that aren't self-closed and aren't followed by content/closing
		const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = new RegExp(`(<${escapedTag}(?:\\s[^>]*)?)>(?=\\s*<(?!/${escapedTag}))`, 'g');

		const replaced = fixed.replace(pattern, selfCloseReplacer);
		fixed = replaced;
	}

	return { fixed, didFix };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to repair common PPTX issues.
 *
 * Repair operations:
 * 1. Rebuild `[Content_Types].xml` from actual ZIP contents
 * 2. Remove dangling relationship references
 * 3. Add missing relationships for discovered parts
 * 4. Fix malformed XML (close unclosed tags -- basic)
 */
export async function repairPptx(buffer: ArrayBuffer): Promise<RepairResult> {
	const repairs: string[] = [];

	const zipResult = await tryOpenZip(buffer);
	if ('error' in zipResult) {
		throw new Error(`Cannot repair: file is not a valid ZIP archive. ${zipResult.error}`);
	}

	const { zip } = zipResult;
	const parser = createParser();

	// 1. Rebuild [Content_Types].xml
	const existingCt = await readZipText(zip, '[Content_Types].xml');
	const rebuilt = rebuildContentTypes(zip);

	if (!existingCt) {
		repairs.push('Created missing [Content_Types].xml');
	} else if (existingCt.trim() !== rebuilt.trim()) {
		repairs.push('Rebuilt [Content_Types].xml from actual ZIP contents');
	}
	zip.file('[Content_Types].xml', rebuilt);

	// 2. Remove dangling relationship references
	const relsPaths = Object.keys(zip.files).filter((p) => p.endsWith('.rels'));
	for (const relsPath of relsPaths) {
		const xml = await readZipText(zip, relsPath);
		if (!xml) {
			continue;
		}

		const { xml: cleaned, removedIds } = removeDanglingRels(xml, zip, relsPath, parser);
		if (removedIds.length > 0) {
			zip.file(relsPath, cleaned);
			repairs.push(
				`Removed ${removedIds.length} dangling relationship(s) from "${relsPath}": ${removedIds.join(', ')}`,
			);
		}
	}

	// 3. Add missing relationships
	await addMissingRelationships(zip, parser, repairs);

	// 4. Fix malformed XML in slides
	const xmlPaths = Object.keys(zip.files).filter((p) => p.endsWith('.xml') && !zip.files[p].dir);
	for (const xmlPath of xmlPaths) {
		const xml = await readZipText(zip, xmlPath);
		if (!xml) {
			continue;
		}

		const { fixed, didFix } = fixMalformedXml(xml);
		if (didFix) {
			zip.file(xmlPath, fixed);
			repairs.push(`Fixed malformed XML in "${xmlPath}"`);
		}
	}

	const repairedBuffer = await zip.generateAsync({ type: 'arraybuffer' });
	return { repaired: repairedBuffer, repairs };
}
