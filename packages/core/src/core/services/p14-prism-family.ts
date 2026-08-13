/**
 * The `p14:prism` family: PowerPoint's Cube, Rotate, Box and Orbit.
 *
 * None of the four has an element of its own. PowerPoint writes all of them as
 * `<p14:prism/>` and tells them apart with two `ST_OnOff` attributes, so the
 * flags ARE the identity: drop them on read and every one of the four reloads
 * as the generic `prism` type, after which the next save writes Cube.
 *
 * MEASURED, not inferred: PowerPoint authored `PpEntryEffect` 3910-3931 into a
 * deck via COM and the slide XML was dumped, with the effect names read off the
 * PowerPoint type library (`Microsoft.Office.Interop.PowerPoint.PpEntryEffect`
 * in the GAC) rather than guessed from the numbering.
 *
 * | EntryEffect | gallery name | element                                      |
 * | ----------- | ------------ | -------------------------------------------- |
 * | 3914-3917   | Cube         | `<p14:prism/>`                               |
 * | 3918-3921   | Rotate       | `<p14:prism isContent="1"/>`                 |
 * | 3922-3925   | Box          | `<p14:prism isInverted="1"/>`                |
 * | 3926-3929   | Orbit        | `<p14:prism isContent="1" isInverted="1"/>`  |
 *
 * The enum does NOT run Cube/Box/Rotate/Orbit, which an earlier reading of the
 * numbering assumed: Rotate is second and Box third. Acting on that assumption
 * made a saved `rotate` reopen in PowerPoint as Box, which is exactly the kind
 * of near-miss that survives review because it still shows a 3-D transition.
 *
 * @module services/p14-prism-family
 */
import type { XmlObject } from '../types';

/** The four transition types PowerPoint stores in a single `p14:prism`. */
export type PptxPrismFamilyType = 'cube' | 'rotate' | 'box' | 'orbit';

/** The two `p14:prism` attributes that select a family member. */
export interface PrismFamilyFlags {
	isContent: boolean;
	isInverted: boolean;
}

/**
 * Family member -> flags.
 *
 * `prism` is the legacy generic token: it is still accepted from callers and
 * writes the bare element, which PowerPoint reads as Cube. Parsing never
 * produces it any more, because a bare `<p14:prism/>` IS Cube.
 */
const PRISM_FAMILY_FLAGS: Readonly<Record<string, PrismFamilyFlags>> = {
	prism: { isContent: false, isInverted: false },
	cube: { isContent: false, isInverted: false },
	rotate: { isContent: true, isInverted: false },
	box: { isContent: false, isInverted: true },
	orbit: { isContent: true, isInverted: true },
};

/** The flags a transition type must be written with, or `undefined` if it is not in the family. */
export function prismFamilyFlags(transitionType: string): PrismFamilyFlags | undefined {
	return PRISM_FAMILY_FLAGS[transitionType];
}

/** `ST_OnOff` accepts `1`/`true`/`on` (and `0`/`false`/`off`) for the same boolean. */
function isOn(value: unknown): boolean {
	const raw = String(value ?? '')
		.trim()
		.toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'on';
}

/** The family member a flag pair identifies. */
export function prismFamilyTypeForFlags(flags: PrismFamilyFlags): PptxPrismFamilyType {
	if (flags.isContent) {
		return flags.isInverted ? 'orbit' : 'rotate';
	}
	return flags.isInverted ? 'box' : 'cube';
}

/** The flags carried by a `p14:prism` element (a bare or absent element is Cube). */
export function prismFamilyFlagsOfNode(node: XmlObject | undefined): PrismFamilyFlags {
	return {
		isContent: isOn(node?.['@_isContent']),
		isInverted: isOn(node?.['@_isInverted']),
	};
}

/** The family member a parsed `p14:prism` element represents. */
export function prismFamilyTypeOfNode(node: XmlObject | undefined): PptxPrismFamilyType {
	return prismFamilyTypeForFlags(prismFamilyFlagsOfNode(node));
}
