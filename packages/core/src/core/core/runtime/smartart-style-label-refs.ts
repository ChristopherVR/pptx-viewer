/**
 * Resolve a SmartArt quick-style label's `a:lnRef`/`a:fillRef`/`a:effectRef`/
 * `a:fontRef` against the theme's `fmtScheme`/font scheme (G13, the 2026-09
 * diagram audit), instead of the coarse subtle/moderate/intense enum
 * ({@link resolveSmartArtEffectIntensity}). Reuses the SAME theme-ref
 * resolvers an ordinary shape's `p:style` already goes through
 * (`PptxHandlerRuntimeThemeRefResolution.ts`), via a small deps bundle bound
 * to the calling runtime instance - so a newly-synthesized SmartArt node
 * (the edit/insert path with no cached `dsp:drawing` shape to fall back on)
 * gets the theme's EXACT colour/line/font instead of an intensity heuristic.
 *
 * Split out of `PptxHandlerRuntimeSmartArtParsing.ts` (already at the repo's
 * per-file line budget) rather than growing that file further.
 *
 * The per-LABEL `scene3d`/`sp3d` (and therefore `dgm:prSet/@coherent3DOff`,
 * which only matters when a coherent-3D variation is actually applied) are
 * deliberately NOT resolved here: PowerPoint bakes each label's fully
 * resolved `sp3d` onto every cached shape's own `dsp:spPr/a:sp3d`
 * (`PptxSmartArtDrawingShape.shape3d`), so re-deriving it from the label ref
 * would be redundant. `coherent3DOff` itself is still parsed and preserved
 * per-node (`PptxSmartArtNode.coherent3DOff`, resolved in
 * `smartart-node-style-role.ts`).
 *
 * The WHOLE-DIAGRAM `dgm:styleDef/dgm:scene3d` (the top-level scene3d, not a
 * per-label one) IS resolved here, onto {@link PptxSmartArtQuickStyle.scene3d}:
 * it has no per-shape equivalent to fall back on, and the "Scene" quick
 * styles (Brick, Flat, Metallic, Sunset, Bird's Eye) render the whole diagram
 * through this one camera (the 3D SmartArt renderer's consumer for it).
 *
 * @module smartart-style-label-refs
 */

import type {
	Pptx3DScene,
	PptxSmartArtQuickStyle,
	PptxSmartArtQuickStyleLabel,
	PptxSmartArtResolvedStyleRef,
	ShapeStyle,
	XmlObject,
} from '../../types';
import {
	parseSmartArtDefinitionMetadata,
	parseSmartArtQuickStyleLabels,
	parseSmartArtStyleLabelRefs,
} from '../../utils/smartart-definition-metadata';
import type { SmartArtEffectIntensity } from '../../utils/smartart-effect-intensity';
import { resolveSmartArtEffectIntensity } from '../../utils/smartart-effect-intensity';
import { parsePptx3DScene } from '../builders/shape-style-3d-helpers';

type LocalName = (key: string) => string;

/** The theme-ref resolvers this module needs, bound to a runtime instance. */
export interface SmartArtStyleLabelThemeDeps {
	resolveThemeFillRef: (refNode: XmlObject, style: ShapeStyle) => void;
	resolveThemeLineRef: (refNode: XmlObject, style: ShapeStyle) => void;
	resolveThemeEffectRef: (refNode: XmlObject, style: ShapeStyle) => void;
	/** `a:fontRef/@idx` ("major"/"minor") -> the theme's actual typeface, or `undefined`. */
	resolveThemeTypeface: (typeface: string | undefined) => string | undefined;
}

const RESOLVED_FILL_MODES = new Set(['solid', 'gradient', 'pattern', 'none', 'theme']);

/** Resolve one label's `dgm:style` refs into a plain fill/stroke/shadow/font summary. */
function resolveLabelStyle(
	raw: XmlObject,
	localName: LocalName,
	deps: SmartArtStyleLabelThemeDeps,
): PptxSmartArtResolvedStyleRef | undefined {
	const refs = parseSmartArtStyleLabelRefs(raw, localName);
	if (!refs) {
		return undefined;
	}
	const style: ShapeStyle = {};
	if (refs.fillRef) {
		deps.resolveThemeFillRef(refs.fillRef, style);
	}
	if (refs.lnRef) {
		deps.resolveThemeLineRef(refs.lnRef, style);
	}
	if (refs.effectRef) {
		deps.resolveThemeEffectRef(refs.effectRef, style);
	}
	const fontRefIdx = String(refs.fontRef?.['@_idx'] ?? '').toLowerCase();
	const fontTypeface = fontRefIdx
		? deps.resolveThemeTypeface(fontRefIdx.includes('minor') ? '+mn-lt' : '+mj-lt')
		: undefined;

	const resolved: PptxSmartArtResolvedStyleRef = {
		...(style.fillColor !== undefined ? { fillColor: style.fillColor } : {}),
		...(style.fillMode && RESOLVED_FILL_MODES.has(style.fillMode)
			? { fillMode: style.fillMode as PptxSmartArtResolvedStyleRef['fillMode'] }
			: {}),
		...(style.strokeColor !== undefined ? { strokeColor: style.strokeColor } : {}),
		...(style.strokeWidth !== undefined ? { strokeWidth: style.strokeWidth } : {}),
		...(style.shadowColor !== undefined ? { shadowColor: style.shadowColor } : {}),
		...(fontTypeface ? { fontTypeface } : {}),
	};
	return Object.keys(resolved).length > 0 ? resolved : undefined;
}

/**
 * Attach each label's theme-resolved style (G13) and compute the quick
 * style's overall effect intensity (the existing coarse enum, kept for
 * backward-compatible consumers), from the RAW `dgm:styleLbl` XML list
 * (`styleLbls`; same names as `labels`, matched by `@_name` rather than
 * position so a producer's own ordering never matters).
 */
function enrichSmartArtQuickStyleLabels(
	labels: PptxSmartArtQuickStyleLabel[] | undefined,
	styleLbls: XmlObject[],
	localName: LocalName,
	deps: SmartArtStyleLabelThemeDeps,
): {
	effectIntensity: SmartArtEffectIntensity | undefined;
	labels: PptxSmartArtQuickStyleLabel[] | undefined;
} {
	const effectIntensity = resolveSmartArtEffectIntensity(styleLbls, localName);
	if (!labels || labels.length === 0) {
		return { effectIntensity, labels };
	}
	const rawByName = new Map<string, XmlObject>();
	for (const raw of styleLbls) {
		const name = String(raw['@_name'] ?? '');
		if (name && !rawByName.has(name)) {
			rawByName.set(name, raw);
		}
	}
	const enriched = labels.map((label) => {
		const raw = rawByName.get(label.name);
		const resolvedStyle = raw ? resolveLabelStyle(raw, localName, deps) : undefined;
		return resolvedStyle ? { ...label, resolvedStyle } : label;
	});
	return { effectIntensity, labels: enriched };
}

/**
 * Find the styleDef's OWN direct `dgm:scene3d` child, not one nested inside a
 * `dgm:styleLbl` (each label carries its own, unrelated, per-label scene3d).
 */
function findWholeDiagramScene3d(
	styleDef: XmlObject,
	localName: LocalName,
): Pptx3DScene | undefined {
	const key = Object.keys(styleDef).find((candidate) => localName(candidate) === 'scene3d');
	const node = key ? styleDef[key] : undefined;
	if (!node || typeof node !== 'object' || Array.isArray(node)) {
		return undefined;
	}
	return parsePptx3DScene(node as XmlObject);
}

/**
 * Build a `PptxSmartArtQuickStyle` from an already-resolved `dgm:styleDef`
 * XML element, including G13's theme-resolved per-label styles. Moved here
 * (out of `PptxHandlerRuntimeSmartArtParsing.ts`) so that file's own
 * `parseSmartArtQuickStyle` stays a thin relationship-part loader.
 */
export function buildSmartArtQuickStyle(
	styleDef: XmlObject,
	localName: LocalName,
	styleLbls: XmlObject[],
	deps: SmartArtStyleLabelThemeDeps,
): PptxSmartArtQuickStyle {
	const metadata = parseSmartArtDefinitionMetadata(styleDef, localName);
	const labels = parseSmartArtQuickStyleLabels(styleDef, localName);
	const name =
		metadata.titles?.[0]?.value ||
		String(styleDef['@_title'] || styleDef['@_uniqueId'] || '').trim() ||
		undefined;
	const { effectIntensity, labels: enrichedLabels } = enrichSmartArtQuickStyleLabels(
		labels,
		styleLbls,
		localName,
		deps,
	);
	const scene3d = findWholeDiagramScene3d(styleDef, localName);
	return {
		...metadata,
		name,
		effectIntensity,
		labels: enrichedLabels,
		...(scene3d ? { scene3d } : {}),
	};
}
