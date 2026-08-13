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
 * the element is not a group and nothing was inherited. Bindings thread this
 * into their group children as the `parentGroupFill` argument.
 *
 * `a:grpFill` resolves against the nearest ANCESTOR group that actually has a
 * fill, so the group's own fill is only the answer when it has one; otherwise
 * whatever the group itself inherited passes straight through. Two cases count
 * as "no fill of its own":
 *
 * - the group declares none (`groupFill` undefined). The core load pass
 *   ({@link https://ecma-international.org/publications-and-standards/standards/ecma-376/ | ECMA-376} §20.1.8.35,
 *   `applyGroupFillInheritance`) descends through such a group for the same
 *   reason;
 * - the group's own fill is ITSELF `a:grpFill` (`fillMode === 'group'`), i.e.
 *   the nested group inherits too. PowerPoint paints a leaf under such a group
 *   with the outer group's fill (verified by exporting a nested-`grpFill` deck
 *   with PowerPoint COM: the leaf renders in the outer group's red, not
 *   transparent), and passing the group-mode style down would resolve to
 *   nothing.
 *
 * Before this chaining existed, every binding called it with the immediate
 * group only, so a `grpFill` shape two levels down painted transparent.
 *
 * @param group         - The group whose children are about to be rendered.
 * @param inheritedFill - The fill this group itself inherited, i.e. the value
 *                        the binding received as its own `parentGroupFill`.
 */
export function getGroupChildParentFill(
	group: PptxElement,
	inheritedFill?: ShapeStyle,
): ShapeStyle | undefined {
	if (group.type !== 'group') {
		return undefined;
	}
	const own = group.groupFill;
	return own && own.fillMode !== 'group' ? own : inheritedFill;
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
 * A `group` child is skipped on purpose: a group paints no box of its own, and
 * a nested group that declares `a:grpFill` is handled by
 * {@link getGroupChildParentFill}, which passes the ancestor fill through to
 * the shapes inside it.
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
