/**
 * Loader for referenced legacy VML drawing parts.
 *
 * Older PPTX slides link a VML drawing part (`ppt/drawings/vmlDrawing*.vml`)
 * through a relationship of type `.../vmlDrawing` (a `legacyDrawing`
 * reference). The inline sp-tree VML parser never sees these separate parts,
 * so their shapes went entirely unrendered. This module resolves the
 * relationship, loads the referenced `.vml` part, and parses its shapes into
 * {@link PptxElement}s for read-only rendering. The `.vml` part is preserved
 * verbatim on save, so nothing here feeds the save pipeline.
 *
 * @module vml-drawing-loader
 */
import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import type { PptxElement, XmlObject } from '../types';
import { safeResolveZipPath } from './safe-path';
import { parseVmlElements } from './vml-parser';

/** Relationship-type suffix identifying a legacy VML drawing part. */
const VML_DRAWING_REL_SUFFIX = '/relationships/vmlDrawing';

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
}

/**
 * Resolve and parse every legacy VML drawing part referenced by a slide.
 *
 * @param zip - The opened .pptx archive.
 * @param parser - XML parser used for the .rels and .vml parts.
 * @param slidePath - The owning slide part path (for relative target resolution).
 * @param relsPath - Path to the slide's `.rels` file.
 * @returns Parsed VML shapes, or an empty array when there are none.
 */
export async function loadLegacyVmlDrawings(
	zip: JSZip,
	parser: XMLParser,
	slidePath: string,
	relsPath: string,
): Promise<PptxElement[]> {
	try {
		const relsXml = await zip.file(relsPath)?.async('string');
		if (!relsXml) {
			return [];
		}

		const relsData = parser.parse(relsXml) as XmlObject;
		const relationships = ensureArray(
			(relsData['Relationships'] as XmlObject | undefined)?.['Relationship'],
		);

		const base = slidePath.slice(0, slidePath.lastIndexOf('/'));
		const results: PptxElement[] = [];
		let drawingIndex = 0;

		for (const rel of relationships) {
			const type = String(rel['@_Type'] ?? '').trim();
			if (!type.endsWith(VML_DRAWING_REL_SUFFIX)) {
				continue;
			}
			const target = String(rel['@_Target'] ?? '').trim();
			if (target.length === 0) {
				continue;
			}
			// External VML targets cannot be read from the package.
			if (String(rel['@_TargetMode'] ?? '').toLowerCase() === 'external') {
				continue;
			}

			const resolved = safeResolveZipPath(base, target);
			if (!resolved) {
				continue;
			}

			const vmlXml = await zip.file(resolved)?.async('string');
			if (!vmlXml) {
				continue;
			}

			const parsed = parser.parse(vmlXml) as XmlObject;
			// VML drawing parts wrap their shapes in an `<xml>` Office container;
			// tolerate both wrapped and bare roots.
			const container = (parsed['xml'] as XmlObject | undefined) ?? parsed;
			const shapes = parseVmlElements(container, `vml-${drawingIndex}-`);
			results.push(...shapes);
			drawingIndex++;
		}

		return results;
	} catch (e) {
		console.warn(`Failed to load legacy VML drawings for ${slidePath}:`, e);
		return [];
	}
}
