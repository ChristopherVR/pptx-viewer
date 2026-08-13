/**
 * SmartArt layout engine — named-layout / resolved-type -> LayoutFamily maps.
 *
 * Split out of `smartart-layout-helpers` (which was pushing past the 300-LOC
 * ceiling) and re-exported from it, so every existing import site is unchanged.
 * Pure data + one pure selector; no framework code.
 */

import type { PptxSmartArtNode, SmartArtLayout, SmartArtLayoutType } from 'pptx-viewer-core';

import type { LayoutFamily } from './smartart-layout-types';

/** Canonical mapping of SmartArt named layouts → LayoutFamily. */
export const LAYOUT_FAMILY_MAP: Partial<Record<SmartArtLayout, LayoutFamily>> = {
	basicBlockList: 'list',
	alternatingHexagons: 'list',
	horizontalBulletList: 'list',
	stackedList: 'list',
	tableList: 'list',
	trapezoidList: 'list',
	verticalBlockList: 'list',
	groupedList: 'list',
	pyramidList: 'list',

	basicChevronProcess: 'process',
	continuousBlockProcess: 'process',
	segmentedProcess: 'process',
	upwardArrow: 'process',
	basicTimeline: 'timeline',
	bendingProcess: 'bending',
	stepDownProcess: 'process',
	alternatingFlow: 'process',
	descendingProcess: 'process',
	accentProcess: 'process',
	verticalChevronList: 'process',
	horizontalPictureList: 'process',
	pictureAccentList: 'process',

	basicCycle: 'cycle',
	basicPie: 'cycle',

	basicRadial: 'radial',
	convergingRadial: 'radial',
	basicTarget: 'radial',
	interlockingGears: 'gear',

	hierarchy: 'hierarchy',

	basicMatrix: 'matrix',

	basicPyramid: 'pyramid',
	invertedPyramid: 'pyramid',

	basicVenn: 'venn',
	linearVenn: 'venn',

	basicFunnel: 'funnel',
};

/** Map a `resolvedLayoutType` string to a LayoutFamily. */
const RESOLVED_TYPE_MAP: Partial<Record<SmartArtLayoutType, LayoutFamily>> = {
	list: 'list',
	process: 'process',
	cycle: 'cycle',
	hierarchy: 'hierarchy',
	relationship: 'radial',
	matrix: 'matrix',
	pyramid: 'pyramid',
	funnel: 'funnel',
	target: 'target',
	venn: 'venn',
	timeline: 'timeline',
	chevron: 'process',
	bending: 'bending',
	gear: 'gear',
};

/**
 * Determine which layout family to render.
 *
 * Priority:
 * 1. Named layout preset (`layout` field)
 * 2. `resolvedLayoutType` string from the core parser
 * 3. Heuristic: nodes with children → hierarchy; otherwise list
 */
export function resolveLayoutFamily(
	nodes: PptxSmartArtNode[],
	resolvedLayoutType?: SmartArtLayoutType,
	layout?: SmartArtLayout,
): LayoutFamily {
	if (layout && layout in LAYOUT_FAMILY_MAP) {
		return LAYOUT_FAMILY_MAP[layout]!;
	}
	if (resolvedLayoutType && resolvedLayoutType in RESOLVED_TYPE_MAP) {
		const mapped = RESOLVED_TYPE_MAP[resolvedLayoutType];
		if (mapped) {
			return mapped;
		}
	}
	const hasChildren = nodes.some((n) => n.children && n.children.length > 0);
	return hasChildren ? 'hierarchy' : 'list';
}
