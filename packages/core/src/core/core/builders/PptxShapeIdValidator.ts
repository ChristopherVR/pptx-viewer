import type { XmlObject } from '../../types';

/**
 * Shape ID uniqueness validator for OOXML slide shape trees.
 *
 * OpenXML requires that every `p:cNvPr/@id` within a single slide's
 * `p:spTree` is unique. Duplicate IDs can corrupt files in MS Office.
 * This validator scans the tree and reassigns duplicate IDs.
 */

/** Recursively collect all cNvPr nodes from a shape tree. */
function collectCnvPrNodes(
	node: XmlObject,
	results: XmlObject[],
	ensureArray: (value: unknown) => unknown[],
): void {
	// Check direct cNvPr references in nvSpPr, nvPicPr, nvCxnSpPr, nvGrpSpPr, nvGraphicFramePr
	const nvContainers = [
		'p:nvSpPr',
		'p:nvPicPr',
		'p:nvCxnSpPr',
		'p:nvGrpSpPr',
		'p:nvGraphicFramePr',
	];
	for (const nvKey of nvContainers) {
		const nvNode = node[nvKey] as XmlObject | undefined;
		if (nvNode?.['p:cNvPr']) {
			results.push(nvNode['p:cNvPr'] as XmlObject);
		}
	}

	// Recurse into shape lists
	const shapeLists = ['p:sp', 'p:pic', 'p:cxnSp', 'p:graphicFrame', 'p:grpSp'];
	for (const listKey of shapeLists) {
		const children = ensureArray(node[listKey]) as XmlObject[];
		for (const child of children) {
			collectCnvPrNodes(child, results, ensureArray);
		}
	}
}

export interface IPptxShapeIdValidator {
	validateAndDeduplicateIds(
		spTree: XmlObject,
		ensureArray: (value: unknown) => unknown[],
	): number;
}

/**
 * Validates shape IDs in a slide's spTree and reassigns duplicates.
 * Returns the number of IDs that were reassigned.
 */
export class PptxShapeIdValidator implements IPptxShapeIdValidator {
	public validateAndDeduplicateIds(
		spTree: XmlObject,
		ensureArray: (value: unknown) => unknown[],
	): number {
		const cNvPrNodes: XmlObject[] = [];
		collectCnvPrNodes(spTree, cNvPrNodes, ensureArray);

		if (cNvPrNodes.length === 0) return 0;

		// Collect all used IDs and find duplicates
		const usedIds = new Set<number>();
		const duplicates: XmlObject[] = [];
		let maxId = 0;

		for (const cNvPr of cNvPrNodes) {
			const idRaw = Number.parseInt(String(cNvPr['@_id'] ?? '0'), 10);
			const id = Number.isFinite(idRaw) ? idRaw : 0;
			if (id > maxId) maxId = id;

			if (id === 0 || usedIds.has(id)) {
				duplicates.push(cNvPr);
			} else {
				usedIds.add(id);
			}
		}

		// Reassign duplicate IDs
		let reassigned = 0;
		for (const cNvPr of duplicates) {
			maxId += 1;
			cNvPr['@_id'] = String(maxId);
			usedIds.add(maxId);
			reassigned += 1;
		}

		return reassigned;
	}
}
