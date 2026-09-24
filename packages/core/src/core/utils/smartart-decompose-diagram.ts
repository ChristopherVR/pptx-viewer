/**
 * DiagramML interpretation step of `computeSmartArtElementsWithoutCache`:
 * split out of `smartart-decompose.ts` to keep that file under the repo's
 * file-size budget.
 *
 * Runs the legacy family-based interpreter (`interpretSmartArtLayout`,
 * `smartart-layout-interpreter.ts`, the one every binding's live preview
 * also uses) and the per-point engine (`smartart-engine/engine-to-result.ts`,
 * which does not pick one family-level arranger for the whole diagram but
 * executes each layoutDef `layoutNode`'s own algorithm/constraints per data
 * point) in a measured priority order, trying the SECOND one only when the
 * first declines (no recognised arrangement for the whole diagram, an aux
 * `text` leaf that cannot cover every point, or an unimplemented per-point
 * algorithm - see each module's own doc comment).
 *
 * For most `layoutDefinition.uniqueId`s legacy runs first, since it is the
 * more mature interpreter overall. `ENGINE_FIRST_LAYOUT_IDS`
 * (`smartart-engine/engine-first-allowlist.ts`) lists the specific layouts
 * where `scripts/measure-smartart-engine-vs-legacy.ts` measured the engine
 * as strictly more accurate on every dataset fixture with no shape-set
 * loss (e.g. `gear1`/"Gear": legacy 76% deviation vs. engine 0.1%, because
 * the legacy composite arranger cannot reach Gear's rotated/decorative
 * named-slot children at all) - those try the engine first instead, still
 * falling back to legacy if the engine declines for a specific instance.
 * Both attempts share the same `interpretedLayoutToElements` bridge, so text
 * folding, per-run styling and id conventions are resolved identically
 * regardless of which one succeeded.
 */

import type { PptxElement, PptxSmartArtData, PptxSmartArtNode } from '../types';
import type { DrawingBounds } from './smartart-decompose-dispatch';
import { ENGINE_FIRST_LAYOUT_IDS } from './smartart-engine/engine-first-allowlist';
import { runEngineLayout } from './smartart-engine/engine-to-result';
import { interpretedLayoutToElements } from './smartart-interpreter-drawing-bridge';
import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import { flattenNodes } from './smartart-layout-style-helpers';
import type { SmartArtLayoutResult } from './smartart-layout-types';

function tryLegacy(
	smartArtData: PptxSmartArtData & {
		layoutDefinition: NonNullable<PptxSmartArtData['layoutDefinition']>;
	},
	nodes: PptxSmartArtNode[],
	containerBounds: DrawingBounds,
	palette: string[],
): SmartArtLayoutResult | undefined {
	const flat = flattenNodes(nodes);
	const style = smartArtData.style ?? 'flat';
	const interpreted = interpretSmartArtLayout({
		layoutDefinition: smartArtData.layoutDefinition,
		nodes,
		flat,
		box: { width: containerBounds.width, height: containerBounds.height },
		palette,
		style,
		elementId: 'smartart-fabrication',
		presLayoutVars: smartArtData.presLayoutVars,
		colorRoles: smartArtData.colorTransform?.roleColors,
		connections: smartArtData.connections,
		fontName: smartArtData.themeMinorFont,
	});
	return interpreted && interpreted.nodes.length > 0 ? interpreted : undefined;
}

function tryEngine(
	smartArtData: PptxSmartArtData,
	nodes: PptxSmartArtNode[],
	containerBounds: DrawingBounds,
	palette: string[],
): SmartArtLayoutResult | undefined {
	const style = smartArtData.style ?? 'flat';
	const engineResult = runEngineLayout(smartArtData, containerBounds, nodes, palette, style);
	return engineResult && engineResult.nodes.length > 0 ? engineResult : undefined;
}

/**
 * Attempt DiagramML interpretation (legacy family interpreter and the
 * per-point engine, in the priority order `ENGINE_FIRST_LAYOUT_IDS`
 * decides) for `smartArtData`. Returns `undefined` when neither engine
 * understands the layout definition, so the caller keeps its algorithmic
 * family-approximation fallback.
 */
export function computeDiagramMlElements(
	smartArtData: PptxSmartArtData,
	nodes: PptxSmartArtNode[],
	containerBounds: DrawingBounds,
	palette: string[],
): PptxElement[] | undefined {
	const layoutDefinition = smartArtData.layoutDefinition;
	if (!layoutDefinition) {
		return undefined;
	}
	const withDef = smartArtData as PptxSmartArtData & { layoutDefinition: typeof layoutDefinition };
	const engineFirst =
		layoutDefinition.uniqueId !== undefined &&
		ENGINE_FIRST_LAYOUT_IDS.has(layoutDefinition.uniqueId);

	const first = engineFirst
		? tryEngine(smartArtData, nodes, containerBounds, palette)
		: tryLegacy(withDef, nodes, containerBounds, palette);
	const second = () =>
		engineFirst
			? tryLegacy(withDef, nodes, containerBounds, palette)
			: tryEngine(smartArtData, nodes, containerBounds, palette);
	const interpreted = first ?? second();
	if (!interpreted) {
		return undefined;
	}
	return interpretedLayoutToElements(
		interpreted,
		nodes,
		containerBounds,
		smartArtData.presLayoutVars?.bulletEnabled,
		smartArtData.connections,
	);
}
