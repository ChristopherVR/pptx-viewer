/**
 * Shape Format > WordArt Styles: PowerPoint's 30 WordArt styles
 * (`TextFrame2.WordArtformat` 0-29), applied to every run of the selected
 * text-bearing element. Catalogue: `wordart-styles-catalog*.ts` (COM
 * capture); field mapping and writer limits: `wordart-run-style.ts`.
 *
 * @module render/ribbon-galleries/wordart-styles-gallery
 */
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
} from './gallery-types';
import { wordArtTileSvg } from './wordart-preview-svg';
import { wordArtBodyStyle, wordArtRunStyle } from './wordart-run-style';
import type { WordArtStyleSpec } from './wordart-style-spec';
import { WORDART_FLAT_STYLES } from './wordart-styles-catalog';
import { WORDART_BEVEL_STYLES } from './wordart-styles-catalog-3d';

/** All 30 styles, indexed by `TextFrame2.WordArtformat`. */
export const WORDART_STYLES: readonly WordArtStyleSpec[] = [
	...WORDART_FLAT_STYLES,
	...WORDART_BEVEL_STYLES,
];

const TILE = { width: 44, height: 44 };

function styleIndex(itemId: string): number | undefined {
	const match = /^wordArt-(\d+)$/u.exec(itemId);
	const index = match ? Number(match[1]) : Number.NaN;
	return index >= 0 && index < WORDART_STYLES.length ? index : undefined;
}

function isTextRun(segment: TextSegment): boolean {
	return !segment.isParagraphBreak && !segment.isLineBreak && segment.text.length > 0;
}

function near(a: number | undefined, b: number | undefined): boolean {
	return (a ?? 0) === (b ?? 0) || Math.abs((a ?? 0) - (b ?? 0)) < 0.05;
}

function same(a: string | undefined, b: string | undefined): boolean {
	return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

/** Whether `style` carries what `run` writes (fill, outline and which effects). */
function runMatches(style: TextStyle, run: Partial<TextStyle>): boolean {
	const stops = (s: Partial<TextStyle>) => (s.textFillGradientStops ?? []).map((x) => x.color);
	return (
		Boolean(style.textFillNone) === Boolean(run.textFillNone) &&
		(run.textFillGradientStops
			? same(stops(style).join(), stops(run).join())
			: run.textFillNone || same(style.color, run.color)) &&
		near(style.textOutlineWidth, run.textOutlineWidth) &&
		same(style.textOutlineColor, run.textOutlineColor) &&
		same(style.textShadowColor, run.textShadowColor) &&
		near(style.textShadowBlur, run.textShadowBlur) &&
		same(style.textInnerShadowColor, run.textInnerShadowColor) &&
		same(style.textGlowColor, run.textGlowColor) &&
		Boolean(style.textReflection) === Boolean(run.textReflection)
	);
}

function segmentsOf(element: PptxElement): TextSegment[] {
	return hasTextProperties(element) ? (element.textSegments ?? []) : [];
}

function build(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const element = ctx.element && hasTextProperties(ctx.element) ? ctx.element : null;
	const runs = element ? segmentsOf(element).filter(isTextRun) : [];
	return {
		id: 'wordArtStyles',
		labelKey: 'pptx.gallery.wordArtStyles.title',
		label: 'WordArt Styles',
		disabled: element === null,
		sections: [
			{
				id: 'styles',
				columns: 5,
				tileWidth: TILE.width,
				tileHeight: TILE.height,
				items: WORDART_STYLES.map((spec, index) => {
					const run = wordArtRunStyle(spec, ctx.themeColorMap);
					return {
						id: `wordArt-${index}`,
						labelKey: `pptx.gallery.wordArtStyles.style${index}`,
						label: spec.label,
						previewSvg: wordArtTileSvg(`gwa-${index}`, run, TILE),
						applied: runs.length > 0 && runs.every((segment) => runMatches(segment.style, run)),
					};
				}),
			},
		],
	};
}

function apply(itemId: string, ctx: RibbonGalleryContext): RibbonGalleryApplyResult | null {
	const element = ctx.element;
	const index = styleIndex(itemId);
	if (!element || !hasTextProperties(element) || index === undefined) {
		return null;
	}
	const spec = WORDART_STYLES[index];
	const run = wordArtRunStyle(spec, ctx.themeColorMap);
	const segments = element.textSegments;
	const patch: { textSegments?: TextSegment[]; textStyle: TextStyle } = {
		// The element style carries the runs too: the writer collapses uniform
		// runs and writes them from `textStyle`.
		textStyle: { ...element.textStyle, ...run, ...wordArtBodyStyle(spec) },
	};
	if (segments?.length) {
		patch.textSegments = segments.map((segment) => ({
			...segment,
			style: { ...segment.style, ...run },
		}));
	}
	return { kind: 'element', elementId: element.id, patch: patch as Partial<PptxElement> };
}

export const WORDART_STYLES_GALLERY: RibbonGalleryModule = { build, apply };
