import type { PptxSmartArtData, XmlObject } from '../types';

/** Typed view of the four required relationship attributes on `dgm:relIds`. */
export interface DiagramRelationshipIds {
	dataRelId?: string;
	layoutRelId?: string;
	styleRelId?: string;
	colorsRelId?: string;
}

const RELATIONSHIP_ATTRIBUTES: ReadonlyArray<
	[keyof DiagramRelationshipIds, 'dm' | 'lo' | 'qs' | 'cs']
> = [
	['dataRelId', 'dm'],
	['layoutRelId', 'lo'],
	['styleRelId', 'qs'],
	['colorsRelId', 'cs'],
];

/**
 * Read `CT_RelIds` without assuming the conventional `dgm` or `r` prefixes.
 * Namespace prefixes are aliases and may legally differ in Strict documents.
 */
export function parseDiagramRelationshipIds(
	graphicData: XmlObject | undefined,
): DiagramRelationshipIds | undefined {
	const relIds = findChild(graphicData, 'relIds');
	if (!relIds) {
		return undefined;
	}
	const result: DiagramRelationshipIds = {};
	for (const [property, localName] of RELATIONSHIP_ATTRIBUTES) {
		const value = readAttribute(relIds, localName);
		if (value) {
			result[property] = value;
		}
	}
	return result;
}

/**
 * Apply edited relationship ids to an existing SmartArt graphic frame.
 * Unspecified ids, unknown attributes, child markup, and extensions are kept.
 */
export function applyDiagramRelationshipIds(
	frame: XmlObject,
	data: Pick<PptxSmartArtData, 'dataRelId' | 'layoutRelId' | 'styleRelId' | 'colorsRelId'>,
): void {
	const graphic = findChild(frame, 'graphic');
	const graphicData = findChild(graphic, 'graphicData');
	const relIds = findChild(graphicData, 'relIds');
	if (!relIds) {
		return;
	}
	for (const [property, localName] of RELATIONSHIP_ATTRIBUTES) {
		const value = data[property];
		if (value === undefined) {
			continue;
		}
		const existingKey = findAttributeKey(relIds, localName);
		relIds[existingKey ?? `@_r:${localName}`] = value;
	}
}

function findChild(parent: XmlObject | undefined, localName: string): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	const key = Object.keys(parent).find(
		(candidate) => !candidate.startsWith('@_') && xmlLocalName(candidate) === localName,
	);
	const value = key ? parent[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function readAttribute(node: XmlObject, localName: string): string | undefined {
	const key = findAttributeKey(node, localName);
	return key ? String(node[key] ?? '').trim() || undefined : undefined;
}

function findAttributeKey(node: XmlObject, localName: string): string | undefined {
	return Object.keys(node).find(
		(candidate) => candidate.startsWith('@_') && xmlLocalName(candidate.slice(2)) === localName,
	);
}

function xmlLocalName(qualifiedName: string): string {
	return qualifiedName.slice(qualifiedName.lastIndexOf(':') + 1);
}
