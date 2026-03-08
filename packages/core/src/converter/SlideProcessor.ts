import { hasTextProperties } from '../core';
import type { PptxElement, PptxSlide } from '../core';
import { MediaContext } from './media-context';
import { SlideMetadataRenderer } from './SlideMetadataRenderer';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import {
	ElementProcessorContext,
	ElementProcessorRegistry,
} from './elements/ElementProcessor';

/**
 * Options controlling how a single slide is processed into Markdown.
 */
export interface SlideProcessorOptions {
	/** Whether to include speaker notes below the slide content. */
	includeSpeakerNotes: boolean;
	/** Slide canvas width in CSS pixels (used for layout positioning). */
	slideWidth: number;
	/** Slide canvas height in CSS pixels (used for layout positioning). */
	slideHeight: number;
	/** When true, emit clean semantic markdown instead of positioned HTML. */
	semanticMode?: boolean;
}

/**
 * Converts a single {@link PptxSlide} into a Markdown section.
 */
export class SlideProcessor {
	/** Delegate for rendering slide-level metadata sections. */
	private readonly metadataRenderer: SlideMetadataRenderer;

	/**
	 * @param registry - Registry of element-type processors.
	 * @param mediaContext - Shared media extraction context.
	 * @param textRenderer - Renderer for rich-text segments.
	 */
	public constructor(
		private readonly registry: ElementProcessorRegistry,
		private readonly mediaContext: MediaContext,
		private readonly textRenderer: TextSegmentRenderer
	) {
		this.metadataRenderer = new SlideMetadataRenderer(textRenderer);
	}

	/** Processes a slide into a complete Markdown section. */
	public async processSlide(
		slide: PptxSlide,
		options: SlideProcessorOptions
	): Promise<string> {
		const isSemantic = options.semanticMode === true;
		const title = this.detectTitle(slide);
		const heading = this.buildHeading(slide, title);

		const context: ElementProcessorContext = {
			mediaContext: this.mediaContext,
			slideNumber: slide.slideNumber,
			slideWidth: options.slideWidth,
			slideHeight: options.slideHeight,
			semanticMode: isSemantic,
			processElements: async (
				elements: PptxElement[]
			): Promise<string[]> => {
				const sorted = this.sortElementsByReadingOrder(elements);
				const output: string[] = [];
				for (const element of sorted) {
					const rendered = await this.registry.processElement(
						element,
						context
					);
					if (rendered && rendered.trim().length > 0) {
						output.push(rendered);
					}
				}
				return output;
			},
		};

		const parts: string[] = [heading];

		const transition = this.metadataRenderer.renderTransition(slide);
		if (transition) {
			parts.push(transition);
		}

		if (isSemantic) {
			const elementContent = await this.processElementsSemantic(
				slide.elements,
				context
			);
			parts.push(...elementContent);
		} else {
			const backgroundHtml = await this.renderBackgroundHtml(
				slide, context
			);

			const elementContent = await this.processElementsWithLayout(
				slide.elements,
				context,
				backgroundHtml
			);
			parts.push(...elementContent);
		}

		const animations = this.metadataRenderer.renderAnimations(slide);
		if (animations) {
			parts.push(animations);
		}

		const warnings = this.metadataRenderer.renderWarnings(slide);
		if (warnings) {
			parts.push(warnings);
		}

		const comments = this.metadataRenderer.renderComments(slide);
		if (comments) {
			parts.push(comments);
		}

		if (options.includeSpeakerNotes) {
			const notes = this.metadataRenderer.renderNotes(slide);
			if (notes) {
				parts.push(notes);
			}
		}

		return parts.join('\n\n');
	}

	/**
	 * Builds the Markdown heading line for a slide, including its number,
	 * detected title text, and flags (hidden, layout name).
	 */
	private buildHeading(slide: PptxSlide, title?: string): string {
		const flags: string[] = [];
		if (slide.hidden) flags.push('hidden');
		if (slide.layoutName) flags.push(`layout: ${slide.layoutName}`);
		const suffix = flags.length > 0 ? ` *(${flags.join(', ')})*` : '';

		if (title) {
			return `## Slide ${slide.slideNumber}: ${title}${suffix}`;
		}
		return `## Slide ${slide.slideNumber}${suffix}`;
	}

	/**
	 * Returns an HTML `<img>` for the slide background that can be
	 * placed as the bottom-most layer inside the positioned container.
	 */
	private async renderBackgroundHtml(
		slide: PptxSlide,
		ctx: ElementProcessorContext
	): Promise<string | undefined> {
		if (!slide.backgroundImage) return undefined;
		if (!slide.backgroundImage.startsWith('data:')) return undefined;
		try {
			const path = await ctx.mediaContext.saveImage(
				slide.backgroundImage,
				`slide${slide.slideNumber}-bg`
			);
			return `<img src="${path}" alt="Slide background" style="width:100%;height:100%;object-fit:cover">`;
		} catch {
			return undefined;
		}
	}

	/** Detects the slide's title from placeholder or first text element. */
	private detectTitle(slide: PptxSlide): string | undefined {
		for (const element of slide.elements) {
			const phType = this.getPlaceholderType(element);
			if (
				phType === 'title' ||
				phType === 'ctrTitle' ||
				phType === 'subTitle'
			) {
				if (!hasTextProperties(element)) continue;
				const textFromSegments = element.textSegments
					? this.textRenderer.plainText(element.textSegments)
					: '';
				const text = (textFromSegments || element.text || '').trim();
				if (text) return text.slice(0, 120);
			}
		}

		const sorted = this.sortElementsByReadingOrder(slide.elements);
		for (const element of sorted) {
			if (!hasTextProperties(element)) continue;
			const textFromSegments = element.textSegments
				? this.textRenderer.plainText(element.textSegments)
				: '';
			const text = (textFromSegments || element.text || '').trim();
			if (!text) continue;
			return text.slice(0, 120);
		}
		return undefined;
	}

	/**
	 * Extracts the placeholder type from an element, if present.
	 */
	private getPlaceholderType(element: PptxElement): string | undefined {
		const el = element as unknown as { placeholderType?: string };
		return el.placeholderType;
	}

	/** Processes elements as clean semantic markdown. */
	private async processElementsSemantic(
		elements: PptxElement[],
		context: ElementProcessorContext
	): Promise<string[]> {
		if (elements.length === 0) return [];

		const sorted = this.sortElementsByReadingOrder(elements);
		const output: string[] = [];

		for (const elem of sorted) {
			const rendered = await this.registry.processElement(
				elem, context
			);
			if (rendered?.trim()) {
				output.push(rendered);
			}
		}

		return output;
	}

	/** Processes elements using CSS absolute positioning. */
	private async processElementsWithLayout(
		elements: PptxElement[],
		context: ElementProcessorContext,
		backgroundHtml?: string
	): Promise<string[]> {
		if (elements.length === 0 && !backgroundHtml) return [];

		const slideW = context.slideWidth || 960;
		const slideH = context.slideHeight || 540;
		const maxDisplayW = 960;
		const scale = slideW > maxDisplayW ? maxDisplayW / slideW : 1;
		const displayW = Math.round(slideW * scale);
		const displayH = Math.round(slideH * scale);

		const sorted = this.sortElementsByReadingOrder(elements);
		const positionedCells: string[] = [];

		const layoutContext: ElementProcessorContext = {
			...context,
			layoutScale: scale,
		};

		if (backgroundHtml) {
			positionedCells.push(
				`<div style="position:absolute;left:0;top:0;width:${displayW}px;height:${displayH}px">${backgroundHtml}</div>`
			);
		}

		for (const elem of sorted) {
			const rendered = await this.registry.processElement(
				elem, layoutContext
			);
			if (!rendered?.trim()) continue;

			const left = Math.round(elem.x * scale);
			const top = Math.round(elem.y * scale);
			const w = Math.round(elem.width * scale);
			const h = Math.round(elem.height * scale);

			positionedCells.push(
				`<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;overflow:hidden">${rendered}</div>`
			);
		}

		if (positionedCells.length === 0) return [];

		const container = [
			`<div style="position:relative;width:${displayW}px;height:${displayH}px;border:1px solid #e5e7eb;overflow:hidden;margin:0.5em 0">`,
			...positionedCells,
			'</div>',
		].join('\n');

		return [container];
	}

	/** Sorts elements into natural reading order (top-to-bottom, left-to-right). */
	private sortElementsByReadingOrder(elements: PptxElement[]): PptxElement[] {
		return [...elements].sort((left, right) => {
			const yDistance = (left.y ?? 0) - (right.y ?? 0);
			if (Math.abs(yDistance) > 8) return yDistance;
			return (left.x ?? 0) - (right.x ?? 0);
		});
	}
}
