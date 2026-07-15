import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import {
	ensureArray,
	readZipText,
	relsOwnerDir,
	resolveRelTarget,
	tryParseXml,
} from './pptx-validator-helpers';
import {
	canonicalPartName,
	isExternalTarget,
	relationshipsOwner,
	targetEscapesRoot,
	validPartName,
} from './pptx-validator-opc-helpers';
import type { ValidationIssue } from './pptx-validator-types';

function add(
	issues: ValidationIssue[],
	path: string,
	code: string,
	message: string,
	severity: ValidationIssue['severity'] = 'error',
): void {
	issues.push({ severity, code, message, path });
}

export async function validateOpcContentTypes(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const path = '[Content_Types].xml';
	const xml = await readZipText(zip, path);
	if (!xml) {
		return;
	}
	const parsed = tryParseXml(xml, parser);
	if ('error' in parsed) {
		add(
			issues,
			path,
			'MALFORMED_CONTENT_TYPES',
			`[Content_Types].xml is malformed: ${parsed.error}`,
		);
		return;
	}
	const root = parsed.data.Types as Record<string, unknown> | undefined;
	if (!root) {
		add(
			issues,
			path,
			'INVALID_CONTENT_TYPES',
			'[Content_Types].xml is missing <Types> root element',
		);
		return;
	}
	const extensions = new Set<string>();
	for (const entry of ensureArray(
		root.Default as Record<string, unknown> | Record<string, unknown>[],
	)) {
		const ext =
			typeof entry?.['@_Extension'] === 'string' ? entry['@_Extension'].toLowerCase() : '';
		if (extensions.has(ext)) {
			add(
				issues,
				path,
				'DUPLICATE_CONTENT_TYPE_DEFAULT',
				`Content type Default for extension "${ext}" occurs more than once`,
			);
		}
		if (ext) {
			extensions.add(ext);
		}
	}
	const overrides = new Set<string>();
	const covered = new Set<string>();
	for (const entry of ensureArray(
		root.Override as Record<string, unknown> | Record<string, unknown>[],
	)) {
		const name = typeof entry?.['@_PartName'] === 'string' ? entry['@_PartName'] : '';
		if (!validPartName(name)) {
			add(
				issues,
				path,
				'INVALID_PART_NAME',
				`Content type Override PartName "${name}" is not a valid absolute OPC part name`,
			);
			continue;
		}
		const key = canonicalPartName(name);
		if (overrides.has(key)) {
			add(
				issues,
				path,
				'DUPLICATE_CONTENT_TYPE_OVERRIDE',
				`Content type Override for "${name}" occurs more than once`,
			);
		}
		overrides.add(key);
		const zipPath = name.slice(1);
		covered.add(zipPath);
		if (!zip.file(zipPath)) {
			add(
				issues,
				path,
				'CONTENT_TYPE_MISSING_PART',
				`Content type override references "${name}" which does not exist in the archive`,
				'warning',
			);
		}
	}
	const packageNames = new Map<string, string>();
	for (const zipPath of Object.keys(zip.files).filter((entry) => !zip.files[entry].dir)) {
		const key = canonicalPartName(`/${zipPath}`);
		const previous = packageNames.get(key);
		if (previous && previous !== zipPath) {
			add(
				issues,
				zipPath,
				'DUPLICATE_PART_NAME',
				`Package parts "${previous}" and "${zipPath}" have equivalent OPC names`,
			);
		}
		packageNames.set(key, zipPath);
		if (zipPath === path || zipPath.endsWith('.rels') || covered.has(zipPath)) {
			continue;
		}
		const ext = zipPath.split('.').pop()?.toLowerCase();
		if (ext && !extensions.has(ext)) {
			add(
				issues,
				zipPath,
				'UNCOVERED_CONTENT_TYPE',
				`File "${zipPath}" has no content type override or default for ".${ext}"`,
				'info',
			);
		}
	}
}

export async function validateOpcRelationships(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	for (const path of Object.keys(zip.files).filter((entry) => entry.endsWith('.rels'))) {
		const xml = await readZipText(zip, path);
		if (!xml) {
			continue;
		}
		const parsed = tryParseXml(xml, parser);
		if ('error' in parsed) {
			add(
				issues,
				path,
				'MALFORMED_RELS',
				`Relationship file "${path}" is malformed: ${parsed.error}`,
			);
			continue;
		}
		const owner = relationshipsOwner(path);
		if (path !== '_rels/.rels' && (!owner || !zip.file(owner))) {
			add(
				issues,
				path,
				'ORPHAN_RELATIONSHIPS_PART',
				`Relationship part "${path}" has no source part`,
			);
		}
		const root = parsed.data.Relationships as Record<string, unknown> | undefined;
		const entries = ensureArray(
			root?.Relationship as Record<string, unknown> | Record<string, unknown>[],
		);
		const ids = new Set<string>();
		for (const entry of entries) {
			const id = String(entry?.['@_Id'] ?? '');
			const type = String(entry?.['@_Type'] ?? '');
			const target = String(entry?.['@_Target'] ?? '');
			const mode = entry?.['@_TargetMode'];
			if (!/^[A-Za-z_][\w.-]*$/.test(id)) {
				add(
					issues,
					path,
					'INVALID_RELATIONSHIP_ID',
					`Relationship Id "${id}" is not a valid XML ID`,
				);
			}
			if (ids.has(id)) {
				add(
					issues,
					path,
					'DUPLICATE_RELATIONSHIP_ID',
					`Relationship Id "${id}" occurs more than once`,
				);
			}
			ids.add(id);
			if (!type || !target) {
				add(
					issues,
					path,
					'INVALID_RELATIONSHIP',
					`Relationship "${id}" must have non-empty Type and Target attributes`,
				);
			}
			if (mode !== undefined && mode !== 'Internal' && mode !== 'External') {
				add(
					issues,
					path,
					'INVALID_TARGET_MODE',
					`Relationship "${id}" has invalid TargetMode "${String(mode)}"`,
				);
				continue;
			}
			if (mode !== 'External' && isExternalTarget(target)) {
				add(
					issues,
					path,
					'EXTERNAL_TARGET_REQUIRES_MODE',
					`Relationship "${id}" has an external URI without TargetMode="External"`,
				);
				continue;
			}
			if (mode === 'External') {
				continue;
			}
			const targetPath = target.split('#')[0];
			const dir = relsOwnerDir(path);
			if (!targetPath || /[\\?]/.test(targetPath) || targetEscapesRoot(dir, targetPath)) {
				add(
					issues,
					path,
					'INVALID_INTERNAL_TARGET',
					`Relationship "${id}" has invalid internal target "${target}"`,
				);
				continue;
			}
			const resolved = resolveRelTarget(dir, targetPath);
			if (resolved.endsWith('.rels')) {
				add(
					issues,
					path,
					'RELATIONSHIP_TARGETS_RELATIONSHIPS_PART',
					`Relationship "${id}" targets relationship part "${resolved}"`,
				);
			} else if (!zip.file(resolved)) {
				add(
					issues,
					path,
					'DANGLING_RELATIONSHIP',
					`Relationship "${id}" targets "${target}" (resolved: "${resolved}") which does not exist`,
					'warning',
				);
			}
		}
	}
}
