import type { PptxElement } from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

interface MediaMetadataLike {
	duration?: number;
	videoWidth?: number;
	videoHeight?: number;
}

interface CaptionTrackLike {
	label: string;
	language: string;
}

interface MediaLikeElement {
	mediaType?: 'video' | 'audio' | 'unknown';
	mediaPath?: string;
	posterFrameData?: string;
	metadata?: MediaMetadataLike;
	loop?: boolean;
	autoPlay?: boolean;
	playAcrossSlides?: boolean;
	mediaMissing?: boolean;
	mediaMimeType?: string;
	captionTracks?: CaptionTrackLike[];
}

export class MediaElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['media'] as const;

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'media') return null;
		const mediaElement = element as MediaLikeElement;

		const label = this.resolveLabel(mediaElement);
		const output: string[] = [`*[${label}]*`];
		const details = this.buildDetails(mediaElement);
		if (details.length > 0) {
			output.push(`*${details.join(' | ')}*`);
		}

		if (
			mediaElement.posterFrameData &&
			mediaElement.posterFrameData.startsWith('data:')
		) {
			try {
				const posterPath = await ctx.mediaContext.saveImage(
					mediaElement.posterFrameData,
					`slide${ctx.slideNumber}-poster`
				);
				output.push(`![${label} poster](${posterPath})`);
			} catch {
				// Ignore poster extraction errors.
			}
		}

		if (
			mediaElement.captionTracks &&
			mediaElement.captionTracks.length > 0
		) {
			const captions = mediaElement.captionTracks
				.map(
					(track: CaptionTrackLike) =>
						`${track.label} (${track.language})`
				)
				.join(', ');
			output.push(`*Captions: ${captions}*`);
		}
		if (mediaElement.mediaMissing) {
			output.push('*Media source is missing*');
		}

		return output.join('\n\n');
	}

	private resolveLabel(mediaElement: MediaLikeElement): string {
		const fileName = mediaElement.mediaPath?.split('/').pop();
		if (mediaElement.mediaType === 'video') {
			return `Video: ${fileName ?? 'embedded media'}`;
		}
		if (mediaElement.mediaType === 'audio') {
			return `Audio: ${fileName ?? 'embedded media'}`;
		}
		return `Media: ${fileName ?? 'embedded media'}`;
	}

	private buildDetails(mediaElement: MediaLikeElement): string[] {
		const details: string[] = [];
		if (mediaElement.mediaPath) {
			details.push(`Path: ${mediaElement.mediaPath}`);
		}
		if (typeof mediaElement.metadata?.duration === 'number') {
			details.push(
				`Duration: ${this.formatDuration(mediaElement.metadata.duration)}`
			);
		}
		if (
			typeof mediaElement.metadata?.videoWidth === 'number' &&
			typeof mediaElement.metadata?.videoHeight === 'number'
		) {
			details.push(
				`Resolution: ${mediaElement.metadata.videoWidth}x${mediaElement.metadata.videoHeight}`
			);
		}
		if (mediaElement.loop) details.push('Looping');
		if (mediaElement.autoPlay) details.push('Auto-play');
		if (mediaElement.playAcrossSlides) details.push('Plays across slides');
		if (mediaElement.mediaMimeType)
			details.push(`MIME: ${mediaElement.mediaMimeType}`);
		return details;
	}

	private formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainder = Math.round(seconds % 60);
		return `${minutes}:${String(remainder).padStart(2, '0')}`;
	}
}
