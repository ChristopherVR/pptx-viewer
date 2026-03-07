import { hasTextProperties } from '../../core';
import type {
	PptxElement,
	PptxElementWithText,
	ShapeStyle,
	TextSegment,
	TextStyle,
} from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';
import { TextSegmentRenderer } from '../TextSegmentRenderer';
import { renderShapeToDataUrl } from '../ShapeImageRenderer';

export class TextElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['text', 'shape', 'connector'] as const;

	public constructor(private readonly textRenderer: TextSegmentRenderer) {}

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (!hasTextProperties(element)) return null;
		const textElement: PptxElementWithText = element;

		const parts: string[] = [];

		const fillImage = await this.extractShapeFillImage(element, ctx);
		if (fillImage) {
			parts.push(fillImage);
		}

		// If shape has a visible fill/stroke AND text, render as composite image.
		const hasVisualShape = this.shapeHasVisibleStyling(element);

		if (textElement.textSegments && textElement.textSegments.length > 0) {
			let compositeRendered = false;
			if (hasVisualShape) {
				const compositeImage = await this.renderShapeAsImage(
					element,
					ctx,
					textElement.textSegments,
					textElement.textStyle
				);
				if (compositeImage) {
					parts.push(compositeImage);
					compositeRendered = true;
				}
			}

			const bulletImages = await this.extractPictureBullets(
				textElement.textSegments,
				ctx
			);
			if (bulletImages.length > 0) {
				parts.push(...bulletImages);
			}

			// Skip text when composite image already includes it.
			if (!compositeRendered) {
				const renderOpts = {
					paragraphIndents: textElement.paragraphIndents,
					slideNumber: ctx.slideNumber,
					htmlFormatting: ctx.layoutScale !== undefined && !ctx.semanticMode,
				};
				const content = this.textRenderer.render(
					textElement.textSegments,
					renderOpts
				);
				if (content.trim()) {
					let textBlock = content;
					if (
						textElement.linkedTxbxId !== undefined &&
						(textElement.linkedTxbxSeq ?? 0) > 0
					) {
						const contLabel = `continued from linked text box ${textElement.linkedTxbxId}`;
						textBlock += `\n\n*[${contLabel}]*`;
					}
					parts.push(textBlock);
				}
			}
		} else {
			const fallbackText = textElement.text?.trim();
			if (fallbackText) {
				const align = textElement.textStyle?.align;
				if (align && align !== 'left') {
					parts.push(
						`<p align="${align}">${fallbackText}</p>`
					);
				} else {
					parts.push(fallbackText);
				}
			}
		}

		const warp = textElement.textStyle?.textWarpPreset;
		if (warp && warp !== 'textNoShape') {
			parts.push(`*Text warp: ${warp}*`);
		}

		if (parts.length === 0 && textElement.promptText) {
			parts.push(`*[Placeholder: ${textElement.promptText}]*`);
		}

		// If still no content, try rendering the shape's visual styling as an image.
		if (parts.length === 0) {
			const shapeImage = await this.renderShapeAsImage(
				element,
				ctx,
				undefined,
				undefined
			);
			if (shapeImage) {
				parts.push(shapeImage);
			}
		}

		if (parts.length === 0) return null;

		return parts.join('\n\n');
	}

	private async extractPictureBullets(
		segments: TextSegment[],
		ctx: ElementProcessorContext
	): Promise<string[]> {
		const extracted: string[] = [];
		const seen = new Set<string>();
		for (const segment of segments) {
			const dataUrl = segment.bulletInfo?.imageDataUrl;
			if (
				!dataUrl ||
				!dataUrl.startsWith('data:') ||
				seen.has(dataUrl)
			) {
				continue;
			}
			seen.add(dataUrl);
			try {
				const path = await ctx.mediaContext.saveImage(
					dataUrl,
					`slide${ctx.slideNumber}-bullet`
				);
				extracted.push(
					`<img src="${path}" alt="Bullet image">`
				);
			} catch {
				// Ignore extraction errors.
			}
		}
		return extracted;
	}

	private async extractShapeFillImage(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		const style = (element as unknown as { shapeStyle?: ShapeStyle })
			.shapeStyle;
		if (!style) return null;
		if (style.fillMode !== 'image' || !style.fillImageUrl) return null;
		if (!style.fillImageUrl.startsWith('data:')) return null;
		try {
			const path = await ctx.mediaContext.saveImage(
				style.fillImageUrl,
				`slide${ctx.slideNumber}-shapefill`
			);
			if (ctx.semanticMode) {
				return `![Shape fill](${path})`;
			}
			return `<img src="${path}" alt="Shape fill">`;
		} catch {
			return null;
		}
	}

	/**
	 * Renders a shape with visible fill/stroke (optionally with text)
	 * to a PNG image so it appears in the markdown output.
	 */
	private async renderShapeAsImage(
		element: PptxElement,
		ctx: ElementProcessorContext,
		textSegments: TextSegment[] | undefined,
		textStyle: TextStyle | undefined
	): Promise<string | null> {
		const shape = element as unknown as {
			shapeStyle?: ShapeStyle;
			shapeType?: string;
			pathData?: string;
			pathWidth?: number;
			pathHeight?: number;
			width?: number;
			height?: number;
		};
		if (!shape.shapeStyle || !shape.width || !shape.height) return null;

		try {
			const dataUrl = renderShapeToDataUrl({
				width: shape.width,
				height: shape.height,
				shapeType: shape.shapeType,
				pathData: shape.pathData,
				pathWidth: shape.pathWidth,
				pathHeight: shape.pathHeight,
				shapeStyle: shape.shapeStyle,
				textSegments,
				textStyle,
			});
			if (!dataUrl) return null;

			const imgPath = await ctx.mediaContext.saveImage(
				dataUrl,
				`slide${ctx.slideNumber}-shape`
			);
			if (ctx.semanticMode) {
				return `![Shape](${imgPath})`;
			}
			if (ctx.layoutScale) {
				return `<img src="${imgPath}" alt="Shape" style="max-width:100%;height:auto">`;
			}
			const dims = this.computeDisplaySize(
				shape.width,
				shape.height
			);
			return `<img src="${imgPath}" alt="Shape" width="${dims.w}" height="${dims.h}">`;
		} catch {
			return null;
		}
	}

	/**
	 * Checks whether the element has a visible fill or stroke that
	 * would benefit from being rendered as an image.
	 */
	private shapeHasVisibleStyling(element: PptxElement): boolean {
		const style = (element as unknown as { shapeStyle?: ShapeStyle })
			.shapeStyle;
		if (!style) return false;
		if (style.fillMode === 'none' && !style.strokeColor) return false;
		if (
			style.fillColor &&
			style.fillColor !== 'transparent'
		) {
			return true;
		}
		if (
			style.fillMode === 'gradient' &&
			(style.fillGradientStops?.length ?? 0) > 0
		) {
			return true;
		}
		if (
			style.strokeColor &&
			style.strokeColor !== 'transparent' &&
			(style.strokeWidth ?? 0) > 0
		) {
			return true;
		}
		return false;
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
}
