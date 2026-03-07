import type { PptxElement } from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

interface ZoomLikeElement {
	zoomType: 'slide' | 'section';
	targetSlideIndex: number;
	targetSectionId?: string;
	imageData?: string;
	svgData?: string;
	altText?: string;
}

interface ContentPartLikeElement {
	inkStrokes?: unknown[];
}

export class FallbackElementProcessor implements ElementProcessor {
	public readonly supportedTypes = [
		'zoom',
		'contentPart',
		'unknown',
	] as const;

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type === 'zoom') {
			return this.renderZoom(
				element as ZoomLikeElement,
				ctx
			);
		}
		if (element.type === 'contentPart') {
			return this.renderContentPart(element as ContentPartLikeElement);
		}
		if (element.type === 'unknown') {
			return '*[Unsupported Element]*';
		}
		return null;
	}

	private async renderZoom(
		zoomElement: ZoomLikeElement,
		ctx: ElementProcessorContext
	): Promise<string> {
		const slideNumber = zoomElement.targetSlideIndex + 1;
		const parts: string[] = [];

		if (zoomElement.zoomType === 'section') {
			if (zoomElement.targetSectionId) {
				parts.push(
					`*[Zoom to Section ${zoomElement.targetSectionId} (Slide ${slideNumber})]*`
				);
			} else {
				parts.push(`*[Zoom to Section (Slide ${slideNumber})]*`);
			}
		} else {
			parts.push(`*[Zoom to Slide ${slideNumber}]*`);
		}

		const imagePath = await this.extractZoomImage(zoomElement, ctx);
		if (imagePath) {
			const alt = zoomElement.altText?.trim() || `Zoom preview slide ${slideNumber}`;
			parts.push(`![${alt}](${imagePath})`);
		}

		return parts.join('\n\n');
	}

	private async extractZoomImage(
		zoomElement: ZoomLikeElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		const dataUrl = zoomElement.imageData ?? zoomElement.svgData;
		if (!dataUrl || !dataUrl.startsWith('data:')) return null;
		try {
			return await ctx.mediaContext.saveImage(
				dataUrl,
				`slide${ctx.slideNumber}-zoom`
			);
		} catch {
			return null;
		}
	}

	private renderContentPart(contentPart: ContentPartLikeElement): string {
		if (contentPart.inkStrokes && contentPart.inkStrokes.length > 0) {
			return `*[Ink Content: ${contentPart.inkStrokes.length} stroke${contentPart.inkStrokes.length === 1 ? '' : 's'}]*`;
		}
		return '*[Content Part]*';
	}
}
