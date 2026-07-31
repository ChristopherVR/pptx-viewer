/**
 * Scale-free descriptions of what a binding actually painted.
 *
 * Comparing two bindings pixel-for-pixel fails for uninteresting reasons: the
 * demos fit the slide to their own chrome, so the same deck is rendered at a
 * different zoom in each, and every measurement is off by that factor. A
 * fingerprint removes the factor instead of fighting it.
 *
 *  - Geometry is expressed as a percentage of the stage's on-screen box, so any
 *    uniform zoom cancels out.
 *  - Type sizes are converted to on-screen pixels first, by multiplying the
 *    computed `font-size` through the CSS transforms between the text and the
 *    page, and are then expressed as a percentage of the stage's on-screen
 *    height. Normalising against the stage's *layout* box instead is the
 *    obvious approach and it is wrong: the bindings do not hang
 *    `aria-roledescription="slide"` off the same node in the scaling chain, so
 *    the same 54px title measured that way came out 37% larger in one binding
 *    purely because its stage element sits below the zoom transform rather than
 *    above it.
 *
 * What survives is exactly what should match: relative position, relative type
 * scale, and the non-metric styling (family, weight, colour, alignment).
 *
 * @module e2e/support/fingerprint
 */
import type { Page } from '@playwright/test';

/** A box as a percentage of the slide stage (x/y from the stage's top-left). */
export interface FingerprintRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Typography of the largest text-bearing node inside an element. */
export interface FingerprintType {
	/** On-screen `font-size` as a percentage of the stage's painted height. */
	sizePct: number;
	/** Lower-cased, unquoted family list. */
	family: string;
	weight: string;
	style: string;
	/** On-screen `line-height` as a percentage of stage height (0 if `normal`). */
	lineHeightPct: number;
	/** On-screen `letter-spacing` as a percentage of stage height. */
	letterSpacingPct: number;
	align: string;
	transform: string;
	decoration: string;
	/** `rgb()` / `rgba()` as computed. */
	color: string;
}

/** One rendered slide element. */
export interface ElementFingerprint {
	/** Stable identity used to pair this element with its counterpart. */
	key: string;
	/** Position in DOM order among the slide's elements. */
	index: number;
	/** Collapsed text content, capped so failure output stays readable. */
	text: string;
	rect: FingerprintRect;
	type: FingerprintType | null;
	/** Computed `background-color` of the element box. */
	background: string;
	/** Shorthand of the element's own border, if any. */
	border: string;
	opacity: number;
	/** Tag names of the element's rendering descendants, e.g. `svg`, `img`, `table`. */
	kinds: string[];
}

/** Everything measurable about the slide currently on the main canvas. */
export interface SlideFingerprint {
	/** Stage width / height, as painted. */
	aspect: number;
	elements: ElementFingerprint[];
}

/**
 * Measure the main-canvas slide.
 *
 * Runs entirely in the page so it never depends on binding internals: it walks
 * the neutral `[data-pptx-element="true"]` contract and reads computed style.
 */
export async function fingerprintSlide(page: Page): Promise<SlideFingerprint> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		if (!(stage instanceof HTMLElement)) {
			throw new Error('no slide stage on the page');
		}
		const stageRect = stage.getBoundingClientRect();

		const pct = (value: number, basis: number): number =>
			basis === 0 ? 0 : Math.round((value / basis) * 10_000) / 100;
		const px = (value: string): number => {
			const parsed = Number.parseFloat(value);
			return Number.isFinite(parsed) ? parsed : 0;
		};
		const collapse = (value: string): string => value.replace(/\s+/gu, ' ').trim();

		/**
		 * Vertical scale applied to `node` by the CSS transforms (and `zoom`)
		 * between it and the document, i.e. the factor that turns a computed
		 * `font-size` into the height it is actually painted at.
		 */
		const paintedScale = (node: Element): number => {
			let scale = 1;
			let current: Element | null = node;
			while (current && current !== document.documentElement) {
				const style = getComputedStyle(current);
				if (style.transform && style.transform !== 'none') {
					scale *= new DOMMatrixReadOnly(style.transform).d;
				}
				const zoom = Number.parseFloat(style.zoom);
				if (Number.isFinite(zoom) && zoom > 0 && zoom !== 1) {
					scale *= zoom;
				}
				current = current.parentElement;
			}
			return scale === 0 ? 1 : Math.abs(scale);
		};

		/** The descendant that actually carries text, biggest one wins. */
		const dominantTextNode = (root: Element): Element | null => {
			let best: Element | null = null;
			let bestSize = -1;
			for (const node of [root, ...root.querySelectorAll('*')]) {
				const ownsText = [...node.childNodes].some(
					(child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
				);
				if (!ownsText) {
					continue;
				}
				const size = px(getComputedStyle(node).fontSize);
				if (size > bestSize) {
					bestSize = size;
					best = node;
				}
			}
			return best;
		};

		const elements = [...document.querySelectorAll('[data-pptx-element="true"]')].filter((el) =>
			// Thumbnails reuse the element contract; keep only what is inside the
			// stage we measured.
			stage.contains(el),
		);

		const seen = new Map<string, number>();
		const measured = elements.map((el, index) => {
			const rect = el.getBoundingClientRect();
			const text = collapse(el.textContent ?? '').slice(0, 60);
			const textNode = dominantTextNode(el);
			const style = getComputedStyle(el);

			// `data-element-id` is core-assigned (e.g. `ppt/slides/slide3.xml-shape-19`)
			// and identical in every binding, so it pairs elements exactly. Text is
			// the fallback for the stages where a binding drops the attribute, and
			// the DOM index the last resort for untexted shapes.
			const elementId = el.getAttribute('data-element-id');
			const base = elementId
				? `id:${elementId}`
				: text
					? `text:${text.toLowerCase()}`
					: `shape:${index}`;
			const repeat = seen.get(base) ?? 0;
			seen.set(base, repeat + 1);

			let type: FingerprintType | null = null;
			if (textNode) {
				const ts = getComputedStyle(textNode);
				const scale = paintedScale(textNode);
				type = {
					sizePct: pct(px(ts.fontSize) * scale, stageRect.height),
					family: ts.fontFamily.toLowerCase().replaceAll('"', '').replaceAll("'", ''),
					weight: ts.fontWeight,
					style: ts.fontStyle,
					lineHeightPct:
						ts.lineHeight === 'normal' ? 0 : pct(px(ts.lineHeight) * scale, stageRect.height),
					letterSpacingPct:
						ts.letterSpacing === 'normal' ? 0 : pct(px(ts.letterSpacing) * scale, stageRect.height),
					align: ts.textAlign,
					transform: ts.textTransform,
					decoration: ts.textDecorationLine,
					color: ts.color,
				};
			}

			const kinds = [
				...new Set(
					[...el.querySelectorAll('svg, img, table, video, audio, canvas, iframe')].map((node) =>
						node.tagName.toLowerCase(),
					),
				),
			].sort();

			return {
				key: repeat === 0 ? base : `${base}#${repeat}`,
				index,
				text,
				rect: {
					x: pct(rect.x - stageRect.x, stageRect.width),
					y: pct(rect.y - stageRect.y, stageRect.height),
					width: pct(rect.width, stageRect.width),
					height: pct(rect.height, stageRect.height),
				},
				type,
				background: style.backgroundColor,
				border:
					px(style.borderTopWidth) > 0
						? `${Math.round(px(style.borderTopWidth))}px ${style.borderTopStyle} ${style.borderTopColor}`
						: 'none',
				opacity: Math.round(Number.parseFloat(style.opacity) * 100) / 100,
				kinds,
			} satisfies ElementFingerprint;
		});

		return {
			aspect:
				stageRect.height === 0 ? 0 : Math.round((stageRect.width / stageRect.height) * 1000) / 1000,
			elements: measured,
		} satisfies SlideFingerprint;
	});
}
