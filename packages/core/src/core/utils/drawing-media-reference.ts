import type {
	MediaPptxElement,
	PptxAudioCdPosition,
	PptxMediaReferenceKind,
	XmlObject,
} from '../types';

const MEDIA_REFERENCE_NAMES: readonly PptxMediaReferenceKind[] = [
	'audioCd',
	'wavAudioFile',
	'audioFile',
	'videoFile',
	'quickTimeFile',
];

export interface ParsedDrawingMediaReference {
	kind: PptxMediaReferenceKind;
	mediaType: 'audio' | 'video';
	relationshipId?: string;
	isLinked?: boolean;
	name?: string;
	contentType?: string;
	audioCdStart?: PptxAudioCdPosition;
	audioCdEnd?: PptxAudioCdPosition;
	rawXml: XmlObject;
}

export function parseDrawingMediaReference(
	container: XmlObject | undefined,
	externalRelIds?: ReadonlySet<string>,
): ParsedDrawingMediaReference | undefined {
	if (!container) {
		return undefined;
	}
	for (const kind of MEDIA_REFERENCE_NAMES) {
		const node = child(container, kind);
		if (!node) {
			continue;
		}
		const linkId = String(attribute(node, 'link') ?? '').trim() || undefined;
		const embedId = String(attribute(node, 'embed') ?? '').trim() || undefined;
		return {
			kind,
			mediaType: kind === 'videoFile' || kind === 'quickTimeFile' ? 'video' : 'audio',
			relationshipId: linkId ?? embedId,
			// Embedded media legitimately uses r:link pointing at an INTERNAL
			// media part, so link presence alone does not imply a linked clip.
			// It is only truly linked when the referenced relationship is
			// external (TargetMode="External"), mirroring the OLE parser.
			isLinked: linkId !== undefined && externalRelIds?.has(linkId) === true,
			name:
				kind === 'wavAudioFile' ? String(attribute(node, 'name') ?? '') || undefined : undefined,
			contentType:
				kind === 'audioFile'
					? String(attribute(node, 'contentType') ?? '') || undefined
					: undefined,
			audioCdStart: kind === 'audioCd' ? parseAudioCdPosition(child(node, 'st')) : undefined,
			audioCdEnd: kind === 'audioCd' ? parseAudioCdPosition(child(node, 'end')) : undefined,
			rawXml: node,
		};
	}
	return undefined;
}

export function applyDrawingMediaReference(
	container: XmlObject,
	element: MediaPptxElement,
	relationshipId?: string,
): void {
	const kind = element.mediaReferenceKind;
	if (!kind) {
		return;
	}
	const targetKey = Object.keys(container).find((key) => localName(key) === kind);
	for (const key of Object.keys(container)) {
		if (MEDIA_REFERENCE_NAMES.includes(localName(key) as PptxMediaReferenceKind)) {
			delete container[key];
		}
	}
	const original = element.rawMediaReferenceXml ? { ...element.rawMediaReferenceXml } : {};
	if (kind === 'audioCd') {
		deleteAttribute(original, 'link');
		deleteAttribute(original, 'embed');
		const extKey = Object.keys(original).find((key) => localName(key) === 'extLst');
		const extension = extKey ? original[extKey] : undefined;
		if (extKey) {
			delete original[extKey];
		}
		setChild(original, 'st', buildAudioCdPosition(element.audioCdStart));
		setChild(original, 'end', buildAudioCdPosition(element.audioCdEnd));
		if (extKey) {
			original[extKey] = extension;
		}
		container[targetKey ?? 'a:audioCd'] = original;
		return;
	}
	if (kind === 'wavAudioFile') {
		deleteAttribute(original, 'link');
		if (relationshipId) {
			setAttribute(original, 'embed', relationshipId, 'r');
		}
		if (element.mediaReferenceName !== undefined) {
			setAttribute(original, 'name', element.mediaReferenceName);
		}
	} else {
		deleteAttribute(original, 'embed');
		if (relationshipId) {
			setAttribute(original, 'link', relationshipId, 'r');
		}
		if (kind === 'audioFile' && element.mediaReferenceContentType !== undefined) {
			setAttribute(original, 'contentType', element.mediaReferenceContentType);
		}
	}
	container[targetKey ?? `a:${kind}`] = original;
}

function parseAudioCdPosition(value: unknown): PptxAudioCdPosition | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const node = value as XmlObject;
	const track = unsignedInteger(attribute(node, 'track'), 255);
	if (track === undefined) {
		return undefined;
	}
	const rawTime = attribute(node, 'time');
	const time = rawTime === undefined ? 0 : unsignedInteger(rawTime, 4294967295);
	if (time === undefined) {
		return undefined;
	}
	return { track, time, rawXml: node };
}

function buildAudioCdPosition(value: PptxAudioCdPosition | undefined): XmlObject {
	const node: XmlObject = { ...(value?.rawXml ?? {}) };
	const track = unsignedInteger(value?.track, 255) ?? 1;
	const time = unsignedInteger(value?.time ?? 0, 4294967295) ?? 0;
	if (unsignedInteger(attribute(node, 'track'), 255) !== track) {
		setAttribute(node, 'track', String(track));
	}
	if (attribute(node, 'time') !== undefined || time !== 0) {
		setAttribute(node, 'time', String(time));
	}
	return node;
}

const localName = (key: string): string => key.replace(/^@_/u, '').split(':').at(-1) ?? key;

function child(parent: XmlObject, name: string): XmlObject | undefined {
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	const value = key ? parent[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function setChild(parent: XmlObject, name: string, value: XmlObject): void {
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	parent[key ?? `a:${name}`] = value;
}

function attribute(node: XmlObject, name: string): unknown {
	const key = Object.keys(node).find(
		(candidate) => candidate.startsWith('@_') && localName(candidate) === name,
	);
	return key ? node[key] : undefined;
}

function deleteAttribute(node: XmlObject, name: string): void {
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_') && localName(key) === name) {
			delete node[key];
		}
	}
}

function setAttribute(node: XmlObject, name: string, value: string, prefix?: string): void {
	const key = Object.keys(node).find(
		(candidate) => candidate.startsWith('@_') && localName(candidate) === name,
	);
	node[key ?? `@_${prefix ? `${prefix}:` : ''}${name}`] = value;
}

function unsignedInteger(value: unknown, max: number): number | undefined {
	if (!/^\d+$/u.test(String(value ?? ''))) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : undefined;
}
