/**
 * PPTX structural validation checks.
 *
 * Each function inspects one aspect of a PPTX (OOXML) package and
 * appends any issues it finds to the supplied `issues` array. The
 * public entry point {@link validatePptx} orchestrates them all.
 *
 * @module utils/pptx-validator-checks
 */

import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import { validateEcmaRules } from './pptx-validator-conformance';
import {
	createParser,
	ensureArray,
	tryOpenZip,
	tryParseXml,
	readZipText,
	extractRelationships,
	resolveRelTarget,
	relsOwnerDir,
} from './pptx-validator-helpers';
import type { ValidationIssue, ValidationResult } from './pptx-validator-types';
import { REQUIRED_PATHS } from './pptx-validator-types';

// ---------------------------------------------------------------------------
// Individual validation checks
// ---------------------------------------------------------------------------

/**
 * Verify that every required top-level file exists inside the ZIP archive.
 */
async function validateZipStructure(zip: JSZip, issues: ValidationIssue[]): Promise<void> {
	// Check required files exist
	for (const required of REQUIRED_PATHS) {
		if (!zip.file(required)) {
			issues.push({
				severity: 'error',
				code: 'MISSING_REQUIRED_FILE',
				message: `Required file "${required}" is missing from the package`,
				path: required,
			});
		}
	}
}

/**
 * Parse and validate `[Content_Types].xml`.
 *
 * Checks that:
 * - The file is well-formed XML with a `<Types>` root element.
 * - Every `<Override>` part-name points to an actual ZIP entry.
 * - Every non-`.rels` ZIP entry is covered by either an `<Override>` or
 *   a `<Default>` extension mapping.
 */
async function validateContentTypes(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const ctXml = await readZipText(zip, '[Content_Types].xml');
	if (!ctXml) {
		return;
	} // Already flagged as missing required file

	const result = tryParseXml(ctXml, parser);
	if ('error' in result) {
		issues.push({
			severity: 'error',
			code: 'MALFORMED_CONTENT_TYPES',
			message: `[Content_Types].xml is malformed: ${result.error}`,
			path: '[Content_Types].xml',
		});
		return;
	}

	const typesRoot = result.data['Types'] as Record<string, unknown> | undefined;
	if (!typesRoot) {
		issues.push({
			severity: 'error',
			code: 'INVALID_CONTENT_TYPES',
			message: '[Content_Types].xml is missing <Types> root element',
			path: '[Content_Types].xml',
		});
		return;
	}

	// Collect overridden part names
	const overrides = ensureArray(
		typesRoot['Override'] as Record<string, unknown> | Record<string, unknown>[],
	);
	const overridePartNames = new Set<string>();
	for (const entry of overrides) {
		const partName = entry?.['@_PartName'];
		if (typeof partName === 'string') {
			// Part names in content types have leading slash; ZIP paths don't
			const zipPath = partName.startsWith('/') ? partName.substring(1) : partName;
			overridePartNames.add(zipPath);
			// Check that the part actually exists in the archive
			if (!zip.file(zipPath)) {
				issues.push({
					severity: 'warning',
					code: 'CONTENT_TYPE_MISSING_PART',
					message: `Content type override references "${partName}" which does not exist in the archive`,
					path: '[Content_Types].xml',
				});
			}
		}
	}

	// Check that XML files in ppt/ that are not in overrides are covered by default extensions
	const defaults = ensureArray(
		typesRoot['Default'] as Record<string, unknown> | Record<string, unknown>[],
	);
	const defaultExtensions = new Set<string>();
	for (const entry of defaults) {
		const ext = entry?.['@_Extension'];
		if (typeof ext === 'string') {
			defaultExtensions.add(ext.toLowerCase());
		}
	}

	const zipPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
	for (const zipPath of zipPaths) {
		if (zipPath === '[Content_Types].xml') {
			continue;
		}
		if (zipPath.endsWith('.rels')) {
			continue;
		} // .rels covered by extension default
		if (overridePartNames.has(zipPath)) {
			continue;
		}
		const ext = zipPath.split('.').pop()?.toLowerCase();
		if (ext && !defaultExtensions.has(ext)) {
			issues.push({
				severity: 'info',
				code: 'UNCOVERED_CONTENT_TYPE',
				message: `File "${zipPath}" has no content type override or default extension mapping for ".${ext}"`,
				path: zipPath,
			});
		}
	}
}

/**
 * Validate every `.rels` file in the archive.
 *
 * Each relationship entry is checked to ensure its `Target` resolves
 * to an actual ZIP entry (external URLs and `mailto:` targets are
 * skipped).
 */
async function validateRelationships(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	// Find all .rels files in the ZIP
	const relsPaths = Object.keys(zip.files).filter((p) => p.endsWith('.rels'));

	for (const relsPath of relsPaths) {
		const xml = await readZipText(zip, relsPath);
		if (!xml) {
			continue;
		}

		const result = tryParseXml(xml, parser);
		if ('error' in result) {
			issues.push({
				severity: 'error',
				code: 'MALFORMED_RELS',
				message: `Relationship file "${relsPath}" is malformed: ${result.error}`,
				path: relsPath,
			});
			continue;
		}

		const rels = extractRelationships(result.data);
		const ownerDir = relsOwnerDir(relsPath);

		for (const rel of rels) {
			// Skip external targets
			if (/^https?:\/\//i.test(rel.target)) {
				continue;
			}
			if (rel.target.startsWith('mailto:')) {
				continue;
			}

			const resolved = resolveRelTarget(ownerDir, rel.target);
			if (!zip.file(resolved)) {
				issues.push({
					severity: 'warning',
					code: 'DANGLING_RELATIONSHIP',
					message: `Relationship "${rel.id}" in "${relsPath}" targets "${rel.target}" (resolved: "${resolved}") which does not exist`,
					path: relsPath,
				});
			}
		}
	}
}

/**
 * Verify that every `ppt/slides/slideN.xml` file is well-formed XML.
 */
async function validateSlideXml(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const slidePaths = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));

	for (const slidePath of slidePaths) {
		const xml = await readZipText(zip, slidePath);
		if (!xml) {
			continue;
		}

		const result = tryParseXml(xml, parser);
		if ('error' in result) {
			issues.push({
				severity: 'error',
				code: 'MALFORMED_SLIDE_XML',
				message: `Slide XML "${slidePath}" is malformed: ${result.error}`,
				path: slidePath,
			});
		}
	}
}

/**
 * Check that every media file referenced by slide relationships
 * actually exists in the archive.
 */
async function validateMediaReferences(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	// Collect all media files actually in the archive
	const mediaFiles = new Set(
		Object.keys(zip.files).filter((p) => p.startsWith('ppt/media/') && !zip.files[p].dir),
	);

	// Scan slide .rels for media relationship targets
	const slideRelsPaths = Object.keys(zip.files).filter((p) =>
		/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(p),
	);

	for (const relsPath of slideRelsPaths) {
		const xml = await readZipText(zip, relsPath);
		if (!xml) {
			continue;
		}

		const result = tryParseXml(xml, parser);
		if ('error' in result) {
			continue;
		} // Already flagged elsewhere

		const rels = extractRelationships(result.data);
		const ownerDir = relsOwnerDir(relsPath);

		for (const rel of rels) {
			if (/^https?:\/\//i.test(rel.target)) {
				continue;
			}
			const resolved = resolveRelTarget(ownerDir, rel.target);
			if (resolved.startsWith('ppt/media/') && !mediaFiles.has(resolved)) {
				issues.push({
					severity: 'warning',
					code: 'MISSING_MEDIA',
					message: `Slide references media "${resolved}" which does not exist in the archive`,
					path: relsPath,
				});
			}
		}
	}
}

/**
 * Verify that the primary theme file exists and contains a valid
 * `<a:theme>` root element.
 */
async function validateTheme(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const themePath = 'ppt/theme/theme1.xml';
	const themeFile = zip.file(themePath);
	if (!themeFile) {
		issues.push({
			severity: 'warning',
			code: 'MISSING_THEME',
			message: `Theme file "${themePath}" is missing from the package`,
			path: themePath,
		});
		return;
	}

	const xml = await themeFile.async('string');
	const result = tryParseXml(xml, parser);
	if ('error' in result) {
		issues.push({
			severity: 'error',
			code: 'MALFORMED_THEME',
			message: `Theme file "${themePath}" is malformed: ${result.error}`,
			path: themePath,
		});
		return;
	}

	// Check for expected theme elements
	const themeRoot = (result.data['a:theme'] as Record<string, unknown>) ?? null;
	if (!themeRoot) {
		issues.push({
			severity: 'warning',
			code: 'INVALID_THEME_STRUCTURE',
			message: `Theme file "${themePath}" is missing <a:theme> root element`,
			path: themePath,
		});
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a PPTX package with structural and selected ECMA-376 rules.
 *
 * Runs the following checks:
 * 1. Valid ZIP file (can be opened by JSZip)
 * 2. Required files exist: `[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml`
 * 3. Content types reference all existing parts
 * 4. Relationships are consistent (no dangling references)
 * 5. Slide XML is well-formed
 * 6. Media files referenced in slides exist in the archive
 * 7. Theme file exists and is valid
 */
export async function validatePptx(buffer: ArrayBuffer): Promise<ValidationResult> {
	const issues: ValidationIssue[] = [];

	const zipResult = await tryOpenZip(buffer);
	if ('error' in zipResult) {
		issues.push({
			severity: 'error',
			code: 'INVALID_ZIP',
			message: zipResult.error,
		});
		return {
			valid: false,
			issues,
			conformance: {
				level: 'not-checked',
				dialect: 'unknown',
				description: 'ECMA-376 rules were not checked because the package is not a readable ZIP.',
			},
		};
	}

	const { zip } = zipResult;
	const parser = createParser();

	await validateZipStructure(zip, issues);
	await validateContentTypes(zip, parser, issues);
	await validateRelationships(zip, parser, issues);
	await validateSlideXml(zip, parser, issues);
	await validateMediaReferences(zip, parser, issues);
	await validateTheme(zip, parser, issues);
	const conformance = await validateEcmaRules(zip, issues);

	const hasErrors = issues.some((i) => i.severity === 'error');
	return { valid: !hasErrors, issues, conformance };
}
