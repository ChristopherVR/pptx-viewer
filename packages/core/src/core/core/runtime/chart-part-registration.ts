/**
 * Package-level bookkeeping for a chart part written during save: free part
 * paths, `[Content_Types].xml` overrides, the slide relationship and the
 * `a:graphicData` envelope that binds a graphic frame to the part.
 *
 * @module runtime/chart-part-registration
 */

import type JSZip from 'jszip';

import type { XmlObject } from '../../types';

type GetLocalName = (key: string) => string;

export interface ChartPartRegistrationDeps {
	zip: JSZip;
	parser: { parse(xml: string): unknown };
	builder: { build(tree: unknown): string };
	getLocalName: GetLocalName;
}

const CHART_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const CHART_EX_GRAPHIC_DATA_URI = 'http://schemas.microsoft.com/office/drawing/2014/chartex';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function asArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]).filter(
		(entry): entry is XmlObject => Boolean(entry) && typeof entry === 'object',
	);
}

/** Pick the next free `<directory>/chartN.xml` path in the package. */
export function nextFreeChartPartPath(zip: JSZip, directory: string): string {
	let n = 1;
	while (zip.file(`${directory}/chart${n}.xml`)) {
		n += 1;
	}
	return `${directory}/chart${n}.xml`;
}

/** Resolve a relationship `Target` against the directory of `fromPart`. */
export function resolvePartTarget(fromPart: string, target: string): string {
	if (target.startsWith('/')) {
		return target.slice(1);
	}
	const segments = fromPart.split('/').slice(0, -1);
	for (const segment of target.split('/')) {
		if (segment === '..') {
			segments.pop();
		} else if (segment !== '.' && segment !== '') {
			segments.push(segment);
		}
	}
	return segments.join('/');
}

/** The relative `Target` that reaches `toPart` from the directory of `fromPart`. */
export function relativePartTarget(fromPart: string, toPart: string): string {
	const from = fromPart.split('/').slice(0, -1);
	const to = toPart.split('/');
	let common = 0;
	while (common < from.length && common < to.length - 1 && from[common] === to[common]) {
		common += 1;
	}
	return [...from.slice(common).map(() => '..'), ...to.slice(common)].join('/');
}

/** Add an `Override` for `partPath` to `[Content_Types].xml` (no-op if present). */
export async function ensureContentTypeOverride(
	deps: ChartPartRegistrationDeps,
	partPath: string,
	contentType: string,
): Promise<void> {
	const xml = await deps.zip.file('[Content_Types].xml')?.async('string');
	if (!xml) {
		return;
	}
	const tree = deps.parser.parse(xml) as XmlObject;
	const types = (tree['Types'] ?? {}) as XmlObject;
	const overrides = asArray(types['Override']);
	const partName = `/${partPath}`;
	if (overrides.some((entry) => String(entry['@_PartName']) === partName)) {
		return;
	}
	overrides.push({ '@_PartName': partName, '@_ContentType': contentType });
	types['Override'] = overrides;
	tree['Types'] = types;
	deps.zip.file('[Content_Types].xml', deps.builder.build(tree));
}

export interface ChartRelationshipRewrite {
	relationshipId: string | undefined;
	oldPartPath: string;
	newPartPath: string;
	relationshipType: string;
}

/**
 * Re-point the slide relationship that reaches `oldPartPath` (matched by id
 * when known, else by target) at `newPartPath` with `relationshipType`.
 * Returns the relationship id, or `undefined` when no relationship matched.
 */
export async function rewriteChartRelationship(
	deps: ChartPartRegistrationDeps,
	slidePath: string,
	rewrite: ChartRelationshipRewrite,
): Promise<string | undefined> {
	const slash = slidePath.lastIndexOf('/');
	const relsPath = `${slidePath.slice(0, slash + 1)}_rels/${slidePath.slice(slash + 1)}.rels`;
	const xml = await deps.zip.file(relsPath)?.async('string');
	if (!xml) {
		return undefined;
	}
	const tree = deps.parser.parse(xml) as XmlObject;
	const root = tree['Relationships'] as XmlObject | undefined;
	const relationships = asArray(root?.['Relationship']);
	const match =
		relationships.find((rel) => String(rel['@_Id']) === rewrite.relationshipId) ??
		relationships.find(
			(rel) => resolvePartTarget(slidePath, String(rel['@_Target'] ?? '')) === rewrite.oldPartPath,
		);
	if (!match || !root) {
		return undefined;
	}
	match['@_Type'] = rewrite.relationshipType;
	match['@_Target'] = relativePartTarget(slidePath, rewrite.newPartPath);
	delete match['@_TargetMode'];
	root['Relationship'] = relationships.length === 1 ? relationships[0] : relationships;
	deps.zip.file(relsPath, deps.builder.build(tree));
	return String(match['@_Id']);
}

/** Replace the contents of a chart `a:graphicData` node with the family's envelope. */
function rebindGraphicData(node: XmlObject, relationshipId: string, extended: boolean): void {
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	node['@_uri'] = extended ? CHART_EX_GRAPHIC_DATA_URI : CHART_GRAPHIC_DATA_URI;
	if (extended) {
		node['cx:chart'] = {
			'@_xmlns:cx': CHART_EX_GRAPHIC_DATA_URI,
			'@_xmlns:r': NS_R,
			'@_r:id': relationshipId,
		};
	} else {
		node['c:chart'] = {
			'@_xmlns:c': CHART_GRAPHIC_DATA_URI,
			'@_xmlns:r': NS_R,
			'@_r:id': relationshipId,
		};
	}
}

function visitGraphicData(
	node: unknown,
	relationshipId: string,
	extended: boolean,
	getLocalName: GetLocalName,
): number {
	if (!node || typeof node !== 'object') {
		return 0;
	}
	if (Array.isArray(node)) {
		return node.reduce<number>(
			(count, entry) => count + visitGraphicData(entry, relationshipId, extended, getLocalName),
			0,
		);
	}
	const object = node as XmlObject;
	let count = 0;
	for (const key of Object.keys(object)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const value = object[key];
		if (getLocalName(key) === 'graphicData' && value && typeof value === 'object') {
			for (const candidate of asArray(value)) {
				const chartKey = Object.keys(candidate).find((k) => getLocalName(k) === 'chart');
				const chart = chartKey ? (candidate[chartKey] as XmlObject | undefined) : undefined;
				if (chart && String(chart['@_r:id']) === relationshipId) {
					rebindGraphicData(candidate, relationshipId, extended);
					count += 1;
				}
			}
			continue;
		}
		count += visitGraphicData(value, relationshipId, extended, getLocalName);
	}
	return count;
}

/**
 * Rewrite every graphic frame on `slidePath` that references
 * `relationshipId` so its `a:graphicData` carries the URI and payload
 * element of the target family. Returns how many frames were rebound.
 */
export async function rewriteChartGraphicFrames(
	deps: ChartPartRegistrationDeps,
	slidePath: string,
	relationshipId: string,
	extended: boolean,
): Promise<number> {
	const xml = await deps.zip.file(slidePath)?.async('string');
	if (!xml) {
		return 0;
	}
	const tree = deps.parser.parse(xml) as XmlObject;
	const count = visitGraphicData(tree, relationshipId, extended, deps.getLocalName);
	if (count > 0) {
		deps.zip.file(slidePath, deps.builder.build(tree));
	}
	return count;
}
