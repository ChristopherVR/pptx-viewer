/**
 * "Insert a new shape into an existing group" for a chart overlay
 * (`c:userShapes`) `grpSp` row.
 *
 * Before this, the inspector's "Add text box" always appended a new
 * top-level overlay shape (`chart-user-shape-edit.ts`'s
 * `withChartUserShapeAdded`): a group row had no way to receive a new child
 * at all. This mirrors that same default-shape styling, but expressed in the
 * target group's own child coordinate space (`chOff`/`chExt`, see
 * `chart-user-shape-row-frame.ts`'s doc) so the new shape lands inside the
 * group's visible bounds instead of at the top level, and appends it via a
 * path-based update mirroring core's `addChartUserShapeGroupChild` SDK op
 * (`chart-user-shape-operations.ts`), operating directly on the array like
 * this module's siblings so a binding's inspector never has to fabricate a
 * throwaway `ChartPptxElement`.
 *
 * @module render/chart-user-shape-group-child
 */
import type {
	PptxChartUserShape,
	PptxChartUserShapeGroupChild,
	PptxChartUserShapeGroupTransform,
} from 'pptx-viewer-core';

import { withNodeAtPath } from './chart-user-shape-tree';

/**
 * A ready-to-insert text-box child sized to land inside a group's own
 * visible bounds, matching `createDefaultChartUserShape`'s top-level default
 * (a modest box centred over its container) but expressed in the group's
 * own child coordinate space instead of chart-relative fractions.
 */
export function createDefaultChartUserShapeGroupChild(
	transform: PptxChartUserShapeGroupTransform,
): PptxChartUserShapeGroupChild {
	const { chOff, chExt } = transform;
	return {
		kind: 'sp',
		off: { x: Math.round(chOff.x + chExt.cx * 0.35), y: Math.round(chOff.y + chExt.cy * 0.4) },
		ext: { cx: Math.round(chExt.cx * 0.3), cy: Math.round(chExt.cy * 0.15) },
		prst: 'rect',
		fill: '#FFFFCC',
		stroke: '#808080',
		strokeWidth: 0.75,
		paragraphs: [{ text: 'Text', align: 'ctr' }],
	};
}

/**
 * Append a new child into an existing group's `children`, at any nesting
 * depth (`groupPath` addresses the `grpSp` row itself, top-level or nested).
 * A no-op (returns the array unchanged) when `groupPath` does not resolve to
 * a `grpSp` row.
 */
export function withChartUserShapeGroupChildAdded(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	groupPath: readonly number[],
	child: PptxChartUserShapeGroupChild,
): PptxChartUserShape[] {
	return withNodeAtPath(userShapes ?? [], groupPath, (node) => {
		if (node.kind !== 'grpSp') {
			return node;
		}
		const { rawXml: _staleRawXml, ...withoutRawXml } = node;
		return { ...withoutRawXml, children: [...(node.children ?? []), child] } as typeof node;
	});
}
