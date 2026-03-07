/**
 * Surgical timing tree update helpers.
 *
 * Instead of regenerating the entire p:timing tree when editor animations
 * are applied, these helpers walk the existing tree and update only the
 * nodes whose target element matches an edited animation. This preserves
 * complex timing structures (nested sequences, endCondLst, etc.) that
 * would otherwise be destroyed by a full rebuild.
 */
import type { PptxElementAnimation, XmlObject } from "../types";
import { PRESET_TO_OOXML, DIRECTION_TO_SUBTYPE } from "./animation-write-mappings";
import { ensureArray, isXmlObject } from "./native-animation-helpers";

/**
 * Attempt a surgical update of the existing timing tree.
 *
 * Walks the tree and updates p:cTn nodes whose target element matches
 * an editor animation. Returns the modified tree (mutated in place).
 *
 * Only updates timing attributes (duration, delay, presetID, presetSubtype)
 * on existing nodes — does NOT add or remove animation nodes.
 */
export function surgicallyUpdateTimingTree(
	rawTiming: XmlObject,
	animations: PptxElementAnimation[],
): XmlObject {
	const animByElement = new Map<string, PptxElementAnimation>();
	for (const anim of animations) {
		animByElement.set(anim.elementId, anim);
	}

	const tnLst = rawTiming["p:tnLst"] as XmlObject | undefined;
	if (!tnLst) return rawTiming;

	const rootPar = tnLst["p:par"] as XmlObject | undefined;
	if (!rootPar) return rawTiming;

	walkAndUpdateNodes(rootPar, animByElement);

	return rawTiming;
}

/**
 * Recursively walk the timing tree and update effect nodes that match
 * editor animations by target element ID.
 */
function walkAndUpdateNodes(
	node: XmlObject,
	animByElement: ReadonlyMap<string, PptxElementAnimation>,
): void {
	if (!node) return;

	const cTn = node["p:cTn"] as XmlObject | undefined;
	if (cTn) {
		const presetClass = cTn["@_presetClass"] as string | undefined;
		if (presetClass) {
			const targetId = findTargetIdInCTn(cTn);
			if (targetId) {
				const editorAnim = animByElement.get(targetId);
				if (editorAnim) {
					updateEffectNodeAttributes(cTn, editorAnim, presetClass);
				}
			}
		}

		const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
		if (childTnList) {
			const parallels = ensureArray(childTnList["p:par"]);
			const sequences = ensureArray(childTnList["p:seq"]);
			const exclusives = ensureArray(childTnList["p:excl"]);
			for (const p of parallels) walkAndUpdateNodes(p, animByElement);
			for (const s of sequences) walkAndUpdateNodes(s, animByElement);
			for (const e of exclusives) walkAndUpdateNodes(e, animByElement);
		}
	}

	const directParallels = ensureArray(node["p:par"]);
	const directSequences = ensureArray(node["p:seq"]);
	const directExclusives = ensureArray(node["p:excl"]);
	for (const p of directParallels) walkAndUpdateNodes(p, animByElement);
	for (const s of directSequences) walkAndUpdateNodes(s, animByElement);
	for (const e of directExclusives) walkAndUpdateNodes(e, animByElement);
}

/**
 * Extract target element ID from a p:cTn's child animation behaviors.
 */
function findTargetIdInCTn(cTn: XmlObject): string | undefined {
	const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
	if (!childTnList) return undefined;

	const animationNodes = [
		...ensureArray(childTnList["p:animEffect"]),
		...ensureArray(childTnList["p:anim"]),
		...ensureArray(childTnList["p:animMotion"]),
		...ensureArray(childTnList["p:animRot"]),
		...ensureArray(childTnList["p:animScale"]),
		...ensureArray(childTnList["p:animClr"]),
		...ensureArray(childTnList["p:cmd"]),
		...ensureArray(childTnList["p:set"]),
	];

	for (const animNode of animationNodes) {
		const behavior = animNode["p:cBhvr"] as XmlObject | undefined;
		const targetElement = behavior?.["p:tgtEl"] as XmlObject | undefined;
		const shapeTarget = targetElement?.["p:spTgt"] as XmlObject | undefined;
		if (shapeTarget?.["@_spid"]) {
			return String(shapeTarget["@_spid"]);
		}
	}

	return undefined;
}

/**
 * Update a p:cTn effect node's attributes from editor animation data.
 * Only modifies timing-related attributes, preserving structural elements
 * like endCondLst, child behavior nodes, etc.
 */
function updateEffectNodeAttributes(
	cTn: XmlObject,
	anim: PptxElementAnimation,
	currentPresetClass: string,
): void {
	// Determine the relevant preset from the editor animation
	const presetName = resolvePresetNameForClass(anim, currentPresetClass);
	if (presetName) {
		const mapping = PRESET_TO_OOXML[presetName];
		if (mapping) {
			cTn["@_presetID"] = String(mapping.presetId);
			cTn["@_presetClass"] = mapping.presetClass;

			const subtype = anim.direction
				? (DIRECTION_TO_SUBTYPE[anim.direction] ?? mapping.defaultSubtype)
				: mapping.defaultSubtype;
			cTn["@_presetSubtype"] = String(subtype);
		}
	}

	// Update duration
	if (anim.durationMs !== undefined) {
		cTn["@_dur"] = String(anim.durationMs);
	}

	// Update start condition delay
	const stCondList = cTn["p:stCondLst"] as XmlObject | undefined;
	if (stCondList && anim.delayMs !== undefined) {
		const conditions = ensureArray(stCondList["p:cond"]);
		for (const cond of conditions) {
			if (isXmlObject(cond)) {
				cond["@_delay"] = String(anim.delayMs);
			}
		}
	}
}

/**
 * Map editor animation preset class (entr/exit/emph) to the relevant
 * preset name from the animation's entrance/exit/emphasis fields.
 */
function resolvePresetNameForClass(
	anim: PptxElementAnimation,
	presetClass: string,
): string | undefined {
	switch (presetClass) {
		case "entr":
			return anim.entrance && anim.entrance !== "none"
				? anim.entrance
				: undefined;
		case "exit":
			return anim.exit && anim.exit !== "none" ? anim.exit : undefined;
		case "emph":
			return anim.emphasis && anim.emphasis !== "none"
				? anim.emphasis
				: undefined;
		default:
			return undefined;
	}
}
