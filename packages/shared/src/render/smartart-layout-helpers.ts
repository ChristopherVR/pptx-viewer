/**
 * SmartArt layout engine: pure colour / style / tree / family-resolution
 * helpers shared by the React, Vue, Angular, Svelte, and Vanilla bindings.
 *
 * The colour/style/text helpers and the tree helpers now live in
 * `pptx-viewer-core` (see `smartart-layout-types.ts` for why: core cannot
 * import this package, so the interpreter that needs them moved to core, and
 * this file re-exports them so every existing import of
 * `./smartart-layout-helpers` keeps working unchanged). The named-layout /
 * resolved-type family map (`LAYOUT_FAMILY_MAP` / `resolveLayoutFamily`) is
 * only used by the legacy family-approximation path here in shared, so it
 * stays local.
 */

export {
	colour,
	nodeFill,
	nodeStroke,
	nodeTextStyle,
	nodeOpacity,
	styleShadow,
	styleStroke,
	truncate,
	fitFontSize,
	chevronPoints,
	gearPoints,
	strokeFor,
	flattenNodes,
	buildTree,
	treeWidth,
	treeDepth,
} from 'pptx-viewer-core';

export { LAYOUT_FAMILY_MAP, resolveLayoutFamily } from './smartart-layout-family-map';
