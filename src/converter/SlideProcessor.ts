import { hasTextProperties } from '../core';
import type { PptxElement, PptxSlide } from '../core';
import { MediaContext } from './media-context';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import {
	ElementProcessorContext,
	ElementProcessorRegistry,
} from './elements/ElementProcessor';

interface NativeAnimationLike {
	targetId?: string;
	trigger?: string;
	presetClass?: string;
	presetId?: number;
	durationMs?: number;
	delayMs?: number;
	motionPath?: string;
	rotationBy?: number;
	repeatCount?: number;
	autoReverse?: boolean;
	buildType?: string;
}

interface CompatibilityWarningLike {
	message: string;
	severity: 'info' | 'warning';
}

export interface SlideProcessorOptions {
	includeSpeakerNotes: boolean;
	slideWidth: number;
	slideHeight: number;
	/** When true, emit clean semantic markdown instead of positioned HTML. */
	semanticMode?: boolean;
}

export class SlideProcessor {
	public constructor(
		private readonly registry: ElementProcessorRegistry,
		private readonly mediaContext: MediaContext,
		private readonly textRenderer: TextSegmentRenderer
	) {}

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



		const animations = this.renderAnimations(slide);
		if (animations) {
			parts.push(animations);
		}

		const warnings = this.renderWarnings(slide);
		if (warnings) {
			parts.push(warnings);
		}

		const comments = this.renderComments(slide);
		if (comments) {
			parts.push(comments);
		}

		if (options.includeSpeakerNotes) {
			const notes = this.renderNotes(slide);
			if (notes) {
				parts.push(notes);
			}
		}

		return parts.join('\n\n');
	}

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

	private detectTitle(slide: PptxSlide): string | undefined {
		// First pass: look for placeholder types that indicate a title
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

		// Fallback: first text element in reading order
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

	private getPlaceholderType(element: PptxElement): string | undefined {
		const el = element as unknown as { placeholderType?: string };
		return el.placeholderType;
	}

	/**
	 * Processes slide elements as clean semantic markdown without
	 * CSS positioning. Elements are rendered in reading order
	 * and joined with double newlines.
	 */
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

	/**
	 * Processes slide elements using CSS absolute positioning within a
	 * container that mirrors the slide's aspect ratio.  Each element is
	 * placed at its original (x, y) coordinates, scaled down so the
	 * container fits a reasonable display width.
	 */
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

		// Background image as the bottom-most layer.
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

	private sortElementsByReadingOrder(elements: PptxElement[]): PptxElement[] {
		return [...elements].sort((left, right) => {
			const yDistance = (left.y ?? 0) - (right.y ?? 0);
			if (Math.abs(yDistance) > 8) return yDistance;
			return (left.x ?? 0) - (right.x ?? 0);
		});
	}

	private renderNotes(slide: PptxSlide): string {
		const notesFromSegments = slide.notesSegments
			? this.textRenderer.render(slide.notesSegments)
			: '';
		const notesText = (notesFromSegments || slide.notes || '').trim();
		if (!notesText) return '';
		const quoted = notesText
			.split(/\r?\n/)
			.map((line) => `> ${line}`)
			.join('\n');
		return `> **Speaker Notes**\n${quoted}`;
	}

	private renderComments(slide: PptxSlide): string {
		if (!slide.comments || slide.comments.length === 0) return '';
		const lines: string[] = ['### Comments'];
		for (const comment of slide.comments) {
			const author = comment.author?.trim() || 'Unknown';
			const createdAt = comment.createdAt
				? ` (${comment.createdAt})`
				: '';
			const resolved = comment.resolved ? ' [resolved]' : '';
			lines.push(
				`- **${author}**${createdAt}: ${comment.text}${resolved}`
			);
		}
		return lines.join('\n');
	}

	private renderAnimations(slide: PptxSlide): string {
		const native = slide.nativeAnimations as NativeAnimationLike[] | undefined;
		const legacy = slide.animations;
		const items: NativeAnimationLike[] = native?.length
			? native
			: this.mapLegacyAnimations(legacy);
		if (items.length === 0) return '';

		const classLabels: Record<string, string> = {
			entr: 'Entrance',
			exit: 'Exit',
			emph: 'Emphasis',
			path: 'Motion Path',
		};

		const groups = new Map<string, NativeAnimationLike[]>();
		for (const item of items) {
			const key = item.presetClass ?? 'entr';
			const list = groups.get(key) ?? [];
			list.push(item);
			groups.set(key, list);
		}

		const lines: string[] = ['### Animations'];
		for (const [key, label] of Object.entries(classLabels)) {
			const group = groups.get(key);
			if (!group || group.length === 0) continue;
			const summaries = group.map((a) => this.summariseAnimation(a));
			lines.push(`- **${label}**: ${group.length} effect${group.length > 1 ? 's' : ''} (${summaries.join(', ')})`);
		}
		return lines.length > 1 ? lines.join('\n') : '';
	}

	private mapLegacyAnimations(
		legacy: PptxSlide['animations']
	): NativeAnimationLike[] {
		if (!legacy?.length) return [];
		return legacy.map((a) => {
			let presetClass: string = 'entr';
			if (a.exit) presetClass = 'exit';
			else if (a.emphasis) presetClass = 'emph';
			else if (a.motionPath) presetClass = 'path';
			return {
				trigger: a.trigger,
				presetClass,
				durationMs: a.durationMs,
				motionPath: a.motionPath,
			};
		});
	}

	private summariseAnimation(anim: NativeAnimationLike): string {
		const trigger = anim.trigger ?? 'onClick';
		const triggerLabel = trigger.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
		if (anim.presetClass === 'path') {
			const dur = anim.durationMs ? `, ${anim.durationMs}ms` : '';
			return `custom path${dur}`;
		}
		const id = anim.presetId ? `preset ${anim.presetId}` : 'effect';
		return `${id} ${triggerLabel}`;
	}

	private renderWarnings(slide: PptxSlide): string {
		const raw = slide.warnings as CompatibilityWarningLike[] | undefined;
		if (!raw || raw.length === 0) return '';
		const lines: string[] = ['### Warnings'];
		for (const w of raw) {
			const icon = w.severity === 'warning' ? '⚠️' : 'ℹ️';
			lines.push(`- ${icon} ${w.message}`);
		}
		return lines.join('\n');
	}
}
