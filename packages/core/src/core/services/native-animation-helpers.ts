/**
 * Helper functions extracted from PptxNativeAnimationService.
 * Provides XML parsing utilities for animation timing trees.
 */
import type {
	AnimationCondition,
	AnimationConditionEvent,
	PptxAnimationKeyframe,
	PptxNativeAnimation,
	PptxTextBuildType,
	XmlObject,
} from '../types';
import {
	parseTimeTargetElement,
	serializeTimeTargetElement,
} from './animation-target-build-helpers';

/**
 * Extract sound action (`p:stSnd` or `p:endSnd`) from a `p:cTn` node.
 */
export function extractSoundAction(cTn: XmlObject): {
	soundRId?: string;
	stopSound?: boolean;
} {
	const stSnd = cTn['p:stSnd'] as XmlObject | undefined;
	if (stSnd) {
		const snd = stSnd['p:snd'] as XmlObject | undefined;
		if (snd) {
			const embed = snd['@_r:embed'] ?? snd['@_embed'];
			if (embed) {
				return { soundRId: String(embed) };
			}
		}
	}

	if (cTn['p:endSnd'] !== undefined) {
		return { stopSound: true };
	}

	const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
	if (childTnList) {
		const childStSnd = childTnList['p:stSnd'] as XmlObject | undefined;
		if (childStSnd) {
			const snd = childStSnd['p:snd'] as XmlObject | undefined;
			if (snd) {
				const embed = snd['@_r:embed'] ?? snd['@_embed'];
				if (embed) {
					return { soundRId: String(embed) };
				}
			}
		}
		if (childTnList['p:endSnd'] !== undefined) {
			return { stopSound: true };
		}
	}

	return {};
}

export function extractChildMotionValues(childTnList: XmlObject | undefined): {
	motionPath?: string;
	motionOrigin?: string;
	motionPathRotateAuto?: boolean;
	motionPathEditMode?: string;
	motionPtsTypes?: string;
	rotationBy?: number;
	rotationFrom?: number;
	rotationTo?: number;
	scaleByX?: number;
	scaleByY?: number;
	scaleFromX?: number;
	scaleFromY?: number;
	scaleToX?: number;
	scaleToY?: number;
	scaleZoomContents?: boolean;
} {
	let motionPath: string | undefined;
	let motionOrigin: string | undefined;
	let motionPathRotateAuto: boolean | undefined;
	let motionPathEditMode: string | undefined;
	let motionPtsTypes: string | undefined;
	let rotationBy: number | undefined;
	let rotationFrom: number | undefined;
	let rotationTo: number | undefined;
	let scaleByX: number | undefined;
	let scaleByY: number | undefined;
	let scaleFromX: number | undefined;
	let scaleFromY: number | undefined;
	let scaleToX: number | undefined;
	let scaleToY: number | undefined;
	let scaleZoomContents: boolean | undefined;

	if (!childTnList) {
		return {
			motionPath,
			motionOrigin,
			motionPathRotateAuto,
			motionPathEditMode,
			motionPtsTypes,
			rotationBy,
			rotationFrom,
			rotationTo,
			scaleByX,
			scaleByY,
			scaleFromX,
			scaleFromY,
			scaleToX,
			scaleToY,
			scaleZoomContents,
		};
	}

	const motionNodes = ensureArray(childTnList['p:animMotion']);
	for (const motionNode of motionNodes) {
		if (motionNode['@_path'] !== undefined) {
			motionPath = String(motionNode['@_path']);
			motionOrigin = motionNode['@_origin'] ? String(motionNode['@_origin']) : undefined;
			// p:animMotion/@rAng = "0" means the element auto-rotates to follow the
			// path tangent direction (equivalent to CSS offset-rotate: auto).
			if (motionNode['@_rAng'] !== undefined) {
				const rAng = String(motionNode['@_rAng']);
				if (rAng === '0') {
					motionPathRotateAuto = true;
				}
			}
			if (motionNode['@_pathEditMode'] !== undefined) {
				motionPathEditMode = String(motionNode['@_pathEditMode']);
			}
			if (motionNode['@_ptsTypes'] !== undefined) {
				motionPtsTypes = String(motionNode['@_ptsTypes']);
			}
		}
	}

	const rotationNodes = ensureArray(childTnList['p:animRot']);
	for (const rotationNode of rotationNodes) {
		if (rotationNode['@_by'] !== undefined) {
			rotationBy = Number.parseInt(String(rotationNode['@_by']), 10) / 60000;
		}
		if (rotationNode['@_from'] !== undefined) {
			rotationFrom = Number.parseInt(String(rotationNode['@_from']), 10) / 60000;
		}
		if (rotationNode['@_to'] !== undefined) {
			rotationTo = Number.parseInt(String(rotationNode['@_to']), 10) / 60000;
		}
	}

	const scaleNodes = ensureArray(childTnList['p:animScale']);
	for (const scaleNode of scaleNodes) {
		const scaleBy = scaleNode['p:by'] as XmlObject | undefined;
		if (scaleBy) {
			if (scaleBy['@_x'] !== undefined) {
				scaleByX = Number.parseInt(String(scaleBy['@_x']), 10) / 100000;
			}
			if (scaleBy['@_y'] !== undefined) {
				scaleByY = Number.parseInt(String(scaleBy['@_y']), 10) / 100000;
			}
		}

		const scaleFrom = scaleNode['p:from'] as XmlObject | undefined;
		if (scaleFrom) {
			if (scaleFrom['@_x'] !== undefined) {
				scaleFromX = Number.parseInt(String(scaleFrom['@_x']), 10) / 100000;
			}
			if (scaleFrom['@_y'] !== undefined) {
				scaleFromY = Number.parseInt(String(scaleFrom['@_y']), 10) / 100000;
			}
		}

		const scaleTo = scaleNode['p:to'] as XmlObject | undefined;
		if (scaleTo) {
			if (scaleTo['@_x'] !== undefined) {
				scaleToX = Number.parseInt(String(scaleTo['@_x']), 10) / 100000;
			}
			if (scaleTo['@_y'] !== undefined) {
				scaleToY = Number.parseInt(String(scaleTo['@_y']), 10) / 100000;
			}
		}

		const zoom = scaleNode['@_zoomContents'];
		if (zoom !== undefined) {
			scaleZoomContents = zoom === '1' || zoom === 'true';
		}
	}

	return {
		motionPath,
		motionOrigin,
		motionPathRotateAuto,
		motionPathEditMode,
		motionPtsTypes,
		rotationBy,
		rotationFrom,
		rotationTo,
		scaleByX,
		scaleByY,
		scaleFromX,
		scaleFromY,
		scaleToX,
		scaleToY,
		scaleZoomContents,
	};
}

/**
 * Parse `p:tavLst/p:tav` keyframes from a `p:anim` (or other behavior)
 * node into a typed array.
 *
 * Each `p:tav` entry has a time fraction `@_tm` plus a typed value child
 * inside `p:val` (one of `p:strVal`, `p:boolVal`, `p:intVal`, `p:fltVal`,
 * `p:clrVal`). Preserves `@_fmla` when present.
 *
 * @see ECMA-376 §19.5.30 CT_TLAnimVariantList
 */
export function extractKeyframes(
	behaviorNode: XmlObject | undefined,
): PptxAnimationKeyframe[] | undefined {
	if (!behaviorNode) {
		return undefined;
	}
	const tavLst = behaviorNode['p:tavLst'] as XmlObject | undefined;
	if (!tavLst) {
		return undefined;
	}

	const tavEntries = ensureArray(tavLst['p:tav']);
	if (tavEntries.length === 0) {
		return undefined;
	}

	const out: PptxAnimationKeyframe[] = [];
	for (const tav of tavEntries) {
		const tmRaw = tav['@_tm'];
		let tm: number | string;
		if (tmRaw === undefined) {
			tm = 0;
		} else {
			const tmStr = String(tmRaw);
			if (tmStr === 'indefinite' || tmStr === 'large') {
				tm = tmStr;
			} else {
				const parsed = Number.parseInt(tmStr, 10);
				tm = Number.isNaN(parsed) ? tmStr : parsed;
			}
		}

		const fmlaRaw = tav['@_fmla'];

		const valNode = tav['p:val'] as XmlObject | undefined;
		if (!valNode) {
			continue;
		}

		const decoded = decodeKeyframeValue(valNode);
		if (!decoded) {
			continue;
		}

		const entry: PptxAnimationKeyframe = {
			tm,
			value: decoded.value,
			valueType: decoded.valueType,
		};
		if (fmlaRaw !== undefined) {
			entry.fmla = String(fmlaRaw);
		}
		out.push(entry);
	}

	return out.length > 0 ? out : undefined;
}

function decodeKeyframeValue(
	valNode: XmlObject,
): { value: string | boolean | number; valueType: 'str' | 'bool' | 'int' | 'flt' | 'clr' } | null {
	const strVal = valNode['p:strVal'] as XmlObject | undefined;
	if (strVal && strVal['@_val'] !== undefined) {
		return { value: String(strVal['@_val']), valueType: 'str' };
	}

	const boolVal = valNode['p:boolVal'] as XmlObject | undefined;
	if (boolVal && boolVal['@_val'] !== undefined) {
		const raw = boolVal['@_val'];
		const value = raw === '1' || raw === 'true';
		return { value, valueType: 'bool' };
	}

	const intVal = valNode['p:intVal'] as XmlObject | undefined;
	if (intVal && intVal['@_val'] !== undefined) {
		const parsed = Number.parseInt(String(intVal['@_val']), 10);
		return { value: Number.isNaN(parsed) ? 0 : parsed, valueType: 'int' };
	}

	const fltVal = valNode['p:fltVal'] as XmlObject | undefined;
	if (fltVal && fltVal['@_val'] !== undefined) {
		const parsed = Number.parseFloat(String(fltVal['@_val']));
		return { value: Number.isNaN(parsed) ? 0 : parsed, valueType: 'flt' };
	}

	const clrVal = valNode['p:clrVal'] as XmlObject | undefined;
	if (clrVal) {
		// p:clrVal contains a colour child (a:srgbClr / a:schemeClr) or a @_val attr.
		if (clrVal['@_val'] !== undefined) {
			return { value: String(clrVal['@_val']), valueType: 'clr' };
		}
		const srgb = clrVal['a:srgbClr'] as XmlObject | undefined;
		if (srgb?.['@_val'] !== undefined) {
			return { value: `#${String(srgb['@_val'])}`, valueType: 'clr' };
		}
		const scheme = clrVal['a:schemeClr'] as XmlObject | undefined;
		if (scheme?.['@_val'] !== undefined) {
			return { value: String(scheme['@_val']), valueType: 'clr' };
		}
	}

	return null;
}

/**
 * Collect keyframes from any `p:anim`-style behavior nodes inside the given
 * `p:childTnLst`. Returns the first non-empty keyframe list found, scanning
 * `p:anim`, `p:animRot`, `p:animScale`, and `p:animClr`.
 */
export function extractChildKeyframes(
	childTnList: XmlObject | undefined,
): PptxAnimationKeyframe[] | undefined {
	if (!childTnList) {
		return undefined;
	}
	const candidateKeys = ['p:anim', 'p:animRot', 'p:animScale', 'p:animClr'] as const;
	for (const key of candidateKeys) {
		const nodes = ensureArray(childTnList[key]);
		for (const node of nodes) {
			const kf = extractKeyframes(node);
			if (kf && kf.length > 0) {
				return kf;
			}
		}
	}
	return undefined;
}

/**
 * Parse an OOXML `ST_PositiveFixedPercentage` timing value (e.g. `p:cTn/@accel`
 * or `@decel`) into a fraction in the range 0..1. PowerPoint stores these as an
 * integer count of 1000ths of a percent, so `50000` means 50% (fraction 0.5).
 *
 * Returns `undefined` for absent, unparseable, or non-positive values so a
 * `0` acceleration does not register as easing.
 */
export function parseTimingPercentFraction(raw: unknown): number | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const parsed = Number.parseInt(String(raw), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return undefined;
	}
	return Math.min(1, parsed / 100000);
}

export function extractRepeatInfo(cTn: XmlObject): {
	repeatCount?: number;
	autoReverse?: boolean;
} {
	let repeatCount: number | undefined;
	let autoReverse: boolean | undefined;

	const rawRepeat = cTn['@_repeatCount'];
	if (rawRepeat !== undefined) {
		const repeatToken = String(rawRepeat);
		repeatCount = repeatToken === 'indefinite' ? Infinity : Number.parseInt(repeatToken, 10) / 1000;
	}

	if (cTn['@_autoRev'] === '1') {
		autoReverse = true;
	}

	return { repeatCount, autoReverse };
}

export function extractAnimationTargetId(cTn: XmlObject): string | undefined {
	const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
	if (!childTnList) {
		return undefined;
	}

	const animationNodes = [
		...ensureArray(childTnList['p:animEffect']),
		...ensureArray(childTnList['p:anim']),
		...ensureArray(childTnList['p:animMotion']),
		...ensureArray(childTnList['p:animRot']),
		...ensureArray(childTnList['p:animScale']),
		...ensureArray(childTnList['p:set']),
	];

	for (const animationNode of animationNodes) {
		const behavior = animationNode['p:cBhvr'] as XmlObject | undefined;
		const targetElement = behavior?.['p:tgtEl'] as XmlObject | undefined;
		const shapeTarget = targetElement?.['p:spTgt'] as XmlObject | undefined;
		if (shapeTarget?.['@_spid']) {
			return String(shapeTarget['@_spid']);
		}
	}

	const nestedParallels = ensureArray(childTnList['p:par']);
	const nestedSequences = ensureArray(childTnList['p:seq']);
	for (const nestedNode of [...nestedParallels, ...nestedSequences]) {
		const nestedCTn = nestedNode['p:cTn'] as XmlObject | undefined;
		if (!nestedCTn) {
			continue;
		}

		const nestedTarget = extractAnimationTargetId(nestedCTn);
		if (nestedTarget) {
			return nestedTarget;
		}
	}

	return undefined;
}

/**
 * Parse `p:bldLst` from the timing element and attach text-build info
 * to matching animations.
 *
 * Matching is done first by `targetId === spid`. When a `bldP` entry also
 * carries `@bldLvl`, ECMA-376 §19.5.6 ties it to a specific iteration group
 * via `@grpId`. Animations whose `groupId` already equals the bldP `grpId`
 * (set earlier by e.g. {@link extractOleChartBuilds} merge) get their
 * build-level applied even when their `targetId` was assigned independently.
 * This restores the spec-compliant fallback that previously matched only on
 * shape id.
 */
export function applyBuildList(timing: XmlObject, animations: PptxNativeAnimation[]): void {
	const bldLst = timing['p:bldLst'] as XmlObject | undefined;
	if (!bldLst) {
		return;
	}

	const bldPEntries = ensureArray(bldLst['p:bldP']);
	for (const bldP of bldPEntries) {
		const spid = bldP['@_spid'] !== undefined ? String(bldP['@_spid']) : undefined;
		if (!spid) {
			continue;
		}

		const buildType = parseBuildType(bldP['@_build']);
		const groupId = bldP['@_grpId'] !== undefined ? String(bldP['@_grpId']) : undefined;
		const bldLvl =
			bldP['@_bldLvl'] !== undefined ? Number.parseInt(String(bldP['@_bldLvl']), 10) : undefined;

		for (const anim of animations) {
			const matchesShape = anim.targetId === spid;
			// grpId fallback: when the bldP carries an @bldLvl tied to a specific
			// grpId, an animation already carrying that groupId is the intended
			// recipient even if its targetId differs (ECMA-376 §19.5.6).
			const matchesGrp =
				bldLvl !== undefined &&
				groupId !== undefined &&
				anim.groupId !== undefined &&
				anim.groupId === groupId;

			if (matchesShape) {
				anim.buildType = buildType;
				anim.groupId = groupId;
				if (bldLvl !== undefined && !Number.isNaN(bldLvl)) {
					anim.buildLevel = bldLvl;
				}
			} else if (matchesGrp && bldLvl !== undefined && !Number.isNaN(bldLvl)) {
				anim.buildLevel = bldLvl;
				if (anim.buildType === undefined) {
					anim.buildType = buildType;
				}
			}
		}
	}
}

export function parseBuildType(value: unknown): PptxTextBuildType {
	if (!value) {
		return 'allAtOnce';
	}
	const str = String(value).toLowerCase();
	if (str === 'p' || str === 'byparagraph') {
		return 'byParagraph';
	}
	if (str === 'word' || str === 'byword') {
		return 'byWord';
	}
	if (str === 'char' || str === 'bychar') {
		return 'byChar';
	}
	return 'allAtOnce';
}

/**
 * Extract trigger shape ID from a `p:cTn` node's start condition list.
 */
export function extractTriggerShapeId(cTn: XmlObject): string | undefined {
	const stCondList = cTn['p:stCondLst'] as XmlObject | undefined;
	if (!stCondList) {
		return undefined;
	}

	const conditions = ensureArray(stCondList['p:cond']);
	for (const cond of conditions) {
		const evt = cond['@_evt'];
		if (evt !== 'onClick') {
			continue;
		}

		const tgtEl = cond['p:tgtEl'] as XmlObject | undefined;
		if (!tgtEl) {
			continue;
		}

		const spTgt = tgtEl['p:spTgt'] as XmlObject | undefined;
		if (spTgt?.['@_spid']) {
			return String(spTgt['@_spid']);
		}
	}

	return undefined;
}

/**
 * `p:cTn` attributes that have first-class typed homes elsewhere on
 * {@link PptxNativeAnimation}. They are excluded from the opaque
 * round-trip map collected by {@link captureRoundTripCTnAttrs} so we don't
 * duplicate state and risk drift between typed/untyped surfaces.
 */
const TYPED_CTN_ATTRS: ReadonlySet<string> = new Set([
	'@_id',
	'@_nodeType',
	'@_presetClass',
	'@_presetID',
	'@_presetSubtype',
	'@_dur',
	'@_delay',
	'@_repeatCount',
	'@_autoRev',
	'@_fill',
	'@_accel',
	'@_decel',
	'@_restart',
	'@_grpId',
	// afterEffect is surfaced as a typed boolean separately
	'@_afterEffect',
]);

/**
 * `p:cTn` attribute names that the parse layer must capture verbatim so the
 * write layer can re-emit them. Most are documented in ECMA-376 §19.5.27
 * (CT_TLCommonTimeNodeData) and don't have first-class semantics in our
 * editor model — they pass straight through.
 */
const OPAQUE_CTN_ATTRS: ReadonlyArray<string> = [
	'@_evtFilter',
	'@_display',
	'@_masterRel',
	'@_nodePh',
	'@_endSync',
	'@_progress',
	// Additional CT_TLCommonTimeNodeData attributes we don't yet model.
	'@_syncBehavior',
	'@_tmFilter',
];

/**
 * Collect opaque `p:cTn` attributes (and `p:subTnLst`) that don't have a
 * typed home on {@link PptxNativeAnimation} so they can round-trip through
 * parse → save unchanged.
 *
 * Keys are returned with the underlying parser's `@_` prefix preserved (or
 * the literal `p:subTnLst` for the sub-time-node list). Returns `undefined`
 * when nothing of interest was present.
 */
export function captureRoundTripCTnAttrs(cTn: XmlObject): Record<string, unknown> | undefined {
	const out: Record<string, unknown> = {};
	for (const key of OPAQUE_CTN_ATTRS) {
		if (cTn[key] !== undefined && !TYPED_CTN_ATTRS.has(key)) {
			out[key] = cTn[key];
		}
	}
	const subTnLst = cTn['p:subTnLst'];
	if (subTnLst !== undefined) {
		out['p:subTnLst'] = subTnLst;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parse the `p:cTn/@afterEffect` boolean. PowerPoint emits both `'1'` and
 * `'true'` forms; both `'0'` and `'false'` (and absence) result in
 * `undefined` so callers can treat it as a tri-state when needed.
 */
export function extractAfterEffect(cTn: XmlObject): boolean | undefined {
	const raw = cTn['@_afterEffect'];
	if (raw === undefined) {
		return undefined;
	}
	if (raw === '1' || raw === 'true') {
		return true;
	}
	if (raw === '0' || raw === 'false') {
		return false;
	}
	return undefined;
}

export function ensureArray(value: unknown): XmlObject[] {
	if (!value) {
		return [];
	}
	if (!Array.isArray(value)) {
		return isXmlObject(value) ? [value] : [];
	}
	return value.filter((entry): entry is XmlObject => isXmlObject(entry));
}

export function isXmlObject(value: unknown): value is XmlObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Known OOXML condition event values. */
const VALID_CONDITION_EVENTS = new Set<string>([
	'onBegin',
	'onEnd',
	'begin',
	'end',
	'onClick',
	'onMouseOver',
	'onMouseOut',
	'onNext',
	'onPrev',
	'onStopAudio',
]);

/**
 * Parse a single `p:cond` XML element into a structured {@link AnimationCondition}.
 *
 * Extracts the event type (`@_evt`), delay (`@_delay`), target time node
 * (`@_tn`), and target element information (`p:tgtEl`).
 */
export function parseCondition(condXml: XmlObject): AnimationCondition {
	const condition: AnimationCondition = {};

	// Event type
	const evt = condXml['@_evt'];
	if (evt !== undefined) {
		const evtStr = String(evt);
		if (VALID_CONDITION_EVENTS.has(evtStr)) {
			condition.event = evtStr as AnimationConditionEvent;
		}
	}

	// Delay
	const delay = condXml['@_delay'];
	if (delay !== undefined) {
		const delayStr = String(delay);
		condition.delay = delayStr === 'indefinite' ? -1 : Number.parseInt(delayStr, 10);
	}

	// Target time node reference
	const tn = condXml['@_tn'];
	if (tn !== undefined) {
		const tnNum = Number.parseInt(String(tn), 10);
		if (!Number.isNaN(tnNum)) {
			condition.targetTimeNodeId = tnNum;
		}
	}

	// Target element
	const tgtEl = condXml['p:tgtEl'] as XmlObject | undefined;
	if (tgtEl) {
		condition.target = parseTimeTargetElement(tgtEl);
		if (condition.target?.type === 'shape') {
			condition.targetShapeId = condition.target.shapeId;
		} else if (condition.target?.type === 'slide') {
			condition.targetSlide = true;
		}
	}

	return condition;
}

/**
 * Parse a `p:stCondLst` or `p:endCondLst` XML element into an array
 * of structured {@link AnimationCondition} objects.
 *
 * Returns `undefined` if the condition list is missing or empty.
 */
export function parseConditionList(
	condListXml: XmlObject | undefined,
): AnimationCondition[] | undefined {
	if (!condListXml) {
		return undefined;
	}

	const conditions = ensureArray(condListXml['p:cond']);
	if (conditions.length === 0) {
		return undefined;
	}

	const result: AnimationCondition[] = [];
	for (const condXml of conditions) {
		result.push(parseCondition(condXml));
	}

	return result.length > 0 ? result : undefined;
}

/**
 * Serialize a single {@link AnimationCondition} back to an OOXML `p:cond`
 * XML object for round-trip fidelity.
 */
export function serializeCondition(condition: AnimationCondition): XmlObject {
	const condXml: XmlObject = {};

	if (condition.event !== undefined) {
		condXml['@_evt'] = condition.event;
	}

	if (condition.delay !== undefined) {
		condXml['@_delay'] = condition.delay === -1 ? 'indefinite' : String(condition.delay);
	}

	if (condition.targetTimeNodeId !== undefined) {
		condXml['@_tn'] = String(condition.targetTimeNodeId);
	}

	// Target element
	if (condition.target) {
		condXml['p:tgtEl'] = serializeTimeTargetElement(condition.target);
	} else if (condition.targetShapeId || condition.targetSlide) {
		const tgtEl: XmlObject = {};
		if (condition.targetShapeId) {
			tgtEl['p:spTgt'] = { '@_spid': condition.targetShapeId };
		}
		if (condition.targetSlide) {
			tgtEl['p:sldTgt'] = {};
		}
		condXml['p:tgtEl'] = tgtEl;
	}

	return condXml;
}

/**
 * Serialize an array of {@link AnimationCondition} objects back to an
 * OOXML condition list XML object (`p:stCondLst` or `p:endCondLst`).
 *
 * Returns `undefined` if the array is empty or `undefined`.
 */
export function serializeConditionList(
	conditions: AnimationCondition[] | undefined,
): XmlObject | undefined {
	if (!conditions || conditions.length === 0) {
		return undefined;
	}

	const serialized = conditions.map(serializeCondition);

	return {
		'p:cond': serialized.length === 1 ? serialized[0] : serialized,
	};
}
