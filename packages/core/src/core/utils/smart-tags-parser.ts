/**
 * Parser for the legacy Office "Smart Tags" recognizer reference,
 * `p:smartTags` (CT_SmartTags, ECMA-376 Part 1, S19.2.1.42): a bare
 * `@r:id` child of `p:presentation`, unrelated to the user-authored `p:tags`
 * construct this library fully authors (see `presentation-collections.ts`).
 *
 * This module only PARSES the reference for round-trip inspection. There is
 * no data model for recognizer part content, so nothing here creates, edits,
 * or removes one; preservation of the element, its relationship, and the
 * target part is handled passively by the rest of the save pipeline, which
 * mutates the loaded `presentation.xml` object (and `presentation.xml.rels`)
 * in place instead of rebuilding either from scratch.
 *
 * @module smart-tags-parser
 */
import type JSZip from 'jszip';

import type { PptxSmartTagsReference, XmlObject } from '../types';
import { safeResolveZipPath } from './safe-path';

function ensureArray(val: unknown): XmlObject[] {
	if (val === undefined || val === null) {
		return [];
	}
	return Array.isArray(val) ? val : [val as XmlObject];
}

/**
 * Parse `p:presentation/p:smartTags` and resolve its relationship target,
 * when possible, against `ppt/_rels/presentation.xml.rels`.
 *
 * Returns `undefined` when the presentation carries no `p:smartTags`
 * element at all.
 */
export async function parsePresentationSmartTags(
	zip: JSZip,
	parseXml: (xml: string) => XmlObject,
	presentationData: XmlObject | null | undefined,
): Promise<PptxSmartTagsReference | undefined> {
	try {
		const presentation = presentationData?.['p:presentation'] as XmlObject | undefined;
		const smartTagsNode = presentation?.['p:smartTags'] as XmlObject | undefined;
		if (!smartTagsNode) {
			return undefined;
		}

		const relId = String(smartTagsNode['@_r:id'] ?? '').trim();
		const result: PptxSmartTagsReference = { relId, rawXml: smartTagsNode };
		if (!relId) {
			return result;
		}

		const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
		if (!relsFile) {
			return result;
		}

		const relsXml = await relsFile.async('string');
		const relsData = parseXml(relsXml);
		const relRoot = (relsData['Relationships'] || {}) as XmlObject;
		const relationships = ensureArray(relRoot['Relationship']);

		for (const rel of relationships) {
			if (String(rel['@_Id'] ?? '').trim() !== relId) {
				continue;
			}
			const target = String(rel['@_Target'] ?? '').trim();
			if (target.length > 0) {
				const resolved = safeResolveZipPath('ppt', target);
				if (resolved) {
					result.targetPath = resolved;
				}
			}
			break;
		}

		return result;
	} catch (e) {
		console.warn('Failed to parse presentation smart tags:', e);
		return undefined;
	}
}
