/**
 * SmartArt decomposition - algorithmic (non-interpreted) layout dispatch.
 *
 * The legacy family-approximation path `decomposeSmartArt` falls back to when
 * there is no cached drawing and no `dgm:layoutDef` the DiagramML interpreter
 * recognises. Split out of `smartart-decompose.ts` to keep that file within
 * the project's per-file line budget.
 */

import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNode,
	SmartArtLayout,
	SmartArtLayoutType,
} from '../types';
import { getContentNodes } from './smartart-helpers';
import {
	layoutList,
	layoutProcess,
	layoutCycle,
	layoutMatrix,
	layoutPyramid,
} from './smartart-layouts';
import {
	layoutStepDownProcess,
	layoutAlternatingFlow,
	layoutDescendingProcess,
	layoutPictureAccentList,
	layoutVerticalBlockList,
	layoutGroupedList,
	layoutPyramidList,
	layoutHorizontalPictureList,
	layoutAccentProcess,
	layoutVerticalChevronList,
} from './smartart-layouts-extra';
import { layoutHierarchy, layoutRelationship } from './smartart-layouts-tree';

/** The bounding box of the SmartArt graphic frame on the slide. */
export interface DrawingBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Canonical layout-type lookup for every named SmartArt preset the viewer
 * can insert. Covers all `SmartArtLayout` variants so that SDK-created or
 * freshly-inserted diagrams that carry only a `layout` string (no
 * `resolvedLayoutType`) pick the correct geometry and algorithm.
 */
const LAYOUT_PRESET_TO_TYPE: Partial<Record<SmartArtLayout, SmartArtLayoutType>> = {
	basicBlockList: 'list',
	alternatingHexagons: 'list',
	horizontalBulletList: 'list',
	stackedList: 'list',
	tableList: 'list',
	trapezoidList: 'list',
	pictureAccentList: 'list',
	verticalBlockList: 'list',
	groupedList: 'list',
	pyramidList: 'list',
	horizontalPictureList: 'list',
	basicMatrix: 'matrix',
	basicPyramid: 'pyramid',
	invertedPyramid: 'pyramid',
	basicChevronProcess: 'chevron',
	continuousBlockProcess: 'process',
	segmentedProcess: 'process',
	upwardArrow: 'process',
	basicTimeline: 'timeline',
	bendingProcess: 'bending',
	stepDownProcess: 'process',
	alternatingFlow: 'process',
	descendingProcess: 'process',
	accentProcess: 'process',
	verticalChevronList: 'chevron',
	basicFunnel: 'funnel',
	basicCycle: 'cycle',
	basicPie: 'cycle',
	basicRadial: 'cycle',
	basicVenn: 'relationship',
	convergingRadial: 'cycle',
	linearVenn: 'relationship',
	basicTarget: 'target',
	interlockingGears: 'gear',
	hierarchy: 'hierarchy',
};

/**
 * Resolve a raw layout type string to a SmartArtLayoutType.
 * This mirrors the logic in PptxHandler.resolveSmartArtLayoutType but
 * is available without a PptxHandler instance.
 */
export function resolveLayoutFromRawType(layoutType: string | undefined): SmartArtLayoutType {
	if (!layoutType) {
		return 'unknown';
	}
	const lower = layoutType.toLowerCase();

	if (lower.includes('hierarchy') || lower.includes('org')) {
		return 'hierarchy';
	}
	if (lower.includes('cycle') || lower.includes('radial')) {
		return 'cycle';
	}
	if (
		lower.includes('process') ||
		lower.includes('chevron') ||
		lower.includes('arrow') ||
		lower.includes('stepdown') ||
		lower.includes('descend') ||
		lower.includes('accent')
	) {
		return 'process';
	}
	if (lower.includes('venn')) {
		return 'relationship';
	}
	if (lower.includes('matrix')) {
		return 'matrix';
	}
	if (lower.includes('pyramid')) {
		return 'pyramid';
	}
	if (lower.includes('funnel')) {
		return 'funnel';
	}
	if (lower.includes('target') || lower.includes('bullseye')) {
		return 'target';
	}
	if (lower.includes('gear')) {
		return 'gear';
	}
	if (lower.includes('timeline')) {
		return 'timeline';
	}
	if (
		lower.includes('list') ||
		lower.includes('block') ||
		lower.includes('grouped') ||
		lower.includes('picture')
	) {
		return 'list';
	}
	if (lower.includes('relationship')) {
		return 'relationship';
	}
	if (lower.includes('bending') || lower.includes('snake')) {
		return 'bending';
	}

	return 'unknown';
}

/**
 * Resolve the effective SmartArtLayoutType for a data model.
 *
 * Priority order:
 *   1. `resolvedLayoutType` (set by the parser from the layout-definition XML)
 *   2. Named `layout` preset (SDK-created / inserted diagrams)
 *   3. Raw `layoutType` string heuristic (legacy / unknown sources)
 */
export function resolveEffectiveLayoutType(data: PptxSmartArtData): SmartArtLayoutType {
	if (data.resolvedLayoutType && data.resolvedLayoutType !== 'unknown') {
		return data.resolvedLayoutType;
	}
	if (data.layout && LAYOUT_PRESET_TO_TYPE[data.layout]) {
		return LAYOUT_PRESET_TO_TYPE[data.layout]!;
	}
	return resolveLayoutFromRawType(data.layoutType);
}

/**
 * Heuristic layout choice when the layout type is unknown.
 *
 * Looks at the node structure to pick the most appropriate algorithm.
 */
function layoutWithHeuristic(
	nodes: PptxSmartArtNode[],
	bounds: DrawingBounds,
	themeColorMap?: Record<string, string>,
): PptxElement[] | undefined {
	const contentNodes = getContentNodes(nodes);
	if (contentNodes.length === 0) {
		return undefined;
	}

	// If any node has children, use hierarchy
	const hasChildren = contentNodes.some((n) => (n.children?.length ?? 0) > 0);
	if (hasChildren) {
		return layoutHierarchy(contentNodes, bounds, themeColorMap);
	}

	// Small number of nodes → list, larger → matrix grid for better visual
	if (contentNodes.length <= 4) {
		return layoutList(contentNodes, bounds, themeColorMap);
	}
	if (contentNodes.length <= 9) {
		return layoutMatrix(contentNodes, bounds, themeColorMap);
	}
	return layoutProcess(contentNodes, bounds, themeColorMap);
}

/**
 * Dispatch to a specific named layout algorithm when the SmartArt has
 * a concrete `layout` preset string.
 */
export function dispatchNamedLayout(
	namedLayout: string,
	nodes: PptxSmartArtNode[],
	bounds: DrawingBounds,
	themeColorMap?: Record<string, string>,
): PptxElement[] | undefined {
	switch (namedLayout) {
		case 'stepDownProcess':
			return layoutStepDownProcess(nodes, bounds, themeColorMap);
		case 'alternatingFlow':
			return layoutAlternatingFlow(nodes, bounds, themeColorMap);
		case 'descendingProcess':
			return layoutDescendingProcess(nodes, bounds, themeColorMap);
		case 'pictureAccentList':
			return layoutPictureAccentList(nodes, bounds, themeColorMap);
		case 'verticalBlockList':
			return layoutVerticalBlockList(nodes, bounds, themeColorMap);
		case 'groupedList':
			return layoutGroupedList(nodes, bounds, themeColorMap);
		case 'pyramidList':
			return layoutPyramidList(nodes, bounds, themeColorMap);
		case 'horizontalPictureList':
			return layoutHorizontalPictureList(nodes, bounds, themeColorMap);
		case 'accentProcess':
			return layoutAccentProcess(nodes, bounds, themeColorMap);
		case 'verticalChevronList':
			return layoutVerticalChevronList(nodes, bounds, themeColorMap);
		default:
			return undefined;
	}
}

/** Dispatch an algorithmic SmartArt layout by its resolved category. */
export function dispatchLayoutByType(
	layoutType: SmartArtLayoutType,
	nodes: PptxSmartArtNode[],
	containerBounds: DrawingBounds,
	effectiveThemeMap: Record<string, string> | undefined,
): PptxElement[] | undefined {
	switch (layoutType) {
		case 'list':
			return layoutList(nodes, containerBounds, effectiveThemeMap);
		case 'process':
			return layoutProcess(nodes, containerBounds, effectiveThemeMap);
		case 'cycle':
			return layoutCycle(nodes, containerBounds, effectiveThemeMap);
		case 'hierarchy':
			return layoutHierarchy(nodes, containerBounds, effectiveThemeMap);
		case 'relationship':
			return layoutRelationship(nodes, containerBounds, effectiveThemeMap);
		case 'matrix':
			return layoutMatrix(nodes, containerBounds, effectiveThemeMap);
		case 'pyramid':
			return layoutPyramid(nodes, containerBounds, effectiveThemeMap);
		default:
			// For unknown layouts, try a sensible default based on structure
			return layoutWithHeuristic(nodes, containerBounds, effectiveThemeMap);
	}
}
