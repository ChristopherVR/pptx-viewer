import type { ShapeStyle, XmlObject } from '../../types';
import { buildEffectDagTreeFromXml } from './effect-dag-containers';
import {
	extractDagGrayscale,
	extractDagBiLevel,
	extractDagLuminance,
	extractDagHsl,
	extractDagAlphaModFix,
	extractDagTint,
	extractDagDuotone,
	extractDagFillOverlay,
} from './effect-dag-specific-helpers';

/**
 * Context required by the DAG extractor — a subset of the effect codec context.
 */
export interface PptxEffectDagExtractorContext {
	emuPerPx: number;
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
	ensureArray: (value: unknown) => XmlObject[];
}

export interface IPptxEffectDagExtractor {
	extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle>;
}

/**
 * Parses `a:effectDag` elements — the DAG-based alternative to `a:effectLst`.
 *
 * The DAG can contain the same effects as effectLst (shadow, glow, blur, etc.)
 * plus additional effects: grayscale, biLevel, lum, hsl, alphaModFix, tint,
 * duotone, fillOverlay, and various alpha manipulation effects.
 *
 * This extractor:
 * 1. Delegates standard effectLst-compatible effects (shadow, glow, etc.)
 *    back to the caller via the returned partial ShapeStyle.
 * 2. Extracts DAG-specific effects into `dag*` ShapeStyle properties.
 * 3. Preserves the raw XML node for round-trip serialisation.
 */
export class PptxEffectDagExtractor implements IPptxEffectDagExtractor {
	private readonly context: PptxEffectDagExtractorContext;

	public constructor(context: PptxEffectDagExtractorContext) {
		this.context = context;
	}

	/**
	 * Extract style properties from an `a:effectDag` element on `shapeProps`.
	 * Returns an empty object if no DAG is present.
	 */
	public extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		const effectDag = childByLocalName(shapeProps, 'effectDag');
		if (!effectDag) {
			return {};
		}

		const style: Partial<ShapeStyle> = {};

		// Preserve raw XML for round-trip save
		style.effectDagXml = effectDag;

		// Typed structural tree — captures the four CT_EffectContainer nodes
		// (`a:cont`, `a:blend`, `a:xfrmEffect`, `a:relOff`) and preserves any
		// other inner effect verbatim as a raw leaf. Round-trip serialisation
		// continues to use the raw XML above; the typed tree is exposed for
		// downstream consumers and tests.
		const tree = buildEffectDagTreeFromXml(effectDag);
		if (tree) {
			style.effectDagTree = tree;
		}

		// ── Standard effectLst-compatible effects inside the DAG ──
		this.extractDagShadow(effectDag, style);
		this.extractDagInnerShadow(effectDag, style);
		this.extractDagGlow(effectDag, style);
		this.extractDagSoftEdge(effectDag, style);
		this.extractDagReflection(effectDag, style);
		this.extractDagBlur(effectDag, style);

		// ── DAG-specific effects ──
		extractDagGrayscale(effectDag, style);
		extractDagBiLevel(effectDag, style);
		extractDagLuminance(effectDag, style);
		extractDagHsl(effectDag, style);
		extractDagAlphaModFix(effectDag, style);
		extractDagTint(effectDag, style);
		extractDagDuotone(effectDag, style, this.context);
		extractDagFillOverlay(effectDag, style);
		this.extractDagFillOverlayColor(effectDag, style);

		return style;
	}

	/**
	 * Parse the `a:fillOverlay` overlay tint colour/opacity (the shared
	 * {@link extractDagFillOverlay} helper only captures the `@blend` mode). The
	 * overlay carries a full fill child (`a:solidFill` or `a:gradFill`); we read
	 * the solid colour, or the first gradient stop's colour, so the renderer can
	 * paint the tint instead of only mapping a blend mode.
	 */
	private extractDagFillOverlayColor(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const fillOverlay = dag['a:fillOverlay'] as XmlObject | undefined;
		if (!fillOverlay) {
			return;
		}

		const colorHost = fillOverlayColorHost(fillOverlay, this.context);
		if (!colorHost) {
			return;
		}

		const color = this.context.parseColor(colorHost);
		if (!color) {
			return;
		}
		style.dagFillOverlayColor = color;

		const opacity = this.context.extractColorOpacity(colorHost);
		if (typeof opacity === 'number' && Number.isFinite(opacity)) {
			style.dagFillOverlayOpacity = opacity;
		}
	}

	// ── Standard effects (same as effectLst children) ──

	private extractDagShadow(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const outerShdw = dag['a:outerShdw'] as XmlObject | undefined;
		if (!outerShdw) {
			return;
		}

		style.shadowColor = this.context.parseColor(outerShdw);
		style.shadowOpacity = this.context.extractColorOpacity(outerShdw);

		const blurRaw = parseInt(String(outerShdw['@_blurRad'] || ''), 10);
		if (Number.isFinite(blurRaw) && blurRaw >= 0) {
			style.shadowBlur = blurRaw / this.context.emuPerPx;
		}
		const distRaw = parseInt(String(outerShdw['@_dist'] || ''), 10);
		const dirRaw = parseInt(String(outerShdw['@_dir'] || ''), 10);
		const distance =
			Number.isFinite(distRaw) && distRaw >= 0 ? distRaw / this.context.emuPerPx : undefined;
		const dirDeg = Number.isFinite(dirRaw) ? dirRaw / 60000 : 0;
		const dirRad = (dirDeg * Math.PI) / 180;

		if (distance !== undefined) {
			style.shadowOffsetX = Math.round(Math.cos(dirRad) * distance * 100) / 100;
			style.shadowOffsetY = Math.round(Math.sin(dirRad) * distance * 100) / 100;
		}
		style.shadowAngle = dirDeg;
		style.shadowDistance = distance;
	}

	private extractDagInnerShadow(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const innerShdw = dag['a:innerShdw'] as XmlObject | undefined;
		if (!innerShdw) {
			return;
		}

		style.innerShadowColor = this.context.parseColor(innerShdw);
		style.innerShadowOpacity = this.context.extractColorOpacity(innerShdw);

		const blurRaw = parseInt(String(innerShdw['@_blurRad'] || ''), 10);
		if (Number.isFinite(blurRaw) && blurRaw >= 0) {
			style.innerShadowBlur = blurRaw / this.context.emuPerPx;
		}
		const distRaw = parseInt(String(innerShdw['@_dist'] || ''), 10);
		const dirRaw = parseInt(String(innerShdw['@_dir'] || ''), 10);
		const distance =
			Number.isFinite(distRaw) && distRaw >= 0 ? distRaw / this.context.emuPerPx : undefined;
		const dirDeg = Number.isFinite(dirRaw) ? dirRaw / 60000 : 0;
		const dirRad = (dirDeg * Math.PI) / 180;

		if (distance !== undefined) {
			style.innerShadowOffsetX = Math.round(Math.cos(dirRad) * distance * 100) / 100;
			style.innerShadowOffsetY = Math.round(Math.sin(dirRad) * distance * 100) / 100;
		}
	}

	private extractDagGlow(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const glow = dag['a:glow'] as XmlObject | undefined;
		if (!glow) {
			return;
		}

		style.glowColor = this.context.parseColor(glow);
		style.glowOpacity = this.context.extractColorOpacity(glow);
		const radRaw = parseInt(String(glow['@_rad'] || ''), 10);
		if (Number.isFinite(radRaw) && radRaw >= 0) {
			style.glowRadius = radRaw / this.context.emuPerPx;
		}
	}

	private extractDagSoftEdge(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const softEdge = dag['a:softEdge'] as XmlObject | undefined;
		if (!softEdge) {
			return;
		}

		const radRaw = parseInt(String(softEdge['@_rad'] || ''), 10);
		if (Number.isFinite(radRaw) && radRaw >= 0) {
			style.softEdgeRadius = radRaw / this.context.emuPerPx;
		}
	}

	private extractDagReflection(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const refl = dag['a:reflection'] as XmlObject | undefined;
		if (!refl) {
			return;
		}

		const blurRaw = parseInt(String(refl['@_blurRad'] || ''), 10);
		if (Number.isFinite(blurRaw) && blurRaw >= 0) {
			style.reflectionBlurRadius = blurRaw / this.context.emuPerPx;
		}
		const stA = parseInt(String(refl['@_stA'] || ''), 10);
		if (Number.isFinite(stA)) {
			style.reflectionStartOpacity = stA / 100000;
		}
		const endA = parseInt(String(refl['@_endA'] || ''), 10);
		if (Number.isFinite(endA)) {
			style.reflectionEndOpacity = endA / 100000;
		}
		const endPos = parseInt(String(refl['@_endPos'] || ''), 10);
		if (Number.isFinite(endPos)) {
			style.reflectionEndPosition = endPos / 100000;
		}
		const dist = parseInt(String(refl['@_dist'] || ''), 10);
		if (Number.isFinite(dist) && dist >= 0) {
			style.reflectionDistance = dist / this.context.emuPerPx;
		}
	}

	private extractDagBlur(dag: XmlObject, style: Partial<ShapeStyle>): void {
		const blur = dag['a:blur'] as XmlObject | undefined;
		if (!blur) {
			return;
		}

		const radRaw = parseInt(String(blur['@_rad'] || ''), 10);
		if (Number.isFinite(radRaw) && radRaw >= 0) {
			style.blurRadius = radRaw / this.context.emuPerPx;
		}
		const growVal = String(blur['@_grow'] || '').trim();
		if (growVal === '1' || growVal === 'true') {
			style.blurGrow = true;
		}
	}
}

/**
 * Resolve the colour-bearing node inside an `a:fillOverlay`: the `a:solidFill`
 * directly, or the first gradient stop (`a:gradFill/a:gsLst/a:gs[0]`) for a
 * gradient overlay. Returns `undefined` when neither carries a colour.
 */
function fillOverlayColorHost(
	fillOverlay: XmlObject,
	context: PptxEffectDagExtractorContext,
): XmlObject | undefined {
	const solidFill = fillOverlay['a:solidFill'] as XmlObject | undefined;
	if (solidFill) {
		return solidFill;
	}
	const gradFill = fillOverlay['a:gradFill'] as XmlObject | undefined;
	if (!gradFill) {
		return undefined;
	}
	const gsLst = gradFill['a:gsLst'] as XmlObject | undefined;
	if (!gsLst) {
		return undefined;
	}
	const stops = context.ensureArray(gsLst['a:gs']);
	return stops.length > 0 ? stops[0] : undefined;
}

function childByLocalName(xml: XmlObject, name: string): XmlObject | undefined {
	const entry = Object.entries(xml).find(([key]) => {
		const local = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
		return !key.startsWith('@_') && local === name;
	});
	return entry?.[1] as XmlObject | undefined;
}

export type { DagSpecificContext } from './effect-dag-specific-helpers';
export {
	extractDagGrayscale,
	extractDagBiLevel,
	extractDagLuminance,
	extractDagHsl,
	extractDagAlphaModFix,
	extractDagTint,
	extractDagDuotone,
	extractDagFillOverlay,
} from './effect-dag-specific-helpers';
export {
	parseEffectDagContainer,
	buildEffectDagTreeFromXml,
	serializeEffectDagContainer,
} from './effect-dag-containers';
