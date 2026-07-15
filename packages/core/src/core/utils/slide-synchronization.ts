import type { PptxSlide, PptxSlideSyncProperties, XmlObject } from '../types';

export const SLIDE_SYNC_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.presentationml.slideSyncData+xml';

interface XmlPartStore {
	file(path: string): { async(kind: 'string'): Promise<string> } | null;
	file(path: string, data: string): unknown;
	files?: Record<string, unknown>;
}

interface XmlCodec {
	parse(xml: string): unknown;
}

interface XmlWriter {
	build(value: unknown): string;
}

export async function loadSlideSynchronization(input: {
	zip: XmlPartStore;
	parser: XmlCodec;
	slidePath: string;
	relsPath: string;
}): Promise<PptxSlideSyncProperties | undefined> {
	const relsXml = await input.zip.file(input.relsPath)?.async('string');
	if (!relsXml) {
		return undefined;
	}
	const relsData = input.parser.parse(relsXml) as XmlObject;
	const relationship = findSlideSyncRelationship(relsData);
	if (!relationship) {
		return undefined;
	}
	const target = String(relationship['@_Target'] || '').trim();
	if (!target) {
		return undefined;
	}
	const partPath = resolvePartPath(input.slidePath, target);
	const partXml = await input.zip.file(partPath)?.async('string');
	if (!partXml) {
		return undefined;
	}
	const partData = input.parser.parse(partXml) as XmlObject;
	return parseSlideSynchronization(partData, partPath, String(relationship['@_Id'] || ''));
}

export function parseSlideSynchronization(
	partData: XmlObject,
	partPath?: string,
	relationshipId?: string,
): PptxSlideSyncProperties | undefined {
	const root = partData['p:sldSyncPr'] as XmlObject | undefined;
	if (!root) {
		return undefined;
	}
	return {
		serverSlideId: String(root['@_serverSldId'] || ''),
		serverSlideModifiedTime: String(root['@_serverSldModifiedTime'] || ''),
		clientInsertedTime: String(root['@_clientInsertedTime'] || ''),
		extensionList: root['p:extLst'] as XmlObject | undefined,
		rawXml: root,
		partPath,
		relationshipId: relationshipId || undefined,
	};
}

export async function saveSlideSynchronization(input: {
	zip: XmlPartStore;
	parser: XmlCodec;
	writer: XmlWriter;
	slide: PptxSlide;
	relationships: XmlObject[];
	nextRelationshipId: () => string;
	relationshipType: string;
	contentType?: string;
}): Promise<void> {
	const sync = input.slide.slideSynchronization;
	if (!sync) {
		return;
	}
	let relationship = input.relationships.find(isSlideSyncRelationship);
	const partPath = sync.partPath || nextSlideSyncPath(input.zip.files || {});
	if (!relationship) {
		relationship = {};
		input.relationships.push(relationship);
	}
	const relationshipId =
		sync.relationshipId || String(relationship['@_Id'] || '') || input.nextRelationshipId();
	relationship['@_Id'] = relationshipId;
	relationship['@_Type'] = input.relationshipType;
	relationship['@_Target'] = relativeTarget(input.slide.id, partPath);
	delete relationship['@_TargetMode'];
	input.zip.file(partPath, input.writer.build(buildSlideSynchronization(sync)));
	await ensureSlideSyncContentType(
		input.zip,
		input.parser,
		input.writer,
		partPath,
		input.contentType || SLIDE_SYNC_CONTENT_TYPE,
	);
	sync.partPath = partPath;
	sync.relationshipId = relationshipId;
}

export function buildSlideSynchronization(sync: PptxSlideSyncProperties): XmlObject {
	const root = sync.rawXml ? { ...sync.rawXml } : {};
	root['@_xmlns:p'] ||= 'http://schemas.openxmlformats.org/presentationml/2006/main';
	root['@_serverSldId'] = sync.serverSlideId;
	root['@_serverSldModifiedTime'] = sync.serverSlideModifiedTime;
	root['@_clientInsertedTime'] = sync.clientInsertedTime;
	if (sync.extensionList) {
		root['p:extLst'] = sync.extensionList;
	}
	return { 'p:sldSyncPr': root };
}

function findSlideSyncRelationship(relsData: XmlObject): XmlObject | undefined {
	const root = relsData['Relationships'] as XmlObject | undefined;
	const values = root?.['Relationship'];
	return (Array.isArray(values) ? values : values ? [values] : []).find(isSlideSyncRelationship) as
		| XmlObject
		| undefined;
}

function isSlideSyncRelationship(value: unknown): value is XmlObject {
	return Boolean(
		value &&
		typeof value === 'object' &&
		String((value as XmlObject)['@_Type'] || '').endsWith('/slideSyncData'),
	);
}

async function ensureSlideSyncContentType(
	zip: XmlPartStore,
	parser: XmlCodec,
	writer: XmlWriter,
	partPath: string,
	contentType: string,
): Promise<void> {
	const xml = await zip.file('[Content_Types].xml')?.async('string');
	if (!xml) {
		return;
	}
	const data = parser.parse(xml) as XmlObject;
	const root = (data['Types'] || {}) as XmlObject;
	const values = root['Override'];
	const overrides = (Array.isArray(values) ? values : values ? [values] : []) as XmlObject[];
	const partName = `/${partPath.replace(/^\//u, '')}`;
	const entry = overrides.find((item) => item['@_PartName'] === partName);
	if (entry) {
		entry['@_ContentType'] = contentType;
	} else {
		overrides.push({ '@_PartName': partName, '@_ContentType': contentType });
	}
	root['Override'] = overrides;
	data['Types'] = root;
	zip.file('[Content_Types].xml', writer.build(data));
}

function resolvePartPath(base: string, target: string): string {
	const parts = `${base.slice(0, base.lastIndexOf('/'))}/${target}`.split('/');
	const result: string[] = [];
	for (const part of parts) {
		if (part === '..') {
			result.pop();
		} else if (part !== '.') {
			result.push(part);
		}
	}
	return result.join('/');
}

function relativeTarget(slidePath: string, partPath: string): string {
	const slideDir = slidePath.slice(0, slidePath.lastIndexOf('/')).split('/');
	const part = partPath.split('/');
	while (slideDir[0] === part[0]) {
		slideDir.shift();
		part.shift();
	}
	return `${'../'.repeat(slideDir.length)}${part.join('/')}`;
}

function nextSlideSyncPath(files: Record<string, unknown>): string {
	let index = 1;
	while (files[`ppt/slideSyncData/slideSyncData${index}.xml`]) {
		index++;
	}
	return `ppt/slideSyncData/slideSyncData${index}.xml`;
}
