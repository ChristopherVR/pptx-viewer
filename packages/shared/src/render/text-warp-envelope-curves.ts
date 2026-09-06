/**
 * Two-curve envelope maths for the WordArt "envelope" preset family
 * (inflate/deflate/can), transcribed from the OOXML `prstTxWarp` guide-formula
 * shape: PowerPoint bends text between an independent TOP curve and BOTTOM
 * curve, so a glyph's height (not just its baseline position) varies with its
 * horizontal position along the line.
 *
 * The existing `buildWarpPath` (`text-warp.ts`) only ever produced ONE curve
 * per line (the baseline), so every glyph on a line kept the same height -
 * correct for path-following presets (arch/wave/circle/...), but the visible
 * gap for envelope presets: PowerPoint's tall Inflate/Deflate shapes clearly
 * grow and shrink glyph HEIGHT across the line, not just baseline Y. This
 * module supplies the missing second curve so `text-warp-envelope-layout.ts`
 * can compute a per-glyph vertical scale + offset.
 *
 * Every preset in {@link GLYPH_ENVELOPE_PRESETS} now samples its real
 * `prstTxWarp` guide-formula path via `text-warp-preset-sampler.ts` /
 * `text-warp-preset-definitions.ts`, transcribed from
 * `presetTextWarpDefinitions.xml` (LibreOffice/core's
 * `oox/source/export/presetTextWarpDefinitions.xml`, the table LibreOffice
 * uses to write spec-conformant `prstTxWarp` XML when exporting its own
 * Fontwork shapes to `.pptx`; see that module's doc comment for the full
 * provenance note and why the free ECMA-376 text alone does not print these
 * per-preset numbers).
 *
 * The single/triple-sine-lobe functions below are kept only as the fallback
 * for a glyph-envelope preset with no transcribed definition (there are none
 * today; this exists so a future preset added to
 * {@link GLYPH_ENVELOPE_PRESETS} without also being added to
 * `WARP_PRESET_DEFINITIONS` degrades to a reasonable shape instead of a
 * crash). The one confirmed spec fact beyond the transcribed presets: per the
 * ECMA prose, PowerPoint's warp model gives EVERY `prstTxWarp` preset an
 * independent top/bottom curve pair, not just the inflate/deflate/can family
 * here - the "path" family in `text-warp.ts` (arch/wave/circle/triangle/
 * chevron/fade/slant/cascade/...) is rendered with a single shared-baseline
 * curve, a further simplification left alone here.
 */
import { sampleWarpPresetCurve } from './text-warp-preset-sampler';

/** Presets that carry an independent top/bottom envelope curve. */
export const GLYPH_ENVELOPE_PRESETS: ReadonlySet<string> = new Set([
	'textInflate',
	'textDeflate',
	'textInflateBottom',
	'textInflateTop',
	'textDeflateBottom',
	'textDeflateTop',
	'textDeflateInflate',
	'textDeflateInflateDeflate',
	'textCanUp',
	'textCanDown',
]);

/** True when `preset` should be rendered with a per-glyph two-curve envelope. */
export function hasGlyphEnvelope(preset: string | undefined): boolean {
	return Boolean(preset) && GLYPH_ENVELOPE_PRESETS.has(preset as string);
}

/** The undeformed (adj=0) top/bottom band, as a fraction of box height. */
const TOP_MARGIN = 0.15;
const BOTTOM_MARGIN = 0.85;

/** The narrowest an envelope band may collapse to (fraction of box height). */
const MIN_BAND = 0.02;

/** Default OOXML `adj1` for every envelope preset maps to intensity factor 1. */
const DEFAULT_ADJ = 18750;

function clamp4(n: number): number {
	return Math.max(0, Math.min(n, 4));
}

function clampUnit(n: number): number {
	return Math.max(0, Math.min(n, 1));
}

function intensityOf(adj: number | undefined): number {
	return adj !== undefined ? clamp4(adj / DEFAULT_ADJ) : 1;
}

/** Single hump: 0 at the edges, 1 at the horizontal centre. */
function hump(u: number): number {
	return Math.sin(Math.PI * clampUnit(u));
}

/**
 * Three alternating lobes across the line (deflate / inflate / deflate),
 * matching {@link GLYPH_ENVELOPE_PRESETS}'s `textDeflateInflateDeflate` name
 * literally: the outer thirds pinch, the middle third bulges.
 */
function tripleLobe(u: number): number {
	return Math.sin(3 * Math.PI * clampUnit(u));
}

/** Top/bottom envelope curve position, each a fraction of box height. */
export interface EnvelopeCurveFractions {
	top: number;
	bottom: number;
}

/**
 * The top/bottom envelope curve fractions at horizontal position `u` (0 = left
 * edge, 1 = right edge, 0.5 = centre) for a glyph-envelope preset.
 *
 * Returns `undefined` for a preset outside {@link GLYPH_ENVELOPE_PRESETS}.
 */
export function envelopeCurveAt(
	preset: string,
	u: number,
	adj?: number,
	adj2?: number,
): EnvelopeCurveFractions | undefined {
	if (!hasGlyphEnvelope(preset)) {
		return undefined;
	}
	const spec = sampleWarpPresetCurve(preset, u, adj, adj2);
	if (spec) {
		return clampBand(spec.top, spec.bottom);
	}

	// Fallback reconstruction: only reached for a glyph-envelope preset with
	// no transcribed definition in `WARP_PRESET_DEFINITIONS` (none today).
	const intensity = intensityOf(adj);
	const bulge = hump(u);

	let top = TOP_MARGIN;
	let bottom = BOTTOM_MARGIN;

	switch (preset) {
		case 'textInflate':
			// Both curves bow away from centre: the band is tallest mid-line.
			top -= 0.12 * intensity * bulge;
			bottom += 0.12 * intensity * bulge;
			break;
		case 'textDeflate':
			// Both curves pinch toward centre: the band is shortest mid-line.
			top += 0.1 * intensity * bulge;
			bottom -= 0.1 * intensity * bulge;
			break;
		case 'textInflateTop':
			top -= 0.16 * intensity * bulge;
			break;
		case 'textInflateBottom':
			bottom += 0.16 * intensity * bulge;
			break;
		case 'textDeflateTop':
			top += 0.14 * intensity * bulge;
			break;
		case 'textDeflateBottom':
			bottom -= 0.14 * intensity * bulge;
			break;
		case 'textDeflateInflate':
			// Top curve deflates (pinches down); bottom curve inflates (bulges
			// further down): the band shrinks toward the bottom mid-line.
			top += 0.1 * intensity * bulge;
			bottom += 0.1 * intensity * bulge;
			break;
		case 'textDeflateInflateDeflate': {
			const lobe = tripleLobe(u);
			top += 0.1 * intensity * lobe;
			bottom -= 0.1 * intensity * lobe;
			break;
		}
		case 'textCanUp': {
			// Cylindrical arc: both curves rise together; the band narrows very
			// slightly mid-line (the barrel surface tilts away from the viewer).
			const arch = 0.18 * intensity * bulge;
			const squeeze = 0.05 * intensity * bulge;
			top -= arch;
			bottom -= arch - squeeze;
			break;
		}
		case 'textCanDown': {
			const arch = 0.18 * intensity * bulge;
			const squeeze = 0.05 * intensity * bulge;
			top += arch - squeeze;
			bottom += arch;
			break;
		}
		default:
			break;
	}

	return clampBand(top, bottom);
}

/** Clamp a raw top/bottom pair to `[0, 1]` and enforce {@link MIN_BAND}. */
function clampBand(top: number, bottom: number): EnvelopeCurveFractions {
	let clampedTop = clampUnit(top);
	let clampedBottom = clampUnit(bottom);
	if (clampedBottom - clampedTop < MIN_BAND) {
		const mid = (clampedTop + clampedBottom) / 2;
		clampedTop = mid - MIN_BAND / 2;
		clampedBottom = mid + MIN_BAND / 2;
	}
	return { top: clampedTop, bottom: clampedBottom };
}

/** The undeformed band, exported so layout code can compute a stable scale=1 baseline. */
export const NOMINAL_ENVELOPE_BAND: EnvelopeCurveFractions = {
	top: TOP_MARGIN,
	bottom: BOTTOM_MARGIN,
};
