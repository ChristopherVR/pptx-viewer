/**
 * Shared internal helpers for PPTX validation and repair.
 *
 * Contains XML parsing, ZIP I/O, relationship extraction, and path
 * resolution utilities used by both the validation checks and the
 * repair pipeline.
 *
 * @module utils/pptx-validator-helpers
 */

import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// XML parser factory
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured {@link XMLParser} with safe defaults for
 * parsing OOXML relationship and content-type files.
 */
export function createParser(): XMLParser {
	return new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		parseAttributeValue: false,
		removeNSPrefix: false,
	});
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Coerce a value that may be a single item, an array, or nullish into
 * a guaranteed array.
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
	if (Array.isArray(value)) {
		return value;
	}
	if (value === undefined || value === null) {
		return [];
	}
	return [value];
}

/**
 * Normalise a ZIP-internal path so that it always has a leading slash.
 */
export function normalisePath(p: string): string {
	return p.startsWith('/') ? p : `/${p}`;
}

// ---------------------------------------------------------------------------
// ZIP helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to open a buffer as a ZIP archive.
 *
 * @returns The {@link JSZip} instance on success, or an object with an
 *          `error` string if the buffer is not a valid ZIP.
 */
export async function tryOpenZip(buffer: ArrayBuffer): Promise<{ zip: JSZip } | { error: string }> {
	try {
		const zip = await JSZip.loadAsync(buffer);
		return { zip };
	} catch {
		return { error: 'Buffer is not a valid ZIP file' };
	}
}

/**
 * Try to parse an XML string with the given parser.
 *
 * @returns The parsed data on success, or an object with an `error`
 *          message on failure.
 */
export function tryParseXml(
	xml: string,
	parser: XMLParser,
): { data: Record<string, unknown> } | { error: string } {
	try {
		const data = parser.parse(xml) as Record<string, unknown>;
		return { data };
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return { error: msg };
	}
}

/**
 * Read a text file from the ZIP, returning `null` if it does not exist.
 */
export async function readZipText(zip: JSZip, path: string): Promise<string | null> {
	const entry = zip.file(path);
	if (!entry) {
		return null;
	}
	return entry.async('string');
}

// ---------------------------------------------------------------------------
// Relationship helpers
// ---------------------------------------------------------------------------

/**
 * Extract relationship entries from a parsed `.rels` XML object.
 *
 * @returns An array of `{ id, type, target }` tuples.
 */
export function extractRelationships(
	parsed: Record<string, unknown>,
): Array<{ id: string; type: string; target: string }> {
	const relsRoot = parsed['Relationships'] as Record<string, unknown> | undefined;
	if (!relsRoot) {
		return [];
	}
	const entries = ensureArray(
		relsRoot['Relationship'] as Record<string, unknown> | Record<string, unknown>[],
	);
	return entries
		.filter((e) => e !== null)
		.map((e) => ({
			id: String(e['@_Id'] ?? ''),
			type: String(e['@_Type'] ?? ''),
			target: String(e['@_Target'] ?? ''),
		}));
}

/**
 * Resolve a relationship target path relative to the directory that
 * owns the `.rels` file.
 *
 * @param relsDir - The directory that contains the owner part
 *                  (not the `_rels/` directory itself).
 * @param target  - The raw `Target` attribute value from the relationship.
 * @returns The resolved ZIP-internal path.
 */
export function resolveRelTarget(relsDir: string, target: string): string {
	// Absolute targets (start with /) are returned as-is (strip leading /)
	if (target.startsWith('/')) {
		return target.substring(1);
	}
	// External targets (urls) are returned as-is
	if (/^https?:\/\//i.test(target)) {
		return target;
	}

	const parts = relsDir.split('/').filter(Boolean);
	for (const segment of target.split('/')) {
		if (segment === '..') {
			parts.pop();
		} else if (segment !== '.') {
			parts.push(segment);
		}
	}
	return parts.join('/');
}

/**
 * Get the directory that owns a `.rels` file.
 *
 * @example
 * relsOwnerDir("ppt/_rels/presentation.xml.rels"); // "ppt"
 * relsOwnerDir("_rels/.rels");                      // ""
 */
export function relsOwnerDir(relsPath: string): string {
	// Remove the _rels/ segment and the .rels file itself
	const dir = relsPath.replace(/_rels\/[^/]+$/, '');
	return dir.endsWith('/') ? dir.slice(0, -1) : dir;
}
