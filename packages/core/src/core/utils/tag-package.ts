import type JSZip from 'jszip';

import type { PptxTagCollection, XmlObject } from '../types';
import { safeResolveZipPath } from './safe-path';

const TAG_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const TAG_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml';

interface XmlCodec {
	parse(xml: string): XmlObject;
	build(data: XmlObject): string;
}

export async function discoverTagCollections(
	zip: JSZip,
	codec: Pick<XmlCodec, 'parse'>,
): Promise<PptxTagCollection[]> {
	const results: PptxTagCollection[] = [];
	const claimedPaths = new Set<string>();
	for (const relFile of zip.file(/\.rels$/u)) {
		const sourcePartPath = sourcePartForRels(relFile.name);
		if (!sourcePartPath) {
			continue;
		}
		const data = codec.parse(await relFile.async('string'));
		const root = data['Relationships'] as XmlObject | undefined;
		for (const relationship of ensureArray(root?.['Relationship'])) {
			if (String(relationship['@_Type'] ?? '') !== TAG_RELATIONSHIP_TYPE) {
				continue;
			}
			const base = sourcePartPath.slice(0, sourcePartPath.lastIndexOf('/'));
			const path = safeResolveZipPath(base, String(relationship['@_Target'] ?? ''));
			if (!path || claimedPaths.has(path)) {
				continue;
			}
			const collection = await readTagCollection(zip, codec, path);
			if (collection) {
				collection.owner = ownerForSource(sourcePartPath);
				collection.sourcePartPath = sourcePartPath;
				collection.relationshipId = String(relationship['@_Id'] ?? '') || undefined;
				results.push(collection);
				claimedPaths.add(path);
			}
		}
	}
	for (const file of zip.file(/^ppt\/tags\/tag\d+\.xml$/u)) {
		if (claimedPaths.has(file.name)) {
			continue;
		}
		const collection = await readTagCollection(zip, codec, file.name);
		if (collection) {
			collection.owner = 'part';
			results.push(collection);
		}
	}
	return results;
}

export async function writeTagCollections(
	zip: JSZip,
	collections: PptxTagCollection[],
	codec: XmlCodec,
): Promise<void> {
	let nextIndex = maxTagIndex(zip) + 1;
	const writtenPaths = new Set<string>();
	for (const collection of collections) {
		if (collection.tags.length === 0) {
			continue;
		}
		collection.path ??= `ppt/tags/tag${nextIndex++}.xml`;
		collection.owner ??= 'presentation';
		collection.sourcePartPath ??= sourceForOwner(collection.owner);
		if (!collection.sourcePartPath) {
			continue;
		}
		const root = ((collection.rawXml?.['p:tagLst'] as XmlObject | undefined) ?? {}) as XmlObject;
		root['@_xmlns:a'] ??= 'http://schemas.openxmlformats.org/drawingml/2006/main';
		root['@_xmlns:p'] ??= 'http://schemas.openxmlformats.org/presentationml/2006/main';
		root['@_xmlns:r'] ??= 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
		root['p:tag'] = collection.tags.map((tag) => ({
			'@_name': tag.name,
			'@_val': tag.value,
		}));
		collection.rawXml = { ...(collection.rawXml ?? {}), 'p:tagLst': root };
		zip.file(collection.path, codec.build(collection.rawXml));
		await upsertTagRelationship(zip, codec, collection);
		writtenPaths.add(collection.path);
	}
	await upsertTagContentTypes(zip, codec, writtenPaths);
}

async function readTagCollection(
	zip: JSZip,
	codec: Pick<XmlCodec, 'parse'>,
	path: string,
): Promise<PptxTagCollection | undefined> {
	const xml = await zip.file(path)?.async('string');
	if (!xml) {
		return undefined;
	}
	const rawXml = codec.parse(xml);
	const root = rawXml['p:tagLst'] as XmlObject | undefined;
	if (!root) {
		return undefined;
	}
	const tags = ensureArray(root['p:tag'])
		.map((tag) => ({
			name: String(tag['@_name'] ?? '').trim(),
			value: String(tag['@_val'] ?? '').trim(),
		}))
		.filter((tag) => tag.name.length > 0);
	return { path, tags, rawXml };
}

async function upsertTagRelationship(
	zip: JSZip,
	codec: XmlCodec,
	collection: PptxTagCollection,
): Promise<void> {
	const source = collection.sourcePartPath!;
	const relsPath = relsForSourcePart(source);
	const existingXml = await zip.file(relsPath)?.async('string');
	const data = existingXml
		? codec.parse(existingXml)
		: {
				Relationships: {
					'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
				},
			};
	const root = (data['Relationships'] ??= {}) as XmlObject;
	const relationships = ensureArray(root['Relationship']);
	let relationship = relationships.find(
		(entry) =>
			String(entry['@_Id'] ?? '') === collection.relationshipId &&
			String(entry['@_Type'] ?? '') === TAG_RELATIONSHIP_TYPE,
	);
	if (!relationship) {
		collection.relationshipId = nextRelationshipId(relationships);
		relationship = {};
		relationships.push(relationship);
	}
	relationship['@_Id'] = collection.relationshipId!;
	relationship['@_Type'] = TAG_RELATIONSHIP_TYPE;
	relationship['@_Target'] = relativeTarget(source, collection.path!);
	root['Relationship'] = relationships;
	zip.file(relsPath, codec.build(data));
}

async function upsertTagContentTypes(
	zip: JSZip,
	codec: XmlCodec,
	paths: Set<string>,
): Promise<void> {
	const xml = await zip.file('[Content_Types].xml')?.async('string');
	if (!xml || paths.size === 0) {
		return;
	}
	const data = codec.parse(xml);
	const root = data['Types'] as XmlObject;
	const overrides = ensureArray(root['Override']);
	for (const path of paths) {
		const partName = `/${path}`;
		const existing = overrides.find((entry) => entry['@_PartName'] === partName);
		if (existing) {
			existing['@_ContentType'] = TAG_CONTENT_TYPE;
		} else {
			overrides.push({ '@_PartName': partName, '@_ContentType': TAG_CONTENT_TYPE });
		}
	}
	root['Override'] = overrides;
	zip.file('[Content_Types].xml', codec.build(data));
}

function sourcePartForRels(relsPath: string): string | undefined {
	const match = relsPath.match(/^(?<dir>.*)\/_rels\/(?<file>[^/]+)\.rels$/u);
	return match?.groups ? `${match.groups.dir}/${match.groups.file}` : undefined;
}

function relsForSourcePart(source: string): string {
	const slash = source.lastIndexOf('/');
	return `${source.slice(0, slash)}/_rels/${source.slice(slash + 1)}.rels`;
}

function ownerForSource(source: string): 'presentation' | 'slide' | 'part' {
	if (source === 'ppt/presentation.xml') {
		return 'presentation';
	}
	if (/^ppt\/slides\/slide\d+\.xml$/u.test(source)) {
		return 'slide';
	}
	return 'part';
}

function sourceForOwner(owner: PptxTagCollection['owner']): string | undefined {
	return owner === 'presentation' ? 'ppt/presentation.xml' : undefined;
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

function maxTagIndex(zip: JSZip): number {
	return zip
		.file(/^ppt\/tags\/tag\d+\.xml$/u)
		.reduce((max, file) => Math.max(max, Number(file.name.match(/tag(\d+)\.xml$/u)?.[1] ?? 0)), 0);
}

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as XmlObject[];
}
