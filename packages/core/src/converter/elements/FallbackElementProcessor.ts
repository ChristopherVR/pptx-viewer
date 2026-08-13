import type { PptxElement } from '../../core';
import type { ElementProcessor, ElementProcessorContext } from './ElementProcessor';

interface ZoomLikeElement {
	zoomType: 'slide' | 'section' | 'summary';
	targetSlideIndex: number;
	targetSectionId?: string;
	imageData?: string;
	svgData?: string;
	altText?: string;
}

interface ContentPartLikeElement {
	inkStrokes?: unknown[];
}

interface Model3DLikeElement {
	modelPath?: string;
	posterImage?: string;
	imageData?: string;
	altText?: string;
}

export class FallbackElementProcessor implements ElementProcessor {
	/**
	 * The element types no dedicated processor claims.
	 *
	 * `model3d` is here because the registry silently drops any type it has no
	 * processor for: `processElement` returns `null` and the element vanishes
	 * from the converted markdown with no warning. A 3D model used to convert to
	 * literally nothing. Adding a discriminant to `PptxElement` therefore means
	 * adding it here too (or to a dedicated processor); the registry cannot warn
	 * you, because a `Map` miss is indistinguishable from "deliberately skipped".
	 */
	public readonly supportedTypes = ['zoom', 'contentPart', 'model3d', 'unknown'] as const;

	public async process(element: PptxElement, ctx: ElementProcessorContext): Promise<string | null> {
		if (element.type === 'zoom') {
			return this.renderZoom(element as ZoomLikeElement, ctx);
		}
		if (element.type === 'contentPart') {
			return this.renderContentPart(element as ContentPartLikeElement);
		}
		if (element.type === 'model3d') {
			return this.renderModel3D(element as Model3DLikeElement, ctx);
		}
		if (element.type === 'unknown') {
			return '*[Unsupported Element]*';
		}
		return null;
	}

	/**
	 * A 3D model becomes its poster frame plus a marker, because markdown has no
	 * way to be interactive: the poster is exactly what PowerPoint itself shows
	 * a viewer that cannot render the model.
	 */
	private async renderModel3D(
		model: Model3DLikeElement,
		ctx: ElementProcessorContext,
	): Promise<string> {
		const alt = model.altText?.trim() || '3D Model';
		const poster = await this.savePoster(model, ctx);
		if (poster) {
			return `![${alt}](${poster})\n\n*[3D Model]*`;
		}
		return model.modelPath ? `*[3D Model: ${model.modelPath}]*` : '*[3D Model]*';
	}

	private async savePoster(
		model: Model3DLikeElement,
		ctx: ElementProcessorContext,
	): Promise<string | null> {
		const dataUrl = model.posterImage ?? model.imageData;
		if (!dataUrl || !dataUrl.startsWith('data:')) {
			return null;
		}
		try {
			return await ctx.mediaContext.saveImage(dataUrl, `slide${ctx.slideNumber}-model3d`);
		} catch {
			return null;
		}
	}

	private async renderZoom(
		zoomElement: ZoomLikeElement,
		ctx: ElementProcessorContext,
	): Promise<string> {
		const slideNumber = zoomElement.targetSlideIndex + 1;
		const parts: string[] = [];

		if (zoomElement.zoomType === 'section') {
			if (zoomElement.targetSectionId) {
				parts.push(`*[Zoom to Section ${zoomElement.targetSectionId} (Slide ${slideNumber})]*`);
			} else {
				parts.push(`*[Zoom to Section (Slide ${slideNumber})]*`);
			}
		} else if (zoomElement.zoomType === 'summary') {
			parts.push(`*[Summary Zoom starting at Slide ${slideNumber}]*`);
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
		ctx: ElementProcessorContext,
	): Promise<string | null> {
		const dataUrl = zoomElement.imageData ?? zoomElement.svgData;
		if (!dataUrl || !dataUrl.startsWith('data:')) {
			return null;
		}
		try {
			return await ctx.mediaContext.saveImage(dataUrl, `slide${ctx.slideNumber}-zoom`);
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
