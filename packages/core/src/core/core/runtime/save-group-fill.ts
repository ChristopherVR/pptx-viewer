/**
 * Save-time `a:grpFill` (group fill) inheritance helpers.
 *
 * A shape inside a group can declare `<a:grpFill/>`: "paint me with my
 * enclosing group's fill". The load pass RESOLVES that link in the model
 * (`applyGroupFillInheritance` in `PptxHandlerRuntimeGroupParsing`) by stamping
 * the ancestor group's fill onto the child, so by the time the save writer sees
 * the child its `fillMode` says `solid` (or `gradient` / `pattern`), not
 * `group`. Writing that resolved value back out replaces `<a:grpFill/>` with a
 * concrete fill and destroys the inheritance: recolour the group afterwards in
 * PowerPoint and the child no longer follows.
 *
 * The save path therefore has to re-derive the inheritance the same way the
 * load pass and the renderer do, and re-emit `<a:grpFill/>` whenever the
 * child's fill is still exactly the fill it inherited. This mirrors the
 * preserved-colour rule used for `a:solidFill` (keep the authored node while
 * the resolved value still matches it) and the render-side chaining in
 * `pptx-viewer-shared` (`render/group-fill.ts`, `getGroupChildParentFill`).
 *
 * Reference: ECMA-376 Part 1, §20.1.8.35 (`a:grpFill`).
 */
import type { GroupPptxElement, ShapeStyle } from '../../types';

/** The gradient-stop list shape carried by {@link ShapeStyle}. */
type GradientStops = NonNullable<ShapeStyle['fillGradientStops']>;

/**
 * The fill a group hands down to a child that declares `<a:grpFill/>`.
 *
 * `a:grpFill` resolves against the nearest ANCESTOR group that actually has a
 * fill, so a group only answers with its own fill when it has one; otherwise
 * whatever it inherited passes straight through. Two cases count as "no fill of
 * its own", and they are the same two the load pass and the renderer apply:
 *
 * - the group declares no fill at all (`groupFill` undefined);
 * - the group's own fill is ITSELF `a:grpFill` (`fillMode === 'group'`).
 *
 * @param group         - The group whose children are being serialised.
 * @param inheritedFill - The fill this group itself inherited, if any.
 */
export function groupChildInheritedFill(
	group: GroupPptxElement,
	inheritedFill: ShapeStyle | undefined,
): ShapeStyle | undefined {
	const own = group.groupFill;
	return own && own.fillMode !== 'group' ? own : inheritedFill;
}

/** Case-insensitive colour compare that treats `undefined` as equal to itself. */
function sameColor(a: string | undefined, b: string | undefined): boolean {
	if (a === undefined || b === undefined) {
		return a === b;
	}
	return a.toLowerCase() === b.toLowerCase();
}

/** Structural compare of two gradient-stop lists (colour, position, opacity). */
function sameStops(a: GradientStops | undefined, b: GradientStops | undefined): boolean {
	if (a === undefined || b === undefined) {
		return a === b;
	}
	return (
		a.length === b.length &&
		a.every((stop, index) => {
			const other = b[index];
			return (
				sameColor(stop.color, other.color) &&
				stop.position === other.position &&
				stop.opacity === other.opacity
			);
		})
	);
}

/**
 * Whether `style` still carries exactly the fill it would have inherited from
 * `inherited`, i.e. nothing has overridden the group's paint since load.
 *
 * The compared fields are precisely the ones the load pass copies down in
 * `applyGroupFillInheritance`; any user edit to the child's fill changes at
 * least one of them, and the writer then emits the concrete fill instead of
 * re-asserting the inheritance.
 */
export function fillMatchesInheritedGroupFill(
	style: ShapeStyle,
	inherited: ShapeStyle | undefined,
): boolean {
	if (!inherited || inherited.fillMode === 'group') {
		return false;
	}
	return (
		style.fillMode === inherited.fillMode &&
		sameColor(style.fillColor, inherited.fillColor) &&
		style.fillOpacity === inherited.fillOpacity &&
		style.fillGradient === inherited.fillGradient &&
		style.fillGradientAngle === inherited.fillGradientAngle &&
		style.fillGradientType === inherited.fillGradientType &&
		style.fillPatternPreset === inherited.fillPatternPreset &&
		sameColor(style.fillPatternBackgroundColor, inherited.fillPatternBackgroundColor) &&
		sameStops(style.fillGradientStops, inherited.fillGradientStops)
	);
}
