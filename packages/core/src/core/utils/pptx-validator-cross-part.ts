import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import { allNamespaceDeclarations, ECMA_NAMESPACES } from './pptx-validator-conformance-xml';
import { extractRelationships, readZipText, tryParseXml } from './pptx-validator-helpers';
import type { ValidationIssue } from './pptx-validator-types';

function add(issues: ValidationIssue[], code: string, message: string): void {
	issues.push({ severity: 'error', code, message, path: 'ppt/presentation.xml' });
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function referencedIds(xml: string, element: string): Array<string | undefined> {
	const declarations = allNamespaceDeclarations(xml);
	const relPrefixes = [...declarations]
		.filter(([, uri]) => uri === ECMA_NAMESPACES.strictR || uri === ECMA_NAMESPACES.transitionalR)
		.map(([prefix]) => prefix)
		.filter(Boolean);
	const result: Array<string | undefined> = [];
	for (const elementMatch of xml.matchAll(
		new RegExp(`<(?:[\\w.-]+:)?${element}\\b([^>]*)>`, 'g'),
	)) {
		let id: string | undefined;
		for (const prefix of relPrefixes) {
			id = elementMatch[1].match(
				new RegExp(`\\b${escapeRegex(prefix)}:id\\s*=\\s*["']([^"']+)["']`),
			)?.[1];
			if (id) {
				break;
			}
		}
		result.push(id);
	}
	return result;
}

function validateReferences(
	ids: Array<string | undefined>,
	kind: 'slide' | 'slideMaster',
	relationships: Map<string, string>,
	issues: ValidationIssue[],
): void {
	const seen = new Set<string>();
	for (const id of ids) {
		if (!id) {
			add(
				issues,
				'MISSING_PRESENTATION_RELATIONSHIP_ID',
				`Presentation ${kind} entry must have a relationship id`,
			);
			continue;
		}
		if (seen.has(id)) {
			add(
				issues,
				'DUPLICATE_PRESENTATION_RELATIONSHIP_REFERENCE',
				`Presentation ${kind} relationship "${id}" is referenced more than once`,
			);
		}
		seen.add(id);
		const type = relationships.get(id);
		if (!type) {
			add(
				issues,
				'MISSING_PRESENTATION_RELATIONSHIP',
				`Presentation ${kind} relationship "${id}" does not exist`,
			);
		} else if (!type.endsWith(`/relationships/${kind}`)) {
			add(
				issues,
				'INVALID_PRESENTATION_RELATIONSHIP_TYPE',
				`Relationship "${id}" does not have ${kind} relationship type`,
			);
		}
	}
}

export async function validatePresentationRelationships(
	zip: JSZip,
	parser: XMLParser,
	issues: ValidationIssue[],
): Promise<void> {
	const presentation = await readZipText(zip, 'ppt/presentation.xml');
	const relsXml = await readZipText(zip, 'ppt/_rels/presentation.xml.rels');
	if (!presentation) {
		return;
	}
	const relationships = new Map<string, string>();
	if (relsXml) {
		const parsed = tryParseXml(relsXml, parser);
		if (!('error' in parsed)) {
			for (const rel of extractRelationships(parsed.data)) {
				relationships.set(rel.id, rel.type);
			}
		}
	}
	validateReferences(referencedIds(presentation, 'sldId'), 'slide', relationships, issues);
	validateReferences(
		referencedIds(presentation, 'sldMasterId'),
		'slideMaster',
		relationships,
		issues,
	);
}
