/**
 * viewer-extra-dialogs-helpers.ts: Pure helpers backing
 * {@link ViewerExtraDialogsComponent}. Kept framework-free (no Angular / DOM)
 * so the container stays a thin view + wiring layer and this logic is unit
 * testable in isolation.
 *
 * `buildEquationSegment` / `buildEquationElement` accept an optional
 * `TranslateService` so callers with access to one get translated text;
 * callers without one (e.g. plain unit tests) still get the English fallback.
 */

import type { TranslateService } from '@ngx-translate/core';
import type {
	InkPptxElement,
	PptxElement,
	PptxSlide,
	TextSegment,
	TextStyle,
} from 'pptx-viewer-core';

import type { SlideDiff } from '../internal/shared';
import { strokeToInkElement } from './ink-drawing-helpers';
import type { SlideAnnotationMap } from './presentation-annotations-helpers';

/** Font style shared by the fallback text and the equation segment. */
const EQUATION_STYLE: TextStyle = { fontSize: 18, fontFamily: 'Cambria Math' };
/** Human-visible fallback text for an equation shape. */
const EQUATION_TEXT = '[Equation]';

/**
 * Build the single equation `TextSegment` carrying the supplied OMML payload.
 * Mirrors the structure produced by `newEquationElement` / the React equation
 * insert handler so the equation renderer consumes it identically.
 */
export function buildEquationSegment(
	omml: Record<string, unknown>,
	translate?: TranslateService,
): TextSegment {
	const text = translate ? translate.instant('pptx.equation.placeholderText') : EQUATION_TEXT;
	return { text, style: EQUATION_STYLE, equationXml: omml };
}

/**
 * Build a fresh equation `shape` element (id left empty for the editor to
 * assign) whose text segment carries the supplied OMML. Matches the React
 * `handleInsertEquation` shape.
 */
export function buildEquationElement(
	omml: Record<string, unknown>,
	x = 120,
	y = 200,
	translate?: TranslateService,
): PptxElement {
	const text = translate ? translate.instant('pptx.equation.placeholderText') : EQUATION_TEXT;
	return {
		type: 'shape',
		id: '',
		name: translate ? translate.instant('pptx.ribbon.equation') : 'Equation',
		x,
		y,
		width: 400,
		height: 80,
		text,
		textStyle: EQUATION_STYLE,
		textSegments: [buildEquationSegment(omml, translate)],
	} as PptxElement;
}

/**
 * Collect the distinct font families referenced by every element on the deck,
 * scanning element-level `textStyle` and each `textSegments` entry. Used to
 * seed the font-embedding panel's "used fonts" list.
 */
export function collectUsedFontFamilies(slides: readonly PptxSlide[]): string[] {
	const families = new Set<string>();
	for (const slide of slides) {
		for (const element of slide.elements) {
			const textElement = element as {
				textStyle?: { fontFamily?: string };
				textSegments?: Array<{ style?: { fontFamily?: string } }>;
			};
			const base = textElement.textStyle?.fontFamily;
			if (base) {
				families.add(base);
			}
			for (const segment of textElement.textSegments ?? []) {
				const family = segment.style?.fontFamily;
				if (family) {
					families.add(family);
				}
			}
		}
	}
	return [...families].sort((a, b) => a.localeCompare(b));
}

/** Total stroke count across a per-slide annotation map. */
export function countAnnotationStrokes(map: SlideAnnotationMap): number {
	let count = 0;
	for (const strokes of map.values()) {
		count += strokes.length;
	}
	return count;
}

/** A presentation-ink stroke converted to an ink element on its target slide. */
export interface AnnotationInkInsert {
	slideIndex: number;
	ink: InkPptxElement;
}

/**
 * Convert every kept presentation-mode stroke into an `ink` element insert.
 * Highlighter strokes are recognised by their semi-transparent opacity.
 */
export function annotationMapToInkInserts(map: SlideAnnotationMap): AnnotationInkInsert[] {
	const inserts: AnnotationInkInsert[] = [];
	for (const [slideIndex, strokes] of map) {
		for (const stroke of strokes) {
			const ink = strokeToInkElement({
				points: stroke.points,
				color: stroke.color,
				width: stroke.width,
				tool: stroke.opacity < 1 ? 'highlighter' : 'pen',
			});
			if (ink) {
				inserts.push({ slideIndex, ink });
			}
		}
	}
	return inserts;
}

/**
 * Return a new slide array with the accepted diff applied: an `added` slide is
 * appended, a `changed`/`removed` slide adopts the incoming (`compareSlide`)
 * version at its base index. Diffs without an incoming slide are ignored.
 */
export function applyAcceptedDiff(slides: readonly PptxSlide[], diff: SlideDiff): PptxSlide[] {
	const next = [...slides];
	if (!diff.compareSlide) {
		return next;
	}
	if (diff.status === 'added') {
		next.push(diff.compareSlide);
		return next;
	}
	if (diff.baseIndex >= 0 && diff.baseIndex < next.length) {
		next[diff.baseIndex] = diff.compareSlide;
	}
	return next;
}
