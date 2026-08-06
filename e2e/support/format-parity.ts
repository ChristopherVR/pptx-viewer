/**
 * Same-binding, cross-format slide comparison (.ppt vs .pptx).
 *
 * `support/parity` diffs the same deck across bindings and pairs elements by
 * the core-assigned `data-element-id`. That key is useless across formats: the
 * legacy `.ppt` importer synthesises its own part names while converting to
 * the pptx pipeline, so the twin decks carry different ids for the same shape
 * and every element would read as "not rendered at all". This helper re-keys
 * both fingerprints by their visible text (DOM index as the last resort,
 * mirroring the capture's own fallback) and then reuses the element-level diff
 * from `support/parity` unchanged, so the comparison itself stays identical to
 * the cross-binding one.
 *
 * @module e2e/support/format-parity
 */
import type { SlideFingerprint } from './fingerprint';
import { DEFAULT_TOLERANCE, diffSlides } from './parity';
import type { ParityTolerance } from './parity';

/**
 * Replace the id-based pairing keys with content-based ones, so the same
 * visible element pairs across two decks that share no `data-element-id`s.
 */
export function rekeyByContent(slide: SlideFingerprint): SlideFingerprint {
	const seen = new Map<string, number>();
	const elements = slide.elements.map((element) => {
		const base = element.text ? `text:${element.text.toLowerCase()}` : `shape:${element.index}`;
		const repeat = seen.get(base) ?? 0;
		seen.set(base, repeat + 1);
		return { ...element, key: repeat === 0 ? base : `${base}#${repeat}` };
	});
	return { ...slide, elements };
}

/**
 * Every way the `.ppt`-loaded slide disagrees with its `.pptx` twin, in the
 * same human-readable lines the cross-binding parity specs produce.
 */
export function diffFormats(
	pptxSlide: SlideFingerprint,
	pptSlide: SlideFingerprint,
	tolerance: ParityTolerance = DEFAULT_TOLERANCE,
): string[] {
	return diffSlides(rekeyByContent(pptxSlide), rekeyByContent(pptSlide), tolerance);
}
