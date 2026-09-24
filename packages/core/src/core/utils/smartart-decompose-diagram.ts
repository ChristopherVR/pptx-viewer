/**
 * DiagramML interpretation step of `computeSmartArtElementsWithoutCache`:
 * split out of `smartart-decompose.ts` to keep that file under the repo's
 * file-size budget.
 *
 * Tries the legacy family-based interpreter first (`interpretSmartArtLayout`,
 * `smartart-layout-interpreter.ts`), the one every binding's live preview
 * also uses. When it declines (no recognised arrangement for the whole
 * diagram, or an aux `text` leaf that cannot cover every point), the
 * per-point engine (`smartart-engine/engine-to-result.ts`) gets a second
 * attempt: it does not pick one family-level arranger for the whole diagram,
 * but executes each layoutDef `layoutNode`'s own algorithm/constraints per
 * data point, so it can succeed on layouts (e.g. `composite` diagrams whose
 * named-slot children the legacy composite arranger cannot reach) the family
 * interpreter never engages for at all - see that module's own doc comment
 * for exactly which algorithms it covers and why it declines otherwise.
 * Both attempts share the same `interpretedLayoutToElements` bridge, so text
 * folding, per-run styling and id conventions are resolved identically
 * regardless of which one succeeded.
 */

import type { PptxElement, PptxSmartArtData, PptxSmartArtNode } from '../types';
import type { DrawingBounds } from './smartart-decompose-dispatch';
import { runEngineLayout } from './smartart-engine/engine-to-result';
import { interpretedLayoutToElements } from './smartart-interpreter-drawing-bridge';
import { interpretSmartArtLayout } from './smartart-layout-interpreter';
import { flattenNodes } from './smartart-layout-style-helpers';

/**
 * Attempt DiagramML interpretation (legacy family interpreter, then the
 * per-point engine) for `smartArtData`. Returns `undefined` when neither
 * engine understands the layout definition, so the caller keeps its
 * algorithmic family-approximation fallback.
 */
export function computeDiagramMlElements(
	smartArtData: PptxSmartArtData,
	nodes: PptxSmartArtNode[],
	containerBounds: DrawingBounds,
	palette: string[],
): PptxElement[] | undefined {
	if (!smartArtData.layoutDefinition) {
		return undefined;
	}
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
	const bulletEnabled = smartArtData.presLayoutVars?.bulletEnabled;
	if (interpreted && interpreted.nodes.length > 0) {
		return interpretedLayoutToElements(
			interpreted,
			nodes,
			containerBounds,
			bulletEnabled,
			smartArtData.connections,
		);
	}
	const engineResult = runEngineLayout(smartArtData, containerBounds, nodes, palette, style);
	if (engineResult && engineResult.nodes.length > 0) {
		return interpretedLayoutToElements(
			engineResult,
			nodes,
			containerBounds,
			bulletEnabled,
			smartArtData.connections,
		);
	}
	return undefined;
}
