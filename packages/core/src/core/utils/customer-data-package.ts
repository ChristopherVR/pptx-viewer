import type JSZip from 'jszip';

import type { PptxCustomerData, XmlObject } from '../types';
import { safeResolveZipPath } from './safe-path';

export const CUSTOM_XML_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
const DEFAULT_CONTENT_TYPE = 'application/xml';

interface XmlCodec {
	parse(xml: string): XmlObject;
	build(data: XmlObject): string;
}

export interface CustomerDataScope {
	sourcePartPath: string;
	location: 'presentation' | 'slide';
	entries: PptxCustomerData[];
}

export async function writeCustomerDataScopes(
	zip: JSZip,
	scopes: CustomerDataScope[],
	codec: XmlCodec,
): Promise<void> {
	let nextIndex = maxCustomXmlIndex(zip) + 1;
	const contentTypes = new Map<string, string>();
	for (const scope of scopes) {
		const sourceXml = await zip.file(scope.sourcePartPath)?.async('string');
		if (!sourceXml) {
			continue;
		}
		const sourceData = codec.parse(sourceXml);
		const container = getContainer(sourceData, scope.location);
		if (!container) {
			continue;
		}
		const relsPath = relsForSourcePart(scope.sourcePartPath);
		const relsXml = await zip.file(relsPath)?.async('string');
		const relsData = relsXml
			? codec.parse(relsXml)
			: {
					Relationships: {
						'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
					},
				};
		const relsRoot = (relsData['Relationships'] ??= {}) as XmlObject;
		const relationships = ensureArray(relsRoot['Relationship']);
		const authoredEntries: XmlObject[] = [];
		for (const entry of scope.entries) {
			const suppliedPath = entry.id ? safeResolveZipPath('', entry.id) : null;
			const path = suppliedPath || `customXml/item${nextIndex++}.xml`;
			if (entry.data === undefined && !zip.file(path)) {
				continue;
			}
			entry.id = path;
			entry.contentType ??= DEFAULT_CONTENT_TYPE;
			if (entry.data !== undefined) {
				zip.file(path, entry.data);
			}
			const relationship = upsertRelationship(
				relationships,
				entry,
				relativeTarget(scope.sourcePartPath, path),
			);
			entry.relId = String(relationship['@_Id']);
			const rawEntry = { ...(entry.rawXml ?? {}), '@_r:id': entry.relId };
			entry.rawXml = rawEntry;
			authoredEntries.push(rawEntry);
			contentTypes.set(path, entry.contentType);
		}
		const existingList = (container['p:custDataLst'] as XmlObject | undefined) ?? {};
		existingList['p:custData'] = authoredEntries;
		placeCustomerDataList(container, existingList, scope.location);
		relsRoot['Relationship'] = relationships;
		zip.file(relsPath, codec.build(relsData));
		zip.file(scope.sourcePartPath, codec.build(sourceData));
	}
	await upsertContentTypes(zip, codec, contentTypes);
}

export async function resolveContentType(
	zip: JSZip,
	codec: Pick<XmlCodec, 'parse'>,
	path: string,
): Promise<string | undefined> {
	const xml = await zip.file('[Content_Types].xml')?.async('string');
	if (!xml) {
		return undefined;
	}
	const root = codec.parse(xml)['Types'] as XmlObject | undefined;
	const override = ensureArray(root?.['Override']).find(
		(entry) => entry['@_PartName'] === `/${path}`,
	);
	if (override?.['@_ContentType']) {
		return String(override['@_ContentType']);
	}
	const extension = path.split('.').pop()?.toLowerCase();
	const fallback = ensureArray(root?.['Default']).find(
		(entry) => String(entry['@_Extension'] ?? '').toLowerCase() === extension,
	);
	return fallback?.['@_ContentType'] ? String(fallback['@_ContentType']) : undefined;
}

function getContainer(
	data: XmlObject,
	location: CustomerDataScope['location'],
): XmlObject | undefined {
	if (location === 'presentation') {
		return data['p:presentation'] as XmlObject | undefined;
	}
	const slide = data['p:sld'] as XmlObject | undefined;
	return slide?.['p:cSld'] as XmlObject | undefined;
}

function upsertRelationship(
	relationships: XmlObject[],
	entry: PptxCustomerData,
	target: string,
): XmlObject {
	let relationship = relationships.find(
		(item) => String(item['@_Id'] ?? '') === entry.relId && isCustomXmlRelationship(item['@_Type']),
	);
	if (!relationship) {
		entry.relId = nextRelationshipId(relationships);
		relationship = {};
		relationships.push(relationship);
	}
	relationship['@_Id'] = entry.relId!;
	relationship['@_Type'] = CUSTOM_XML_RELATIONSHIP_TYPE;
	relationship['@_Target'] = target;
	delete relationship['@_TargetMode'];
	return relationship;
}

function isCustomXmlRelationship(value: unknown): boolean {
	return String(value ?? '').endsWith('/relationships/customXml');
}

function placeCustomerDataList(
	container: XmlObject,
	list: XmlObject,
	location: CustomerDataScope['location'],
): void {
	const insertBefore =
		location === 'presentation'
			? new Set(['p:kinsoku', 'p:defaultTextStyle', 'p:modifyVerifier', 'p:extLst'])
			: new Set(['p:controls', 'p:extLst']);
	const rebuilt: XmlObject = {};
	let inserted = false;
	for (const [key, value] of Object.entries(container)) {
		if (key === 'p:custDataLst') {
			continue;
		}
		if (!inserted && insertBefore.has(key)) {
			rebuilt['p:custDataLst'] = list;
			inserted = true;
		}
		rebuilt[key] = value;
	}
	if (!inserted) {
		rebuilt['p:custDataLst'] = list;
	}
	for (const key of Object.keys(container)) {
		delete container[key];
	}
	Object.assign(container, rebuilt);
}

async function upsertContentTypes(
	zip: JSZip,
	codec: XmlCodec,
	contentTypes: Map<string, string>,
): Promise<void> {
	const xml = await zip.file('[Content_Types].xml')?.async('string');
	if (!xml || contentTypes.size === 0) {
		return;
	}
	const data = codec.parse(xml);
	const root = data['Types'] as XmlObject;
	const overrides = ensureArray(root['Override']);
	for (const [path, contentType] of contentTypes) {
		const partName = `/${path}`;
		const existing = overrides.find((entry) => entry['@_PartName'] === partName);
		if (existing) {
			existing['@_ContentType'] = contentType;
		} else {
			overrides.push({ '@_PartName': partName, '@_ContentType': contentType });
		}
	}
	root['Override'] = overrides;
	zip.file('[Content_Types].xml', codec.build(data));
}

function relsForSourcePart(source: string): string {
	const slash = source.lastIndexOf('/');
	return `${source.slice(0, slash)}/_rels/${source.slice(slash + 1)}.rels`;
}

function relativeTarget(source: string, target: string): string {
	const from = source.split('/').slice(0, -1);
	const to = target.split('/');
	while (from.length > 0 && to.length > 0 && from[0] === to[0]) {
		from.shift();
		to.shift();
	}
	return [...from.map(() => '..'), ...to].join('/');
}

function nextRelationshipId(relationships: XmlObject[]): string {
	const used = new Set(relationships.map((entry) => String(entry['@_Id'] ?? '')));
	let index = 1;
	while (used.has(`rId${index}`)) {
		index += 1;
	}
	return `rId${index}`;
}

function maxCustomXmlIndex(zip: JSZip): number {
	return zip
		.file(/^customXml\/item\d+\.xml$/u)
		.reduce((max, file) => Math.max(max, Number(file.name.match(/item(\d+)\.xml$/u)?.[1] ?? 0)), 0);
}

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as XmlObject[];
}
