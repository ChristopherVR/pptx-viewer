import type { XmlObject } from '../../types';

/**
 * The six members of the DrawingML `EG_FillProperties` choice group
 * (ECMA-376 §20.1.8.28).
 *
 * `CT_ShapeProperties` (§20.1.2.2.35), `CT_BackgroundProperties`,
 * `CT_TableCellProperties` and friends all reference the group with
 * `maxOccurs="1"`, so **exactly one** of these may appear under a given
 * parent. `CT_LineProperties` (§20.1.2.1.24) references the narrower
 * `EG_LineFillProperties` (`noFill` / `solidFill` / `gradFill` / `pattFill`);
 * the two extra names are simply never present there, so clearing all six is
 * safe for an `a:ln` too.
 *
 * Every save-time writer that swaps one fill for another has to remove the
 * whole group first. Deleting a hand-maintained subset is how issue #87
 * (dual-fill `<a:ln>`) happened, and how the same defect survived in
 * `spPr`: three separate branches each deleted four of the six names and
 * left `a:pattFill` / `a:grpFill` behind, so a hatched or group-filled shape
 * recoloured in the editor serialised two mutually exclusive fill children
 * and PowerPoint offered to repair the file.
 */
export const FILL_CHOICE_ELEMENTS = [
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
] as const;

/** One member of {@link FILL_CHOICE_ELEMENTS}. */
export type FillChoiceElement = (typeof FILL_CHOICE_ELEMENTS)[number];

/**
 * Remove every `EG_FillProperties` member from `node`, leaving it with no
 * fill child at all. Call this before writing a new fill, never as a
 * substitute for writing one.
 */
export function clearFillChoiceGroup(node: XmlObject): void {
	for (const name of FILL_CHOICE_ELEMENTS) {
		delete node[name];
	}
}

/**
 * Write exactly one `EG_FillProperties` child onto `node`, removing any other
 * member of the choice group first. This is the only supported way to set a
 * fill on a preserved (round-tripped) XML node.
 */
export function setFillChoice(node: XmlObject, name: FillChoiceElement, value: XmlObject): void {
	clearFillChoiceGroup(node);
	node[name] = value;
}

/**
 * The `EG_FillProperties` members currently present on `node`. A schema-valid
 * node returns at most one entry; anything longer is the dual-fill defect.
 */
export function fillChoiceChildren(node: XmlObject): FillChoiceElement[] {
	return FILL_CHOICE_ELEMENTS.filter((name) => node[name] !== undefined);
}
