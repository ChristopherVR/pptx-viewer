/**
 * Read-only tool executors: deck overview, per-slide markdown + element
 * inventory, single-element inspection, speaker notes, text search, and theme.
 * None of these mutate the deck, so they bypass the write-policy router.
 */

import { ThemePresets } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import { buildDeckOutline, buildSlideMarkdown } from '../context';
import type { AiToolContext, AiToolExecutor } from './executor-base';
import { requireSlide } from './executor-base';

/** Compact inventory record for one element: id, type, bounds, z-order. */
function inventory(elements: PptxElement[]): Record<string, unknown>[] {
	return elements.map((el, z) => ({
		id: el.id,
		type: el.type,
		x: Math.round(el.x),
		y: Math.round(el.y),
		width: Math.round(el.width),
		height: Math.round(el.height),
		z,
		...(el.hidden ? { hidden: true } : {}),
		...('text' in el && typeof el.text === 'string' && el.text
			? { text: el.text.slice(0, 120) }
			: {}),
	}));
}

const getDeckOverview: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { maxSlides?: number };
	const meta = ctx.bridge.getDeckMeta();
	const outline = buildDeckOutline(ctx.bridge.getSlides(), meta, { maxSlides: p.maxSlides });
	return { meta, outline };
};

const getSlide: AiToolExecutor = async (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number };
	const slides = ctx.bridge.getSlides();
	const slide = requireSlide(slides, p.slideIndex);
	const markdown = await buildSlideMarkdown(slides, p.slideIndex, ctx.bridge.getDeckMeta());
	return { slideIndex: p.slideIndex, markdown, elements: inventory(slide.elements) };
};

const getElement: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; elementId: string };
	const slide = requireSlide(ctx.bridge.getSlides(), p.slideIndex);
	const el = slide.elements.find((e) => e.id === p.elementId);
	if (!el) {
		throw new Error(`Element '${p.elementId}' not found on slide ${p.slideIndex}.`);
	}
	return el;
};

const getSpeakerNotes: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number };
	const slide = requireSlide(ctx.bridge.getSlides(), p.slideIndex);
	return { slideIndex: p.slideIndex, notes: slide.notes ?? '' };
};

/** Build a safe search regex, rejecting oversized / nested-quantifier patterns. */
function searchRegex(query: string, useRegex: boolean, caseSensitive: boolean): RegExp | null {
	if (useRegex && (query.length > 200 || /\([^)]*[+*]\)[+*]/u.test(query))) {
		return null;
	}
	const source = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	try {
		return new RegExp(source, caseSensitive ? 'g' : 'gi');
	} catch {
		return null;
	}
}

const findText: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { query: string; useRegex?: boolean; caseSensitive?: boolean };
	const regex = searchRegex(p.query, p.useRegex === true, p.caseSensitive === true);
	const matches: { slideIndex: number; elementId: string; text: string }[] = [];
	if (!regex) {
		return { query: p.query, matchCount: 0, matches };
	}
	ctx.bridge.getSlides().forEach((slide, slideIndex) => {
		for (const el of slide.elements) {
			if ('text' in el && typeof el.text === 'string' && regex.test(el.text)) {
				matches.push({ slideIndex, elementId: el.id, text: el.text.slice(0, 120) });
			}
			regex.lastIndex = 0;
		}
		if (slide.notes && regex.test(slide.notes)) {
			matches.push({ slideIndex, elementId: 'notes', text: slide.notes.slice(0, 120) });
		}
		regex.lastIndex = 0;
	});
	return { query: p.query, matchCount: matches.length, matches };
};

const getTheme: AiToolExecutor = (ctx: AiToolContext) => {
	const theme = ctx.bridge.getTheme();
	return {
		name: theme?.name,
		colorScheme: theme?.colorScheme,
		fontScheme: theme?.fontScheme,
		availablePresets: Object.keys(ThemePresets),
	};
};

/** Read-only executors keyed by tool name. */
export const readExecutors = {
	get_deck_overview: getDeckOverview,
	get_slide: getSlide,
	get_element: getElement,
	get_speaker_notes: getSpeakerNotes,
	find_text: findText,
	get_theme: getTheme,
} satisfies Record<string, AiToolExecutor>;
