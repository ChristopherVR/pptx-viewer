/**
 * Framework-agnostic `a:grpFill` (group fill) inheritance helpers.
 *
 * A shape inside a group can declare `a:grpFill`, meaning "paint me with my
 * enclosing group's fill". The parser records this as `fillMode === 'group'`
 * on the child and stores the group's own fill on `GroupPptxElement.groupFill`.
 * The shared {@link getComputedFillStyle} already resolves such a child when it
 * is handed the parent group's fill as its second argument; these helpers give
 * every binding one place to (a) pull the fill off a group element and (b)
 * decide whether a given child actually needs the inherited paint, so the
 * per-binding group renderers stay thin and consistent.
 *
 * Reference: ECMA-376 Part 1, §20.1.8.35 (a:grpFill).
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import type { ComputedFillStyle } from './fill-style';
import { getComputedFillStyle } from './fill-style';

/**
 * The fill a group passes down to any `a:grpFill` child, or `undefined` when
 * the element is not a group (or the group carries no fill). Bindings thread
 * this into their group children as the `parentGroupFill` argument.
 */
export function getGroupChildParentFill(group: PptxElement): ShapeStyle | undefined {
	return group.type === 'group' ? group.groupFill : undefined;
}

/**
 * Resolve the inherited fill for a group child painted with `a:grpFill`
 * (`fillMode === 'group'`), resolved in the child's own box.
 *
 * Returns `undefined` (rather than an empty object) whenever there is nothing
 * to inherit: the child is not a shape, does not use `a:grpFill`, or no parent
 * group fill was supplied. That lets a binding whose fill pipeline does not
 * already route through {@link getComputedFillStyle} (React / Angular / the
 * vanilla group renderer) cheaply skip the merge for the overwhelmingly common
 * non-grpFill case.
 *
 * @param child           - The candidate group child element.
 * @param parentGroupFill - The enclosing group's fill (see
 *                          {@link getGroupChildParentFill}).
 */
export function resolveGroupChildFill(
	child: PptxElement,
	parentGroupFill: ShapeStyle | undefined,
): ComputedFillStyle | undefined {
	if (!parentGroupFill || !hasShapeProperties(child) || child.shapeStyle?.fillMode !== 'group') {
		return undefined;
	}
	return getComputedFillStyle(child, parentGroupFill);
}
