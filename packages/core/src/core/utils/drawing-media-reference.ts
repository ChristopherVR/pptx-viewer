import type {
	MediaPptxElement,
	PptxAudioCdPosition,
	PptxMediaReferenceKind,
	XmlObject,
} from '../types';

const MEDIA_REFERENCE_TAGS: ReadonlyArray<[PptxMediaReferenceKind, string]> = [
	['audioCd', 'a:audioCd'],
	['wavAudioFile', 'a:wavAudioFile'],
	['audioFile', 'a:audioFile'],
	['videoFile', 'a:videoFile'],
	['quickTimeFile', 'a:quickTimeFile'],
];

export interface ParsedDrawingMediaReference {
	kind: PptxMediaReferenceKind;
	mediaType: 'audio' | 'video';
	relationshipId?: string;
	isLinked?: boolean;
	name?: string;
	audioCdStart?: PptxAudioCdPosition;
	audioCdEnd?: PptxAudioCdPosition;
	rawXml: XmlObject;
}

export function parseDrawingMediaReference(
	container: XmlObject | undefined,
): ParsedDrawingMediaReference | undefined {
	if (!container) {
		return undefined;
	}
	for (const [kind, tag] of MEDIA_REFERENCE_TAGS) {
		const node = container[tag] as XmlObject | undefined;
		if (!node) {
			continue;
		}
		return {
			kind,
			mediaType: kind === 'videoFile' || kind === 'quickTimeFile' ? 'video' : 'audio',
			relationshipId: String(node['@_r:link'] ?? node['@_r:embed'] ?? '').trim() || undefined,
			isLinked: node['@_r:link'] !== undefined,
			name: kind === 'wavAudioFile' ? String(node['@_name'] ?? '') || undefined : undefined,
			audioCdStart: kind === 'audioCd' ? parseAudioCdPosition(node['a:st']) : undefined,
			audioCdEnd: kind === 'audioCd' ? parseAudioCdPosition(node['a:end']) : undefined,
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
	for (const [, tag] of MEDIA_REFERENCE_TAGS) {
		delete container[tag];
	}
	const original = element.rawMediaReferenceXml ? { ...element.rawMediaReferenceXml } : {};
	if (kind === 'audioCd') {
		delete original['@_r:link'];
		delete original['@_r:embed'];
		original['a:st'] = buildAudioCdPosition(element.audioCdStart);
		original['a:end'] = buildAudioCdPosition(element.audioCdEnd);
		container['a:audioCd'] = original;
		return;
	}
	if (kind === 'wavAudioFile') {
		delete original['@_r:link'];
		if (relationshipId) {
			original['@_r:embed'] = relationshipId;
		}
		if (element.mediaReferenceName !== undefined) {
			original['@_name'] = element.mediaReferenceName;
		}
	} else {
		delete original['@_r:embed'];
		if (relationshipId) {
			original['@_r:link'] = relationshipId;
		}
	}
	container[`a:${kind}`] = original;
}

function parseAudioCdPosition(value: unknown): PptxAudioCdPosition | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const node = value as XmlObject;
	const track = Number.parseInt(String(node['@_track'] ?? ''), 10);
	if (!Number.isFinite(track)) {
		return undefined;
	}
	const time = Number.parseInt(String(node['@_time'] ?? '0'), 10);
	return { track, time: Number.isFinite(time) ? time : 0 };
}

function buildAudioCdPosition(value: PptxAudioCdPosition | undefined): XmlObject {
	return { '@_track': String(value?.track ?? 1), '@_time': String(value?.time ?? 0) };
}
