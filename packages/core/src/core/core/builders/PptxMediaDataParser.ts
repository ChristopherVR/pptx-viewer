import type { MediaPptxElement } from '../../types';

export interface PptxMediaDataParserContext {
	slideRelsMap: Map<string, Map<string, string>>;
	resolvePath: (base: string, relative: string) => string;
	getPathExtension: (pathValue: string) => string | undefined;
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
			const videoFile = graphicData['a:videoFile'] as Record<string, unknown> | undefined;
			const audioFile = graphicData['a:audioFile'] as Record<string, unknown> | undefined;

			if (videoFile) {
				result.mediaType = 'video';
				// Prefer r:link (external/linked media), fall back to r:embed (embedded media)
				const linkRid = videoFile['@_r:link'];
				const embedRid = videoFile['@_r:embed'];
				const relationshipId = linkRid ?? embedRid;
				result.isLinked = typeof linkRid === 'string' && linkRid.length > 0;
				if (typeof relationshipId === 'string' && relationshipId.length > 0) {
					result.mediaPath = this.resolveRelationshipTarget(slidePath, relationshipId);
					result.mediaMimeType = this.getMediaMimeType(result.mediaPath);
				}
			} else if (audioFile) {
				result.mediaType = 'audio';
				// Prefer r:link (external/linked media), fall back to r:embed (embedded media)
				const linkRid = audioFile['@_r:link'];
				const embedRid = audioFile['@_r:embed'];
				const relationshipId = linkRid ?? embedRid;
				result.isLinked = typeof linkRid === 'string' && linkRid.length > 0;
				if (typeof relationshipId === 'string' && relationshipId.length > 0) {
					result.mediaPath = this.resolveRelationshipTarget(slidePath, relationshipId);
					result.mediaMimeType = this.getMediaMimeType(result.mediaPath);
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
