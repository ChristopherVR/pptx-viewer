/**
 * The in-page measurement behind `support/fingerprint`.
 *
 * Split out of that module because the whole capture must live inside ONE
 * `page.evaluate` callback (Playwright serialises the function source, so it
 * cannot call helpers imported at module scope), and the callback plus the
 * interfaces no longer fit one file. `support/fingerprint` re-exports
 * {@link fingerprintSlide}, so callers keep importing from there.
 *
 * @module e2e/support/fingerprint-capture
 */
import type { Page } from '@playwright/test';

import type { ElementFingerprint, FingerprintType, SlideFingerprint } from './fingerprint';

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
		 * Normalise a computed style string for cross-binding comparison: collapse
		 * whitespace, replace `url(...)` payloads with their length (a data: URI
		 * would otherwise dump megabytes into a diff and differ by encoding), and
		 * round every number to one decimal so float noise does not read as drift.
		 */
		const normalizeStyle = (value: string): string => {
			if (!value || value === 'none') {
				return 'none';
			}
			return collapse(value)
				.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gu, (match) => `url(<${match.length}ch>)`)
				.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gu, (match) => {
					const parsed = Number.parseFloat(match);
					return Number.isFinite(parsed) ? String(Math.round(parsed * 10) / 10) : match;
				});
		};

		/**
		 * An origin-anchored rectangular clip (`path("M 0 0 L w 0 L w h L 0 h Z")`),
		 * in element-local px. The bindings genuinely differ in mechanism here:
		 * React sizes some boxes larger than the shape and clips them back down,
		 * while the others size the box exactly; the PAINT is identical. So a
		 * rect clip is folded into the measured geometry (the visible box is the
		 * clipped box) instead of being compared as a string, and only clips with
		 * an actual shape to them (ellipses, chevrons, ...) stay string-compared.
		 */
		const rectClipOf = (value: string): { w: number; h: number } | null => {
			const match = /^path\("M 0 0 L (?<w>[\d.]+) 0 L [\d.]+ (?<h>[\d.]+) L 0 [\d.]+ Z"\)$/u.exec(
				collapse(value),
			);
			if (!match?.groups) {
				return null;
			}
			return { w: Number.parseFloat(match.groups.w), h: Number.parseFloat(match.groups.h) };
		};

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

		/**
		 * Rotation painted onto `node`, in degrees.
		 *
		 * Composes the transform matrices from the node up to the stage (the stage
		 * zoom is a uniform scale, which contributes no angle, so this needs no
		 * scale cancellation) and then down the single-child spine below it, since
		 * some bindings rotate the marked element and others rotate an inner
		 * wrapper around the content.
		 */
		const paintedRotation = (node: Element): number => {
			let matrix = new DOMMatrixReadOnly();
			let current: Element | null = node;
			while (current && current !== stage && current !== document.documentElement) {
				const transform = getComputedStyle(current).transform;
				if (transform && transform !== 'none') {
					matrix = new DOMMatrixReadOnly(transform).multiply(matrix);
				}
				current = current.parentElement;
			}
			let inner: Element | null = node;
			for (let depth = 0; depth < 4; depth += 1) {
				inner = inner.childElementCount === 1 ? inner.firstElementChild : null;
				if (!inner) {
					break;
				}
				const transform = getComputedStyle(inner).transform;
				if (transform && transform !== 'none') {
					matrix = matrix.multiply(new DOMMatrixReadOnly(transform));
				}
			}
			const angle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
			const rounded = Math.round(angle * 10) / 10;
			// -0 and 360-wrapped angles are the same paint.
			return Object.is(rounded, -0) ? 0 : rounded;
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

			const kinds: Record<string, number> = {};
			for (const node of el.querySelectorAll('svg, img, table, video, audio, canvas, iframe')) {
				const tag = node.tagName.toLowerCase();
				kinds[tag] = (kinds[tag] ?? 0) + 1;
			}

			// Fold an origin-anchored rect clip into the visible box (see above).
			const localW = px(style.width);
			const localH = px(style.height);
			const rectClip = rectClipOf(style.clipPath);
			let visibleWidth = rect.width;
			let visibleHeight = rect.height;
			let clipPath = normalizeStyle(style.clipPath);
			if (rectClip && localW > 0 && localH > 0) {
				visibleWidth = rect.width * Math.min(1, rectClip.w / localW);
				visibleHeight = rect.height * Math.min(1, rectClip.h / localH);
				clipPath = 'none';
			}

			const side = (width: string, borderStyle: string, color: string): string =>
				px(width) > 0 ? `${Math.round(px(width))}px ${borderStyle} ${color}` : 'none';
			const borders = {
				top: side(style.borderTopWidth, style.borderTopStyle, style.borderTopColor),
				right: side(style.borderRightWidth, style.borderRightStyle, style.borderRightColor),
				bottom: side(style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor),
				left: side(style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor),
			};

			return {
				key: repeat === 0 ? base : `${base}#${repeat}`,
				index,
				text,
				rect: {
					x: pct(rect.x - stageRect.x, stageRect.width),
					y: pct(rect.y - stageRect.y, stageRect.height),
					width: pct(visibleWidth, stageRect.width),
					height: pct(visibleHeight, stageRect.height),
				},
				type,
				background: style.backgroundColor,
				border: borders.top,
				borders,
				backgroundImage: normalizeStyle(style.backgroundImage),
				boxShadow: normalizeStyle(style.boxShadow),
				filter: normalizeStyle(style.filter),
				clipPath,
				rotationDeg: paintedRotation(el),
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
