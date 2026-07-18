/**
 * Deck-context builders: turn the live deck into compact text the model can
 * reason over. Two granularities are offered - a whole-deck {@link buildDeckOutline}
 * and a single-slide {@link buildSlideMarkdown} (via core's PptxMarkdownConverter,
 * with a rough token budget so a large deck never blows the context window).
 */

import { PptxMarkdownConverter } from 'pptx-viewer-core';
import type { FileSystemAdapter, PptxData, PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { PptxAiDeckMeta } from './bridge';

/** Rough chars-per-token heuristic for budgeting (deliberately conservative). */
const CHARS_PER_TOKEN = 4;

/** A FileSystemAdapter that discards writes, so the converter never touches disk. */
const NULL_FS: FileSystemAdapter = {
	async writeFile() {},
	async writeBinaryFile() {},
	async createFolder() {},
};

/** Estimate the token cost of a string. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Truncate `text` so it fits within `maxTokens`, appending a marker if cut. */
export function clampToTokenBudget(text: string, maxTokens: number): string {
	const maxChars = maxTokens * CHARS_PER_TOKEN;
	if (text.length <= maxChars) {
		return text;
	}
	return `${text.slice(0, maxChars)}\n...[truncated to fit context budget]`;
}

/** Best-effort slide title: the first non-empty text on the slide. */
export function slideTitle(slide: PptxSlide): string | undefined {
	for (const el of slide.elements) {
		if ('text' in el && typeof el.text === 'string' && el.text.trim()) {
			return el.text.trim().split('\n')[0].slice(0, 80);
		}
	}
	return undefined;
}

/** Count elements on a slide by type, e.g. `2 text, 1 chart`. */
function elementBreakdown(elements: PptxElement[]): string {
	const counts = new Map<string, number>();
	for (const el of elements) {
		counts.set(el.type, (counts.get(el.type) ?? 0) + 1);
	}
	return [...counts.entries()].map(([type, n]) => `${n} ${type}`).join(', ') || 'empty';
}

/**
 * Build a compact, whole-deck outline: one line per slide with its title and a
 * breakdown of element types. Honours an optional slide cap and a token budget.
 */
export function buildDeckOutline(
	slides: PptxSlide[],
	meta: PptxAiDeckMeta,
	options: { maxSlides?: number; maxTokens?: number } = {},
): string {
	const limit = Math.min(options.maxSlides ?? slides.length, slides.length);
	const header = `Deck: ${meta.title ?? 'Untitled'} - ${meta.slideCount} slide(s), ${Math.round(
		meta.width,
	)}x${Math.round(meta.height)}px. Active slide: ${meta.activeSlideIndex + 1}.`;
	const lines = [header, ''];
	for (let i = 0; i < limit; i++) {
		const slide = slides[i];
		const title = slideTitle(slide) ?? '(no title)';
		const hidden = slide.hidden ? ' [hidden]' : '';
		lines.push(`Slide ${i + 1}${hidden}: ${title} - ${elementBreakdown(slide.elements)}`);
	}
	if (limit < slides.length) {
		lines.push(`...and ${slides.length - limit} more slide(s).`);
	}
	return clampToTokenBudget(lines.join('\n'), options.maxTokens ?? 2000);
}

/**
 * Render a single slide to markdown via the core converter. Falls back to a
 * plain-text extraction if conversion fails (e.g. an exotic element). Never
 * writes to disk (uses a null filesystem) and is capped by a token budget.
 */
export async function buildSlideMarkdown(
	slides: PptxSlide[],
	slideIndex: number,
	meta: PptxAiDeckMeta,
	options: { includeSpeakerNotes?: boolean; maxTokens?: number } = {},
): Promise<string> {
	const slide = slides[slideIndex];
	if (!slide) {
		throw new Error(`Slide index ${slideIndex} out of range.`);
	}
	const data = {
		slides: [slide],
		width: meta.width,
		height: meta.height,
	} as unknown as PptxData;

	let markdown: string;
	try {
		const converter = new PptxMarkdownConverter(
			'',
			{
				sourceName: meta.title ?? 'deck.pptx',
				includeSpeakerNotes: options.includeSpeakerNotes ?? true,
				mediaFolderName: 'media',
				includeMetadata: false,
				semanticMode: true,
			},
			NULL_FS,
		);
		markdown = await converter.convert(data);
	} catch {
		markdown = fallbackSlideText(slide, slideIndex);
	}
	return clampToTokenBudget(markdown, options.maxTokens ?? 4000);
}

/** Minimal text extraction used when the markdown converter is unavailable. */
function fallbackSlideText(slide: PptxSlide, slideIndex: number): string {
	const parts = [`# Slide ${slideIndex + 1}`];
	for (const el of slide.elements) {
		if ('text' in el && typeof el.text === 'string' && el.text.trim()) {
			parts.push(el.text.trim());
		}
	}
	if (slide.notes) {
		parts.push(`> Notes: ${slide.notes}`);
	}
	return parts.join('\n\n');
}
