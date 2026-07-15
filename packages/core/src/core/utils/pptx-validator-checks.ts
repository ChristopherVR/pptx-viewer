/** PPTX package validation orchestration and part-specific checks. */
import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import { validateEcmaRules } from './pptx-validator-conformance';
import { rootTag } from './pptx-validator-conformance-xml';
import { validatePresentationRelationships } from './pptx-validator-cross-part';
import {
	createParser,
	extractRelationships,
	readZipText,
	relsOwnerDir,
	resolveRelTarget,
	tryOpenZip,
	tryParseXml,
} from './pptx-validator-helpers';
import { validateOpcContentTypes, validateOpcRelationships } from './pptx-validator-opc';
import { validatePartModels } from './pptx-validator-part-models';
import type { ValidationIssue, ValidationResult } from './pptx-validator-types';
import { REQUIRED_PATHS } from './pptx-validator-types';

async function validateZipStructure(zip: JSZip, issues: ValidationIssue[]): Promise<void> {
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

async function validateSlideXml(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	for (const path of Object.keys(zip.files).filter((entry) =>
		/^ppt\/slides\/slide\d+\.xml$/.test(entry),
	)) {
		const xml = await readZipText(zip, path);
		if (!xml) {
			continue;
		}
		const parsed = tryParseXml(xml, parser);
		if ('error' in parsed) {
			issues.push({
				severity: 'error',
				code: 'MALFORMED_SLIDE_XML',
				message: `Slide XML "${path}" is malformed: ${parsed.error}`,
				path,
			});
		}
	}
}

async function validateMediaReferences(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const media = new Set(
		Object.keys(zip.files).filter((path) => path.startsWith('ppt/media/') && !zip.files[path].dir),
	);
	for (const path of Object.keys(zip.files).filter((entry) =>
		/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(entry),
	)) {
		const xml = await readZipText(zip, path);
		if (!xml) {
			continue;
		}
		const parsed = tryParseXml(xml, parser);
		if ('error' in parsed) {
			continue;
		}
		for (const rel of extractRelationships(parsed.data)) {
			if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(rel.target)) {
				continue;
			}
			const resolved = resolveRelTarget(relsOwnerDir(path), rel.target.split('#')[0]);
			if (resolved.startsWith('ppt/media/') && !media.has(resolved)) {
				issues.push({
					severity: 'warning',
					code: 'MISSING_MEDIA',
					message: `Slide references media "${resolved}" which does not exist in the archive`,
					path,
				});
			}
		}
	}
}

async function validateTheme(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const path = 'ppt/theme/theme1.xml';
	const file = zip.file(path);
	if (!file) {
		issues.push({
			severity: 'warning',
			code: 'MISSING_THEME',
			message: `Theme file "${path}" is missing from the package`,
			path,
		});
		return;
	}
	const parsed = tryParseXml(await file.async('string'), parser);
	if ('error' in parsed) {
		issues.push({
			severity: 'error',
			code: 'MALFORMED_THEME',
			message: `Theme file "${path}" is malformed: ${parsed.error}`,
			path,
		});
	} else if (
		rootTag(await file.async('string'))
			?.split(':')
			.pop() !== 'theme'
	) {
		issues.push({
			severity: 'warning',
			code: 'INVALID_THEME_STRUCTURE',
			message: `Theme file "${path}" is missing a theme root element`,
			path,
		});
	}
}

/** Rule-backed OPC and selected ECMA-376 validation, not exhaustive XSD validation. */
export async function validatePptx(buffer: ArrayBuffer): Promise<ValidationResult> {
	const issues: ValidationIssue[] = [];
	const opened = await tryOpenZip(buffer);
	if ('error' in opened) {
		issues.push({ severity: 'error', code: 'INVALID_ZIP', message: opened.error });
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
	const { zip } = opened;
	const parser = createParser();
	await validateZipStructure(zip, issues);
	await validateOpcContentTypes(zip, parser, issues);
	await validateOpcRelationships(zip, parser, issues);
	await validatePartModels(zip, issues);
	await validatePresentationRelationships(zip, parser, issues);
	await validateSlideXml(zip, parser, issues);
	await validateMediaReferences(zip, parser, issues);
	await validateTheme(zip, parser, issues);
	const conformance = await validateEcmaRules(zip, issues);
	return { valid: !issues.some((issue) => issue.severity === 'error'), issues, conformance };
}
