/**
 * Extended animation parsing helpers for OOXML animation node types:
 * p:animClr, p:excl, p:cmd, p:iterate, and text-level targets (p:txEl).
 */
import type {
	PptxColorAnimation,
	PptxTextAnimationTarget,
	PptxAnimationIterate,
	XmlObject,
} from "../types";
import { ensureArray } from "./native-animation-helpers";

/**
 * Parse `p:animClr` nodes from the child timing list.
 * Returns color animation data including color space, direction, and colors.
 */
export function extractColorAnimation(
	childTnList: XmlObject | undefined,
): PptxColorAnimation | undefined {
	if (!childTnList) return undefined;

	const animClrNodes = ensureArray(childTnList["p:animClr"]);
	if (animClrNodes.length === 0) return undefined;

	const node = animClrNodes[0];
	const clrSpc = String(node["@_clrSpc"] || "rgb").toLowerCase();
	const colorSpace: "hsl" | "rgb" = clrSpc === "hsl" ? "hsl" : "rgb";
	const dir = String(node["@_dir"] || "").toLowerCase();
	const direction =
		dir === "cw" ? "cw" : dir === "ccw" ? "ccw" : undefined;

	const fromColor = extractColorValue(node["p:from"] as XmlObject | undefined);
	const toColor = extractColorValue(node["p:to"] as XmlObject | undefined);
	const byColor = extractColorValue(node["p:by"] as XmlObject | undefined);

	return {
		colorSpace,
		direction,
		fromColor,
		toColor,
		byColor,
	};
}

/**
 * Extract a hex color string from a color container node.
 * Handles `a:srgbClr/@val` and `a:schemeClr/@val`.
 */
function extractColorValue(
	colorContainer: XmlObject | undefined,
): string | undefined {
	if (!colorContainer) return undefined;

	const srgb = colorContainer["a:srgbClr"] as XmlObject | undefined;
	if (srgb?.["@_val"]) {
		return `#${String(srgb["@_val"])}`;
	}

	const scheme = colorContainer["a:schemeClr"] as XmlObject | undefined;
	if (scheme?.["@_val"]) {
		return String(scheme["@_val"]);
	}

	return undefined;
}

/**
 * Parse `p:txEl` (text-level animation target) from a `p:spTgt` node.
 * Returns character range or paragraph range for text build animations.
 */
export function extractTextTarget(
	spTgt: XmlObject | undefined,
): PptxTextAnimationTarget | undefined {
	if (!spTgt) return undefined;

	const txEl = spTgt["p:txEl"] as XmlObject | undefined;
	if (!txEl) return undefined;

	const charRg = txEl["p:charRg"] as XmlObject | undefined;
	if (charRg) {
		const st = Number.parseInt(String(charRg["@_st"] ?? "0"), 10);
		const end = Number.parseInt(String(charRg["@_end"] ?? "0"), 10);
		return { type: "charRg", start: st, end };
	}

	const pRg = txEl["p:pRg"] as XmlObject | undefined;
	if (pRg) {
		const st = Number.parseInt(String(pRg["@_st"] ?? "0"), 10);
		const end = Number.parseInt(String(pRg["@_end"] ?? "0"), 10);
		return { type: "pRg", start: st, end };
	}

	return undefined;
}

/**
 * Parse `p:iterate` from a `p:cTn` node.
 * Returns iteration config (type, backwards, timing).
 */
export function extractIterate(
	cTn: XmlObject | undefined,
): PptxAnimationIterate | undefined {
	if (!cTn) return undefined;

	const iterate = cTn["p:iterate"] as XmlObject | undefined;
	if (!iterate) return undefined;

	const rawType = String(iterate["@_type"] || "el").toLowerCase();
	const type: "el" | "lt" | "wd" =
		rawType === "lt" ? "lt" : rawType === "wd" ? "wd" : "el";

	const backwards =
		iterate["@_backwards"] === "1" || iterate["@_backwards"] === true
			? true
			: undefined;

	const tmPctNode = iterate["p:tmPct"] as XmlObject | undefined;
	const tmAbsNode = iterate["p:tmAbs"] as XmlObject | undefined;

	let tmPct: number | undefined;
	let tmAbs: number | undefined;

	if (tmPctNode?.["@_val"] !== undefined) {
		tmPct = Number.parseInt(String(tmPctNode["@_val"]), 10);
	}
	if (tmAbsNode?.["@_val"] !== undefined) {
		tmAbs = Number.parseInt(String(tmAbsNode["@_val"]), 10);
	}

	return { type, backwards, tmPct, tmAbs };
}

/**
 * Parse `p:cmd` (command node) from a child timing list.
 * Returns command type (call/evt/verb) and command string.
 */
export function extractCommand(
	childTnList: XmlObject | undefined,
): { commandType?: string; commandString?: string } {
	if (!childTnList) return {};

	const cmdNodes = ensureArray(childTnList["p:cmd"]);
	if (cmdNodes.length === 0) return {};

	const cmd = cmdNodes[0];
	const commandType = cmd["@_type"]
		? String(cmd["@_type"])
		: undefined;
	const commandString = cmd["@_cmd"]
		? String(cmd["@_cmd"])
		: undefined;

	return { commandType, commandString };
}

/**
 * Check whether a node is inside an exclusive container (`p:excl`).
 * Returns true if the parent context indicates exclusivity.
 */
export function isExclusiveNode(
	childTnList: XmlObject | undefined,
): boolean {
	if (!childTnList) return false;
	return ensureArray(childTnList["p:excl"]).length > 0;
}

/**
 * Parse `p:bldDgm` (SmartArt build) entries from `p:bldLst`.
 */
export function extractSmartArtBuilds(
	bldLst: XmlObject | undefined,
): Array<{ spid: string; bld: string }> {
	if (!bldLst) return [];

	const entries = ensureArray(bldLst["p:bldDgm"]);
	return entries
		.filter((e) => e["@_spid"] !== undefined)
		.map((e) => ({
			spid: String(e["@_spid"]),
			bld: String(e["@_bld"] || "whole"),
		}));
}

/**
 * Parse `p:bldGraphic` entries from `p:bldLst`.
 */
export function extractGraphicBuilds(
	bldLst: XmlObject | undefined,
): Array<{ spid: string; bld: string }> {
	if (!bldLst) return [];

	const entries = ensureArray(bldLst["p:bldGraphic"]);
	return entries
		.filter((e) => e["@_spid"] !== undefined)
		.map((e) => ({
			spid: String(e["@_spid"]),
			bld: String(e["@_bld"] || "whole"),
		}));
}

/**
 * Parse `p:bldOleChart` (OLE chart build) entries from `p:bldLst`.
 */
export function extractOleChartBuilds(
	bldLst: XmlObject | undefined,
): Array<{ spid: string; grpId: string; bld: string; animBg?: boolean }> {
	if (!bldLst) return [];

	const entries = ensureArray(bldLst["p:bldOleChart"]);
	return entries
		.filter((e) => e["@_spid"] !== undefined)
		.map((e) => ({
			spid: String(e["@_spid"]),
			grpId: String(e["@_grpId"] || "0"),
			bld: String(e["@_bld"] || "allAtOnce"),
			animBg:
				e["@_animBg"] === "1" || e["@_animBg"] === true
					? true
					: undefined,
		}));
}
