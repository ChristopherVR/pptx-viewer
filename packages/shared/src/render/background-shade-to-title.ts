/**
 * Legacy PowerPoint 97-2003 "shade to title colour" background effect.
 *
 * `<p:bgPr shadeToTitle="1">` (ECMA-376 Part 1, Section 19.3.1.2,
 * `CT_BackgroundProperties`) marks a slide's background gradient to shade
 * toward the title placeholder. It was exposed in the PowerPoint 97-2003
 * "Background" dialog's two-colour shaded-fill picker as a "Shade to title
 * color" checkbox; no PowerPoint version since 2007 exposes a UI control that
 * writes it, and it has never been observed in this project's real-world
 * corpus (see `docs/guide/limitations.md`).
 *
 * COM-measured ground truth (2026-09-06, PowerPoint 2016 x64, via a hand-built
 * two-stop `<a:gradFill>` blue(0%)/green(100%) linear gradient plus a real
 * `ctrTitle` placeholder, `Slide.Export` PNG diffed pixel-by-pixel, then a
 * finer 40-sample scan along both axes): the name is misleading. PowerPoint
 * does NOT recolour any stop toward the title's text colour (an earlier
 * implementation's guess, disproven by the first coarse measurement).
 * Instead it converts the fill into a rectangular *path* gradient (like
 * authoring "Shading style: From center" but with a rectangle instead of an
 * ellipse) whose inner box is the title placeholder's OWN bounding rectangle
 * (not some inset/padded variant of it) and whose ORIGINAL stop colours are
 * preserved unchanged: the gradient's first stop fills the title box, the
 * last stop reaches the slide's outer edges, with a smooth ramp between.
 *
 * On a 960x540pt slide with a `ctrTitle` at fractions l=0.125, t=0.16366,
 * r=0.875, b=0.51181 (`Title.Left/.Top/.Width/.Height` over
 * `PageSetup.SlideWidth/Height`), a 40-sample fine scan of the exported PNG
 * found the rendered gradient pure (matching the inner stop colour exactly)
 * across x in [0.150, 0.850] and y in [0.175, 0.500], and pure again (matching
 * the outer stop) at every slide edge, with a monotonic ramp in between whose
 * measured half-pixel-accurate boundary sits at the title's own edge in every
 * one of the four directions (the small asymmetry that made an earlier,
 * coarser reading look like a *different* inner rectangle was 0.025-fraction
 * quantization noise from an 11-point grid sample, not a real offset).
 * Because the title sits high and roughly centred, the ramp above and beside
 * it is a thin band while the ramp below it (title bottom at 0.512, slide
 * bottom at 1.0) is a wide, gradual one; that asymmetry falls straight out of
 * treating each of the four edges independently (see
 * {@link computeShadeToTitleFillToRect} and `path-gradient-rect.ts`), not from
 * any special-cased "different formula for the bottom" - moving the title
 * (re-measured, not a fixed legacy-template constant) moves the same
 * lopsided shape with it. PowerPoint did not repair the file and the
 * shape/slide counts were unchanged with the flag on or off.
 *
 * This module reproduces that field exactly, reusing the same nested-rect
 * band engine `svg-gradient-rect-path.ts` / `path-gradient-rect.ts` already
 * use for a shape's own `a:path type="rect"` gradient: the slide plays the
 * role of "the shape", and the title placeholder's bounds (expressed as
 * `RectPathGradientFillToRect` insets of the SLIDE) play the role of
 * `a:fillToRect`. No new rendering primitive was needed, only a title-bounds
 * -> `fillToRect` conversion ({@link computeShadeToTitleFillToRect}) and a way
 * to recover the gradient's stop colours from the CSS string
 * `PptxSlide.backgroundGradient` already carries
 * ({@link parseGradientCssStops}): core stores the resolved background
 * gradient only as a finished CSS `linear-gradient()` / `radial-gradient()`
 * string (see `PptxGradientStyleCodec.extractGradientFillCss`), not as
 * structured stops, so this module parses its own project's deterministic
 * `<color> <position>%` token shape back out rather than widen the core model
 * for a legacy flag no real-world deck has ever been seen to use.
 *
 * Inheritance behaviour, COM-verified (2026-09-06, PowerPoint 2016 x64): this
 * only finds a title when the SLIDE's own XML carries a title/ctrTitle
 * placeholder shape (`resolveShadeToTitleRect` reads `PptxSlide.elements`,
 * where placeholder geometry inherited from the layout/master is already
 * resolved onto the slide's own shape - see
 * `PptxHandlerRuntimeShapeParsing.ts`'s `findPlaceholderContext` merge). That
 * is not an approximation this project accepted: a slide that relies on the
 * layout's title purely by NOT defining a title shape at all renders the
 * plain, unanchored gradient IN REAL POWERPOINT TOO. Three decks were built
 * from a real-world corpus fixture (`themed-layout-placeholders.pptx`) and
 * `Slide.Export`-ed to PNG: (1) a slide with no shapes of its own, pointed at
 * a "Title Slide" layout whose `ctrTitle` carries its own layout-level
 * `<a:xfrm>` distinct from the master's; (2) a slide with no shapes of its
 * own, pointed at the "Blank" layout, which defines no title anywhere and
 * whose master only has a `title` (no `ctrTitle`); (3) a baseline slide that
 * keeps its own `title` placeholder shape. A pixel scan (20-sample rows and
 * columns) found (1) and (2) byte-identical to each other and to the same
 * gradient with `shadeToTitle` OFF: a plain axis-aligned ramp, x-invariant
 * along a horizontal scan, that only LOOKS non-linear because of the
 * fixture's `<a:lin scaled="1">` (scaling a linear gradient to a non-square
 * region warps the ramp's rate but not its shape). (3) diverges from that
 * exact same baseline at the same coordinates once the slide owns a title
 * shape, confirming the anchoring only engages then. In short: core's
 * layout/master element extraction (`PptxHandlerRuntimeLayoutElements.ts`)
 * deliberately excludes placeholder shapes from the elements it returns (they
 * only feed placeholder-default/style inheritance), so no layout-only title's
 * geometry is reachable from a `PptxSlide` at all - and that is correct,
 * because PowerPoint's own renderer does not consult the layout or master
 * for this effect either. See `docs/guide/limitations.md`.
 *
 * Pure, framework-agnostic, and consumed by every binding through
 * {@link getSlideBackgroundStyle} in `slide-background.ts` (see CLAUDE.md
 * Rule 2).
 *
 * @module render/background-shade-to-title
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { RectPathGradientFillToRect, RectPathGradientStop } from './path-gradient-rect';
import { buildRectPathGradientImage } from './path-gradient-rect';

/** Placeholder types PowerPoint treats as the slide's title. */
const TITLE_PLACEHOLDER_TYPES = new Set(['title', 'ctrtitle']);

function isTitlePlaceholder(element: PptxElement): boolean {
	const type = element.placeholderType;
	return typeof type === 'string' && TITLE_PLACEHOLDER_TYPES.has(type.trim().toLowerCase());
}

/** A title placeholder's bounds, in the same slide-relative px space as every `PptxElement`. */
export interface TitlePlaceholderRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Find the slide's own title/ctrTitle placeholder and return its bounds, or
 * `undefined` when the slide carries no title placeholder shape (see the
 * module docstring's "known residual gap") or that shape has no usable size.
 */
export function resolveShadeToTitleRect(
	slide: PptxSlide | undefined,
): TitlePlaceholderRect | undefined {
	const title = (slide?.elements ?? []).find(isTitlePlaceholder);
	if (!title || !(title.width > 0) || !(title.height > 0)) {
		return undefined;
	}
	return { x: title.x, y: title.y, width: title.width, height: title.height };
}

function clampUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Convert a title placeholder's px bounds into the `RectPathGradientFillToRect`
 * insets `path-gradient-rect.ts`'s band engine expects, treating the whole
 * SLIDE as the "shape" the gradient fills (see the module docstring). Returns
 * `undefined` for a non-positive slide size.
 */
export function computeShadeToTitleFillToRect(
	title: TitlePlaceholderRect,
	slideWidthPx: number,
	slideHeightPx: number,
): RectPathGradientFillToRect | undefined {
	if (!(slideWidthPx > 0) || !(slideHeightPx > 0)) {
		return undefined;
	}
	return {
		l: clampUnit(title.x / slideWidthPx),
		t: clampUnit(title.y / slideHeightPx),
		r: clampUnit(1 - (title.x + title.width) / slideWidthPx),
		b: clampUnit(1 - (title.y + title.height) / slideHeightPx),
	};
}

/** Matches one `<colour> <position>%` gradient stop token (see {@link parseGradientCssStops}). */
const GRADIENT_STOP_TOKEN = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s+(-?[\d.]+)%/gu;

function toHexChannel(value: number): string {
	return Math.min(255, Math.max(0, Math.round(value)))
		.toString(16)
		.padStart(2, '0');
}

/** Parse one matched colour token (`#RRGGBB`/`#RGB` or `rgba(r, g, b, a)`) into a stop's colour/opacity. */
function parseStopColor(token: string): { color: string; opacity?: number } {
	if (token.startsWith('#')) {
		const hex = token.slice(1);
		const expanded =
			hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex.slice(0, 6);
		return { color: `#${expanded.toLowerCase()}` };
	}
	const channels = (token.match(/[\d.]+/gu) ?? []).map(Number);
	const [r = 0, g = 0, b = 0, alpha] = channels;
	const color = `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
	return typeof alpha === 'number' && Number.isFinite(alpha)
		? { color, opacity: alpha }
		: { color };
}

/**
 * Recover a gradient's colour stops from the finished CSS string
 * `PptxSlide.backgroundGradient` carries.
 *
 * Not a general CSS gradient parser: this project's own
 * `PptxGradientStyleCodec.buildGradientCssFromStops` is the only producer of
 * that string, and it always emits stops as `<colour> <position>%` tokens
 * (`#rrggbb` or `rgba(r, g, b, a)` colours) in gradient order regardless of
 * `linear-gradient(...)` / `radial-gradient(...)` wrapping, so matching that
 * exact shape back out is reliable here even though it would not be for
 * arbitrary author-supplied CSS. The direction/shape keywords the gradient
 * function itself carries (angle, `at 50% 50%`, ...) are intentionally
 * discarded: PowerPoint's `shadeToTitle` effect replaces the gradient's
 * geometry entirely and keeps only its stop colours (see module docstring).
 */
export function parseGradientCssStops(css: string): RectPathGradientStop[] {
	const stops: RectPathGradientStop[] = [];
	for (const match of css.matchAll(GRADIENT_STOP_TOKEN)) {
		const position = Number.parseFloat(match[2]);
		if (!Number.isFinite(position)) {
			continue;
		}
		stops.push({ position, ...parseStopColor(match[1]) });
	}
	return stops;
}

/**
 * Build the anchored rect-path gradient's `background-image` CSS value for a
 * slide flagged `shadeToTitle`, or `undefined` when the effect does not apply:
 * no gradient background, no title placeholder shape on the slide (COM-verified
 * to match real PowerPoint, which does not fall back to a layout- or
 * master-inherited title either - see the module docstring), or the caller
 * could not supply the slide's pixel size (a binding not yet updated to pass
 * one - see `getSlideBackgroundStyle`). Callers should keep rendering
 * `slide.backgroundGradient` unchanged in every one of those cases.
 */
export function resolveShadeToTitleBackgroundImage(
	slide: PptxSlide | undefined,
	slideWidthPx: number | undefined,
	slideHeightPx: number | undefined,
): string | undefined {
	if (!slide?.backgroundShadeToTitle || !slide.backgroundGradient) {
		return undefined;
	}
	if (!slideWidthPx || !slideHeightPx) {
		return undefined;
	}
	const titleRect = resolveShadeToTitleRect(slide);
	if (!titleRect) {
		return undefined;
	}
	const fillToRect = computeShadeToTitleFillToRect(titleRect, slideWidthPx, slideHeightPx);
	if (!fillToRect) {
		return undefined;
	}
	const stops = parseGradientCssStops(slide.backgroundGradient);
	if (stops.length === 0) {
		return undefined;
	}
	return buildRectPathGradientImage(stops, undefined, fillToRect);
}
