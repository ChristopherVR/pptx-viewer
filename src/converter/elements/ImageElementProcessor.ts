import { isImageLikeElement } from '../../core';
import type {
	ImagePptxElement,
	PicturePptxElement,
	PptxElement,
} from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

type ImageLikeElement = ImagePptxElement | PicturePptxElement;

export class ImageElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['image', 'picture'] as const;

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (!isImageLikeElement(element)) return null;
		const imageElement: ImageLikeElement = element;
		const altText = this.sanitiseAltText(imageElement.altText);

		const imagePath = await this.extractImage(imageElement, ctx);
		if (!imagePath) {
			const hasData = !!imageElement.imageData;
			const dataPreview = imageElement.imageData
				? imageElement.imageData.substring(0, 80)
				: 'undefined';
			const msg =
				`Image extraction failed on slide ${ctx.slideNumber}: ` +
				`id="${imageElement.id}", ` +
				`imagePath="${imageElement.imagePath ?? 'unknown'}", ` +
				`hasImageData=${hasData}, ` +
				`imageDataPreview="${dataPreview}", ` +
				`hasSvgData=${!!imageElement.svgData}`;
			console.error(`[image-processor] ${msg}`);
			return `> **[Image extraction failed]** ${imageElement.id} (slide ${ctx.slideNumber})`;
		}

		if (ctx.semanticMode) {
			return `![${altText}](${imagePath})`;
		}

		if (ctx.layoutScale) {
			return `<img src="${imagePath}" alt="${altText}" style="max-width:100%;height:auto">`;
		}

		const dims = this.computeDisplaySize(
			element.width,
			element.height
		);
		return `<img src="${imagePath}" alt="${altText}" width="${dims.w}" height="${dims.h}">`;
	}

	/** Scale element dimensions to a sensible display size, capping width. */
	private computeDisplaySize(
		origW: number,
		origH: number,
		maxW = 600
	): { w: number; h: number } {
		if (origW <= 0 || origH <= 0) return { w: 100, h: 100 };
		if (origW <= maxW) {
			return { w: Math.round(origW), h: Math.round(origH) };
		}
		const scale = maxW / origW;
		return { w: maxW, h: Math.round(origH * scale) };
	}

	private async extractImage(
		imageElement: ImageLikeElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (
			imageElement.imageData &&
			imageElement.imageData.startsWith('data:')
		) {
			return await ctx.mediaContext.saveImage(
				imageElement.imageData,
				`slide${ctx.slideNumber}`
			);
		}

		if (imageElement.svgData && imageElement.svgData.startsWith('data:')) {
			return await ctx.mediaContext.saveImage(
				imageElement.svgData,
				`slide${ctx.slideNumber}`
			);
		}

		return null;
	}

	/** Clean and truncate image alt text for readable markdown output. */
	private sanitiseAltText(raw: string | undefined): string {
		if (!raw) return '';
		const MAX_ALT_LENGTH = 100;
		const cleaned = raw
			.replace(/&#x[0-9A-Fa-f]+;/g, ' ')
			.replace(/&#\d+;/g, ' ')
			.replace(/&[a-zA-Z]+;/g, ' ')
			.replace(/[\r\n]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (cleaned.length <= MAX_ALT_LENGTH) return cleaned;
		return `${cleaned.slice(0, MAX_ALT_LENGTH).trimEnd()}…`;
	}
}
