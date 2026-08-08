/**
 * Run-level text metrics, and the diff between two bindings' versions of them.
 *
 * `support/fingerprint` samples one "dominant" text node per element, which is
 * enough to catch a title rendered at the wrong scale but blind to everything
 * that happens *inside* a text body: a paragraph split into a different number
 * of runs, a bullet marker that is a segment in one binding and an inline glyph
 * in another, a run whose `white-space` differs, or a font fallback that only
 * one binding declares. Those are measured here, per text node.
 *
 * Two decisions make the comparison trustworthy:
 *
 *  - Runs are paired by `(data-element-id, ordinal of the text node)`, scoped
 *    under `[data-pptx-viewport]`. The id is core-assigned and identical in all
 *    five bindings; the scope is required because React and Vue strip the
 *    attribute from their thumbnail stages and the others do not.
 *  - Everything positional is converted to slide coordinates by dividing out
 *    the accumulated CSS transform scale between the text and the document, so
 *    the demos fitting the slide to their own chrome cannot register as drift.
 *
 * Font family is deliberately NOT compared as a string: the bindings' fallback
 * stacks legitimately differ. What must agree is the metric consequence, so the
 * measured advance width of the run's first characters is compared instead.
 *
 * @module e2e/support/text-runs
 */
import type { Page } from '@playwright/test';

/** One rendered run (text node) inside one element. */
export interface TextRunMetric {
	/** Position of this run among its element's runs, in DOM order. */
	ordinal: number;
	/** The run's text, zero-width fillers removed, capped for readable output. */
	text: string;
	/** The characters `advancePx` was measured over. */
	sample: string;
	whiteSpace: string;
	fontSizePx: number;
	fontWeight: string;
	fontStyle: string;
	textAlign: string;
	textTransform: string;
	decoration: string;
	/** `line-height / font-size`; `null` when the computed value is `normal`. */
	lineHeightRatio: number | null;
	/**
	 * Resolved family stack, lower-cased. Reported when an advance mismatches,
	 * never asserted: the bindings' fallback stacks legitimately differ, only
	 * their metric consequence has to agree.
	 */
	fontFamily: string;
	/** Painted advance of `sample`, in slide px. */
	advancePx: number;
	/** x of the run's first glyph relative to its element, in slide px. */
	lineStartX: number;
	/** Visual lines the run is broken across. */
	lineCount: number;
}

/** Every run of one rendered element. */
export interface ElementRunMetrics {
	elementId: string;
	/** Collapsed element text, for failure messages. */
	label: string;
	runs: TextRunMetric[];
}

/** How far two bindings may drift per property before it is a parity break. */
export const RUN_TOLERANCE = {
	/** Computed `font-size`, in CSS px. */
	fontSizePx: 0.5,
	/** `line-height / font-size`. */
	lineHeightRatio: 0.02,
	/** Painted advance of the sampled characters, in slide px. */
	advancePx: 1,
	/** First-glyph x within the element, in slide px. */
	lineStartX: 2,
} as const;

/** Characters the advance width is measured over. */
const ADVANCE_CHARS = 8;

/**
 * Measure every run on the main canvas.
 *
 * Runs entirely in the page against the neutral DOM contract, so it never
 * depends on how a binding structures its text body.
 */
export async function measureTextRuns(page: Page): Promise<ElementRunMetrics[]> {
	return page.evaluate((advanceChars) => {
		const viewport = document.querySelector('[data-pptx-viewport]');
		if (!(viewport instanceof HTMLElement)) {
			throw new Error('no [data-pptx-viewport] on the page');
		}

		/** Horizontal scale the CSS transform chain paints `node` at. */
		const paintedScaleX = (node: Element): number => {
			let scale = 1;
			let current: Element | null = node;
			while (current && current !== document.documentElement) {
				const style = getComputedStyle(current);
				if (style.transform && style.transform !== 'none') {
					scale *= new DOMMatrixReadOnly(style.transform).a;
				}
				current = current.parentElement;
			}
			return scale === 0 ? 1 : Math.abs(scale);
		};

		/**
		 * Is `node` on screen, ancestors included?
		 *
		 * The walk is the point: `opacity` does not inherit, so a run inside an
		 * `opacity-0 group-hover:opacity-100` card still computes `opacity: 1` on
		 * its own parent. React hangs exactly such a hover tooltip (the hyperlink
		 * target, plus "Active in presentation mode") inside every linked picture,
		 * and counting it would report the four bindings that draw no tooltip as
		 * having lost the slide's text.
		 */
		const isPainted = (node: Element): boolean => {
			let current: Element | null = node;
			while (current && current !== document.documentElement) {
				const style = getComputedStyle(current);
				if (style.visibility === 'hidden' || Number.parseFloat(style.opacity) === 0) {
					return false;
				}
				current = current.parentElement;
			}
			return true;
		};

		// Zero-width fillers: some bindings pad an empty line with one, which is
		// a rendering detail rather than a run the reader can see.
		const clean = (value: string): string =>
			[...value]
				.filter((ch) => ch.charCodeAt(0) !== 0x200b && ch.charCodeAt(0) !== 0xfeff)
				.join('');
		const collapse = (value: string): string => clean(value).replace(/\s+/gu, ' ').trim();

		const hosts = [
			...viewport.querySelectorAll('[data-pptx-element="true"][data-element-id]'),
		].filter(
			(host, _index, all) =>
				// Group children carry the marker too; measure the leaf that owns the
				// text so a run is never counted twice under two ids.
				!all.some((other) => other !== host && other.contains(host)),
		);

		const out: ElementRunMetrics[] = [];
		for (const host of hosts) {
			const hostBox = host.getBoundingClientRect();
			if (hostBox.width === 0 && hostBox.height === 0) {
				continue;
			}
			const scale = paintedScaleX(host);
			const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
			const runs: TextRunMetric[] = [];

			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const raw = node.textContent ?? '';
				if (!clean(raw).trim()) {
					continue;
				}
				const parent = node.parentElement;
				if (!parent) {
					continue;
				}
				let start = 0;
				while (start < raw.length && /\s/u.test(raw[start])) {
					start += 1;
				}
				const length = Math.min(advanceChars, raw.length - start);
				const range = document.createRange();
				range.setStart(node, start);
				range.setEnd(node, start + length);
				const advanceBox = range.getBoundingClientRect();
				range.setEnd(node, start + 1);
				const firstBox = range.getBoundingClientRect();
				// Only PAINTED text is compared: what the reader sees, not what the
				// DOM holds.
				if ((firstBox.width === 0 && firstBox.height === 0) || !isPainted(parent)) {
					continue;
				}
				const style = getComputedStyle(parent);

				// Visual lines: a jump in a character's rect top starts a new one.
				let lineCount = 0;
				let previousTop: number | null = null;
				for (let i = start; i < Math.min(raw.length, start + 160); i += 1) {
					range.setStart(node, i);
					range.setEnd(node, i + 1);
					const box = range.getBoundingClientRect();
					if (box.width === 0 && box.height === 0) {
						continue;
					}
					if (previousTop === null || Math.abs(box.top - previousTop) > 3) {
						lineCount += 1;
						previousTop = box.top;
					}
				}

				const fontSizePx = Number.parseFloat(style.fontSize) || 0;
				const lineHeight = Number.parseFloat(style.lineHeight);
				runs.push({
					ordinal: runs.length,
					text: collapse(raw).slice(0, 40),
					sample: raw.slice(start, start + length),
					whiteSpace: style.whiteSpace,
					fontSizePx: Math.round(fontSizePx * 100) / 100,
					fontWeight: style.fontWeight,
					fontStyle: style.fontStyle,
					textAlign: style.textAlign,
					textTransform: style.textTransform,
					decoration: style.textDecorationLine,
					lineHeightRatio:
						Number.isFinite(lineHeight) && fontSizePx > 0
							? Math.round((lineHeight / fontSizePx) * 1000) / 1000
							: null,
					fontFamily: style.fontFamily.toLowerCase().replaceAll('"', '').replaceAll("'", ''),
					advancePx: Math.round((advanceBox.width / scale) * 100) / 100,
					lineStartX: Math.round(((firstBox.left - hostBox.left) / scale) * 100) / 100,
					lineCount,
				});
			}

			if (runs.length > 0) {
				out.push({
					elementId: host.getAttribute('data-element-id') ?? '',
					label: collapse(host.textContent ?? '').slice(0, 40),
					runs,
				});
			}
		}
		return out;
	}, ADVANCE_CHARS);
}

/**
 * The visual lines of the text body containing `needle`.
 *
 * Two filters, and both are load-bearing. The element must be the INNERMOST one
 * carrying the text: a grouped shape's wrapper also matches the needle, and
 * measuring that reads every sibling shape in the group as part of the same
 * paragraph. Among those innermost matches, the LARGEST wins, because the slide
 * rail renders the same element id again at thumbnail scale.
 *
 * Where the text broke is not in the DOM: a paragraph stays one text node
 * whatever the browser did with it, and per-word spans do not sit one-per-line
 * either. So each character's client rect is taken and a new line starts
 * whenever the baseline steps down. That works identically in all five
 * bindings, which is the point: nothing here knows which one it is looking at.
 */
export async function visualLines(page: Page, needle: string): Promise<string[]> {
	return page.evaluate((marker) => {
		const matches = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].filter(
			(node) => (node.textContent ?? '').includes(marker),
		);
		const innermost = matches.filter(
			(node) => !matches.some((other) => other !== node && node.contains(other)),
		);
		let host: HTMLElement | undefined;
		let bestArea = -1;
		for (const node of innermost) {
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				host = node;
			}
		}
		if (!host) {
			return [];
		}
		const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
		const lines: string[] = [];
		let current = '';
		let previousTop: number | null = null;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node.textContent ?? '';
			const range = document.createRange();
			for (let i = 0; i < text.length; i++) {
				range.setStart(node, i);
				range.setEnd(node, i + 1);
				const rect = range.getBoundingClientRect();
				if (rect.width === 0 && rect.height === 0) {
					continue;
				}
				if (previousTop === null) {
					previousTop = rect.top;
				} else if (rect.top - previousTop > 3) {
					lines.push(current);
					current = '';
					previousTop = rect.top;
				}
				current += text[i];
			}
		}
		if (current) {
			lines.push(current);
		}
		return lines.map((line) => line.trim()).filter((line) => line.length > 0);
	}, needle);
}
