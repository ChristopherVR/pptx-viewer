/**
 * XML node builder functions for the OOXML animation write service.
 * Extracted from PptxAnimationWriteService to keep file sizes manageable.
 */
import type {
	PptxAnimationPreset,
	PptxElementAnimation,
	XmlObject,
} from "../types";
import {
	PRESET_TO_OOXML,
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
	timingCurveToAccelDecel,
} from "./animation-write-mappings";

/** Emphasis presets that use p:animRot (rotation). */
const ROTATION_EMPHASIS: ReadonlySet<string> = new Set(["spin", "teeter"]);

/** Emphasis presets that use p:animScale. */
const SCALE_EMPHASIS: ReadonlySet<string> = new Set(["growShrink"]);

/** Emphasis presets that use p:anim on style.opacity. */
const OPACITY_EMPHASIS: ReadonlySet<string> = new Set([
	"transparency",
	"flash",
	"boldFlash",
]);

/**
 * Build a single effect p:par node containing the OOXML animation
 * elements (p:animEffect, p:set, p:anim, p:animRot, p:animScale, etc.).
 */
export function buildSingleEffectNode(
	anim: PptxElementAnimation,
	preset: PptxAnimationPreset,
	presetClass: "entr" | "exit" | "emph",
	allocateId: () => number,
): XmlObject | undefined {
	const mapping = PRESET_TO_OOXML[preset];
	if (!mapping) return undefined;

	const duration = anim.durationMs ?? 500;
	const delay = anim.delayMs ?? 0;
	const trigger = anim.trigger ?? "onClick";
	const nodeType = triggerToNodeType(trigger);
	const { accel, decel } = timingCurveToAccelDecel(anim.timingCurve);
	const subtype = anim.direction
		? (DIRECTION_TO_SUBTYPE[anim.direction] ?? mapping.defaultSubtype)
		: mapping.defaultSubtype;

	const effectId = allocateId();
	const shapeId = anim.elementId;

	const childElements: XmlObject[] = [];

	if (presetClass === "entr") {
		childElements.push(buildVisibilitySet(shapeId, duration, true, allocateId));
	}

	if (presetClass === "emph") {
		const emphNodes = buildEmphasisBehaviorNodes(
			shapeId,
			duration,
			preset,
			allocateId,
		);
		for (const n of emphNodes) {
			childElements.push(n);
		}
	} else {
		const animEffectNode = buildAnimEffectNode(
			shapeId,
			duration,
			presetClass === "entr" ? "in" : "out",
			allocateId,
		);
		childElements.push(animEffectNode);
	}

	if (presetClass === "exit") {
		childElements.push(
			buildVisibilitySet(shapeId, duration, false, allocateId),
		);
	}

	const repeatAttrs: Record<string, string> = {};
	if (anim.repeatCount && anim.repeatCount > 1) {
		repeatAttrs["@_repeatCount"] = String(anim.repeatCount * 1000);
	}
	if (anim.repeatMode === "untilNextClick") {
		repeatAttrs["@_repeatCount"] = "indefinite";
		repeatAttrs["@_restart"] = "whenNotActive";
	} else if (anim.repeatMode === "untilEndOfSlide") {
		repeatAttrs["@_repeatCount"] = "indefinite";
	}

	const afterAttrs: Record<string, string> = {};
	if (anim.afterAnimation === "hideAfterAnimation") {
		afterAttrs["@_afterEffect"] = "1";
	} else if (anim.afterAnimation === "hideOnNextClick") {
		afterAttrs["@_afterEffect"] = "1";
	}

	const effectCTn: XmlObject = {
		"@_id": String(effectId),
		"@_presetID": String(mapping.presetId),
		"@_presetClass": presetClass,
		"@_presetSubtype": String(subtype),
		"@_fill": "hold",
		"@_nodeType": nodeType,
		"@_dur": String(duration),
		...repeatAttrs,
		...afterAttrs,
		"p:stCondLst": {
			"p:cond": {
				"@_delay": String(delay),
			},
		},
		"p:childTnLst": {},
	};

	if (accel > 0) {
		effectCTn["@_accel"] = String(accel);
	}
	if (decel > 0) {
		effectCTn["@_decel"] = String(decel);
	}

	const childTnLst: XmlObject = {};
	const setNodes: XmlObject[] = [];
	const animEffectNodes: XmlObject[] = [];
	const animNodes: XmlObject[] = [];
	const animRotNodes: XmlObject[] = [];
	const animScaleNodes: XmlObject[] = [];

	for (const child of childElements) {
		const nodeType = child["_type"] as string | undefined;
		delete child["_type"];
		switch (nodeType) {
			case "set":
				setNodes.push(child);
				break;
			case "animEffect":
				animEffectNodes.push(child);
				break;
			case "anim":
				animNodes.push(child);
				break;
			case "animRot":
				animRotNodes.push(child);
				break;
			case "animScale":
				animScaleNodes.push(child);
				break;
			default:
				animEffectNodes.push(child);
				break;
		}
	}

	if (setNodes.length > 0) {
		childTnLst["p:set"] = setNodes.length === 1 ? setNodes[0] : setNodes;
	}
	if (animEffectNodes.length > 0) {
		childTnLst["p:animEffect"] =
			animEffectNodes.length === 1 ? animEffectNodes[0] : animEffectNodes;
	}
	if (animNodes.length > 0) {
		childTnLst["p:anim"] = animNodes.length === 1 ? animNodes[0] : animNodes;
	}
	if (animRotNodes.length > 0) {
		childTnLst["p:animRot"] =
			animRotNodes.length === 1 ? animRotNodes[0] : animRotNodes;
	}
	if (animScaleNodes.length > 0) {
		childTnLst["p:animScale"] =
			animScaleNodes.length === 1 ? animScaleNodes[0] : animScaleNodes;
	}

	effectCTn["p:childTnLst"] = childTnLst;

	if (anim.stopSound) {
		effectCTn["p:endSnd"] = {};
	} else if (anim.soundRId) {
		effectCTn["p:stSnd"] = {
			"p:snd": {
				"@_r:embed": anim.soundRId,
			},
		};
	}

	const wrapperId = allocateId();
	return {
		"p:cTn": {
			"@_id": String(wrapperId),
			"@_fill": "hold",
			"p:stCondLst": {
				"p:cond": {
					"@_delay": trigger === "withPrevious" ? "0" : String(delay),
				},
			},
			"p:childTnLst": {
				"p:par": {
					"p:cTn": effectCTn,
				},
			},
		},
	} as XmlObject;
}

/**
 * Build behavior nodes specific to emphasis effects.
 * Returns the appropriate OOXML behavior node(s) for the given emphasis preset.
 */
function buildEmphasisBehaviorNodes(
	shapeId: string,
	duration: number,
	preset: PptxAnimationPreset,
	allocateId: () => number,
): XmlObject[] {
	if (ROTATION_EMPHASIS.has(preset)) {
		return [buildAnimRotNode(shapeId, duration, preset, allocateId)];
	}
	if (SCALE_EMPHASIS.has(preset)) {
		return [buildAnimScaleNode(shapeId, duration, allocateId)];
	}
	if (OPACITY_EMPHASIS.has(preset)) {
		return [buildAnimPropertyNode(shapeId, duration, "style.opacity", allocateId)];
	}
	// Default emphasis: pulse, wave, bounce, colorWave — use p:animEffect
	return [buildAnimEffectNode(shapeId, duration, "in", allocateId)];
}

/**
 * Build a p:set node for toggling element visibility.
 */
export function buildVisibilitySet(
	shapeId: string,
	duration: number,
	makeVisible: boolean,
	allocateId: () => number,
): XmlObject {
	const setId = allocateId();
	return {
		_type: "set",
		"p:cBhvr": {
			"p:cTn": {
				"@_id": String(setId),
				"@_dur": "1",
				"@_fill": "hold",
				"p:stCondLst": {
					"p:cond": {
						"@_delay": makeVisible ? "0" : String(duration),
					},
				},
			},
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": shapeId,
				},
			},
			"p:attrNameLst": {
				"p:attrName": "style.visibility",
			},
		},
		"p:to": {
			"p:strVal": {
				"@_val": makeVisible ? "visible" : "hidden",
			},
		},
	} as XmlObject;
}

/**
 * Build a p:animEffect node for visual transition effects.
 */
export function buildAnimEffectNode(
	shapeId: string,
	duration: number,
	transition: "in" | "out",
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	return {
		_type: "animEffect",
		"@_transition": transition,
		"@_filter": "fade",
		"p:cBhvr": {
			"p:cTn": {
				"@_id": String(animId),
				"@_dur": String(duration),
			},
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": shapeId,
				},
			},
		},
	} as XmlObject;
}

/**
 * Build a p:animRot node for rotation emphasis (spin, teeter).
 */
function buildAnimRotNode(
	shapeId: string,
	duration: number,
	preset: PptxAnimationPreset,
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	// Spin: full 360 degree rotation (21600000 = 360 * 60000)
	// Teeter: small oscillation (300000 = 5 degrees * 60000)
	const byAngle = preset === "spin" ? "21600000" : "300000";
	return {
		_type: "animRot",
		"@_by": byAngle,
		"p:cBhvr": {
			"p:cTn": {
				"@_id": String(animId),
				"@_dur": String(duration),
				"@_fill": "hold",
			},
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": shapeId,
				},
			},
			"p:attrNameLst": {
				"p:attrName": "r",
			},
		},
	} as XmlObject;
}

/**
 * Build a p:animScale node for scale emphasis (growShrink).
 */
function buildAnimScaleNode(
	shapeId: string,
	duration: number,
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	return {
		_type: "animScale",
		"p:by": {
			"@_x": "125000",
			"@_y": "125000",
		},
		"p:cBhvr": {
			"p:cTn": {
				"@_id": String(animId),
				"@_dur": String(duration),
				"@_fill": "hold",
				"@_autoRev": "1",
			},
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": shapeId,
				},
			},
		},
	} as XmlObject;
}

/**
 * Build a p:anim node for property animations (opacity, etc.).
 */
function buildAnimPropertyNode(
	shapeId: string,
	duration: number,
	attrName: string,
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	return {
		_type: "anim",
		"@_calcmode": "lin",
		"@_valueType": "num",
		"p:cBhvr": {
			"p:cTn": {
				"@_id": String(animId),
				"@_dur": String(duration),
				"@_fill": "hold",
			},
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": shapeId,
				},
			},
			"p:attrNameLst": {
				"p:attrName": attrName,
			},
		},
		"p:tavLst": {
			"p:tav": [
				{
					"@_tm": "0",
					"p:val": { "p:strVal": { "@_val": "1" } },
				},
				{
					"@_tm": "50000",
					"p:val": { "p:strVal": { "@_val": "0.4" } },
				},
				{
					"@_tm": "100000",
					"p:val": { "p:strVal": { "@_val": "1" } },
				},
			],
		},
	} as XmlObject;
}

/**
 * Build a p:animMotion node for motion path animations.
 */
export function buildMotionPathNode(
	anim: PptxElementAnimation,
	allocateId: () => number,
): XmlObject | undefined {
	if (!anim.motionPath) return undefined;

	const duration = anim.durationMs ?? 1000;
	const delay = anim.delayMs ?? 0;
	const trigger = anim.trigger ?? "onClick";
	const nodeType = triggerToNodeType(trigger);
	const { accel, decel } = timingCurveToAccelDecel(anim.timingCurve);

	const effectId = allocateId();
	const motionId = allocateId();

	const motionNode: XmlObject = {
		"@_origin": "layout",
		"@_path": anim.motionPath,
		"@_pathEditMode": "relative",
		"@_ptsTypes": "",
		"p:cBhvr": {
			"p:cTn": {
				"@_id": String(motionId),
				"@_dur": String(duration),
				"@_fill": "hold",
			},
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": anim.elementId,
				},
			},
			"p:attrNameLst": {
				"p:attrName": "ppt_x,ppt_y",
			},
		},
	};

	const effectCTn: XmlObject = {
		"@_id": String(effectId),
		"@_presetID": "0",
		"@_presetClass": "path",
		"@_presetSubtype": "0",
		"@_fill": "hold",
		"@_nodeType": nodeType,
		"@_dur": String(duration),
		"p:stCondLst": {
			"p:cond": {
				"@_delay": String(delay),
			},
		},
		"p:childTnLst": {
			"p:animMotion": motionNode,
		},
	};

	if (accel > 0) {
		effectCTn["@_accel"] = String(accel);
	}
	if (decel > 0) {
		effectCTn["@_decel"] = String(decel);
	}

	if (anim.stopSound) {
		effectCTn["p:endSnd"] = {};
	} else if (anim.soundRId) {
		effectCTn["p:stSnd"] = {
			"p:snd": {
				"@_r:embed": anim.soundRId,
			},
		};
	}

	const wrapperId = allocateId();
	return {
		"p:cTn": {
			"@_id": String(wrapperId),
			"@_fill": "hold",
			"p:stCondLst": {
				"p:cond": {
					"@_delay": trigger === "withPrevious" ? "0" : String(delay),
				},
			},
			"p:childTnLst": {
				"p:par": {
					"p:cTn": effectCTn,
				},
			},
		},
	} as XmlObject;
}
