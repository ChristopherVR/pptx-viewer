import type { MediaPptxElement, XmlObject } from '../../types';
import { parseDrawingMediaReference } from '../../utils/drawing-media-reference';

export interface PptxMediaDataParserContext {
	slideRelsMap: Map<string, Map<string, string>>;
	/** Relationship IDs with TargetMode="External" per slide/part path. */
	externalRelsMap: Map<string, Set<string>>;
	resolvePath: (base: string, relative: string) => string;
	getPathExtension: (pathValue: string) => string | undefined;
	/**
	 * Load H3-style gate for a LINKED (`TargetMode="External"`) media
	 * relationship: mirrors the `allowExternalImages` gate pictures already use
	 * (same security surface: a `<video>`/`<audio>` pointed at an
	 * attacker-controlled URL). Defaults to closed (`false`) when not supplied,
	 * matching `allowExternalImages`'s own default. Wired by the runtime as
	 * `() => this.allowExternalImages === true`.
	 */
	allowExternalMedia?: () => boolean;
}

export interface IPptxMediaDataParser {
	parseMediaData(
		graphicData: Record<string, unknown>,
		slidePath: string,
	): Partial<MediaPptxElement>;
	resolveRelationshipTarget(sourcePath: string, relationshipId: string): string | undefined;
	getMediaMimeType(mediaPath: string | undefined): string | undefined;
}

export class PptxMediaDataParser implements IPptxMediaDataParser {
	private readonly context: PptxMediaDataParserContext;

	public constructor(context: PptxMediaDataParserContext) {
		this.context = context;
	}

	public parseMediaData(
		graphicData: Record<string, unknown>,
		slidePath: string,
	): Partial<MediaPptxElement> {
		const result: Partial<MediaPptxElement> = {};

		try {
			const reference = parseDrawingMediaReference(
				graphicData as XmlObject,
				this.context.externalRelsMap.get(slidePath),
			);
			if (reference) {
				result.mediaType = reference.mediaType;
				result.mediaReferenceKind = reference.kind;
				result.mediaReferenceName = reference.name;
				result.mediaReferenceContentType = reference.contentType;
				result.audioCdStart = reference.audioCdStart;
				result.audioCdEnd = reference.audioCdEnd;
				result.rawMediaReferenceXml = reference.rawXml;
				result.isLinked = reference.isLinked;
				if (reference.relationshipId) {
					result.mediaPath = this.resolveRelationshipTarget(slidePath, reference.relationshipId);
					// G21: `a:audioFile/@contentType` (`CT_AudioFile`, ECMA-376
					// 20.1.3.2) exists precisely to declare the media type when the
					// target's extension is ambiguous or absent; prefer it over the
					// extension guess when the deck bothered to declare it.
					result.mediaMimeType = reference.contentType ?? this.getMediaMimeType(result.mediaPath);
				}
			} else {
				result.mediaType = 'unknown';
			}
		} catch {
			result.mediaType = 'unknown';
		}

		return result;
	}

	public resolveRelationshipTarget(sourcePath: string, relationshipId: string): string | undefined {
		const relsMap = this.context.slideRelsMap.get(sourcePath);
		const target = relsMap?.get(relationshipId);
		if (!target) {
			return undefined;
		}
		// G17: a LINKED (`TargetMode="External"`) relationship's `Target` is an
		// absolute URI (`https://cdn.example.com/demo.mp4`), not a
		// package-relative path. Routing it through `resolvePath` (a zip-path
		// joiner) produced nonsense like `ppt/slides/https:/example.com/clip.mp4`
		// instead of a URL or a real archive entry, so the media silently failed
		// to load. Gated the same way pictures gate `allowExternalImages`
		// (same security surface: fetching an attacker-controlled URL).
		if (this.context.externalRelsMap.get(sourcePath)?.has(relationshipId)) {
			return this.context.allowExternalMedia?.() === true ? target : undefined;
		}
		return this.context.resolvePath(sourcePath, target);
	}

	public getMediaMimeType(mediaPath: string | undefined): string | undefined {
		if (!mediaPath) {
			return undefined;
		}

		const extension = (this.context.getPathExtension(mediaPath) ?? '').toLowerCase();
		const mimeMap: Record<string, string> = {
			mp4: 'video/mp4',
			webm: 'video/webm',
			ogg: 'video/ogg',
			ogv: 'video/ogg',
			avi: 'video/x-msvideo',
			wmv: 'video/x-ms-wmv',
			mov: 'video/quicktime',
			mp3: 'audio/mpeg',
			wav: 'audio/wav',
			m4a: 'audio/mp4',
			wma: 'audio/x-ms-wma',
			oga: 'audio/ogg',
		};

		return mimeMap[extension];
	}
}
