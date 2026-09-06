/**
 * Per-`p:cTn`-node extraction for the native OOXML animation timing-tree
 * walk: trigger resolution and the (large) animation-entry field mapping.
 * Extracted from `native-animation-timing-walk` to keep file sizes
 * manageable.
 */
import type {
	PptxAnimationTrigger,
	PptxNativeAnimation,
	PptxTextAnimationTarget,
	XmlObject,
} from '../types';
import { parseAnimEffectFilter } from './animation-effect-filter-parsing';
import type { AnimationGroupContext } from './animation-group-context';
import { extractAnimationTarget } from './animation-target-build-helpers';
import { extractCTnTimingAttrs } from './animation-timing-attrs';
import { extractAfterAnimationFromSubTnLst } from './native-animation-after-effect';
import { extractChildKeyframeAttrName } from './native-animation-attr-name';
import { extractAttributeAnimations } from './native-animation-attribute-components';
import { extractChildCBhvrAttrs, extractChildCalcMode } from './native-animation-cbhvr-attrs';
import { extractChildAutoReverseTiming } from './native-animation-child-timing';
import {
	extractColorAnimation,
	extractTextTarget,
	extractIterate,
	extractCommand,
	readTimingAttr,
	extractStartConditionDelayMs,
	extractChildBehaviourDurationMs,
} from './native-animation-extended-helpers';
import {
	extractSoundAction,
	extractChildMotionValues,
	extractChildKeyframes,
	extractRepeatInfo,
	ensureArray,
	parseConditionList,
	captureRoundTripCTnAttrs,
	extractAfterEffect,
	parseTimingPercentFraction,
} from './native-animation-helpers';
import { extractSetAnimations } from './native-animation-set-components';

/**
 * Determine this node's trigger from its `@_nodeType` attribute, falling
 * back to the inherited trigger, then refine it against `p:stCondLst`
 * (an explicit positive `@delay` means `afterDelay`; an `onMouseOver`
 * start-condition event means `onHover`).
 */
export function resolveNodeTrigger(
	cTn: XmlObject,
	currentTrigger: PptxAnimationTrigger,
): PptxAnimationTrigger {
	const nodeType = String(cTn['@_nodeType'] || '');
	let trigger = currentTrigger;
	if (nodeType === 'afterEffect' || nodeType === 'afterPrevious' || nodeType === 'afterPrev') {
		trigger = 'afterPrevious';
	} else if (nodeType === 'withPrevious' || nodeType === 'withEffect') {
		trigger = 'withPrevious';
	} else if (nodeType === 'clickEffect') {
		trigger = 'onClick';
	} else if (nodeType === 'mouseOver' || nodeType === 'onMouseOver' || nodeType === 'hoverEffect') {
		trigger = 'onHover';
	}

	// Check start conditions for afterDelay triggers and hover events
	const stCondList = cTn['p:stCondLst'] as XmlObject | undefined;
	if (stCondList) {
		const conditions = ensureArray(stCondList['p:cond']);
		for (const condition of conditions) {
			const conditionDelay = condition['@_delay'];
			if (conditionDelay !== undefined && Number.parseInt(String(conditionDelay), 10) > 0) {
				trigger = 'afterDelay';
			}
			// Detect onMouseOver/onMouseOut events in start conditions
			const condEvt = condition['@_evt'];
			if (condEvt === 'onMouseOver') {
				trigger = 'onHover';
			}
		}
	}

	return trigger;
}

/**
 * Build the flat {@link PptxNativeAnimation} entry for one `p:cTn` timing
 * node, or `undefined` when the node describes no recognisable effect (no
 * `presetClass`/`@filter`, or no resolvable target).
 *
 * At each `p:cTn` node, extracts motion/rotation/scale/color data, and
 * collects sound and text-target information.
 */
export function buildTimingNodeAnimation(
	cTn: XmlObject,
	trigger: PptxAnimationTrigger,
	group: AnimationGroupContext,
): PptxNativeAnimation | undefined {
	const presetClass = cTn['@_presetClass'] as string | undefined;
	const presetId = cTn['@_presetID'] ? Number.parseInt(String(cTn['@_presetID']), 10) : undefined;
	const presetSubtype =
		cTn['@_presetSubtype'] !== undefined
			? Number.parseInt(String(cTn['@_presetSubtype']), 10)
			: undefined;
	// An effect's `p:cTn` rarely carries its own timing. PowerPoint puts the
	// duration on the child BEHAVIOUR's `p:cTn` (`p:animEffect/p:cBhvr/p:cTn
	// @dur`) and the delay in the start-condition list
	// (`p:stCondLst/p:cond @delay`). Reading only the attributes on this node
	// dropped both, so a "fade in after 1s over 0.4s" effect played
	// immediately at the 500ms default and no longer matched PowerPoint.
	const childAutoReverseTiming = extractChildAutoReverseTiming(cTn, ensureArray);
	const durationMs =
		readTimingAttr(cTn['@_dur']) ??
		childAutoReverseTiming?.durationMs ??
		extractChildBehaviourDurationMs(cTn, ensureArray);
	const delayMs = readTimingAttr(cTn['@_delay']) ?? extractStartConditionDelayMs(cTn);
	const accel = parseTimingPercentFraction(cTn['@_accel']);
	const decel = parseTimingPercentFraction(cTn['@_decel']);

	// Parse structured conditions from stCondLst and endCondLst
	const stCondList = cTn['p:stCondLst'] as XmlObject | undefined;
	const startConditions = parseConditionList(stCondList);
	const endCondListXml = cTn['p:endCondLst'] as XmlObject | undefined;
	const endConditions = parseConditionList(endCondListXml);

	// Extract sound actions from this timing node
	const soundInfo = extractSoundAction(cTn);

	// Preserve p:endCondLst for lossless round-trip
	const rawEndCondLst = endCondListXml;

	// Extract the target shape ID from child behavior nodes. A shape
	// target's `subShapeId` (from `p:spTgt/p:subSp`) names the actual
	// descendant shape inside a group when the effect targets one
	// member of a group without ungrouping it; it is the real
	// playback target, so it wins over the enclosing group's own id.
	const target = extractAnimationTarget(cTn);
	const targetId =
		target?.type === 'shape'
			? (target.subShapeId ?? target.shapeId)
			: target?.type === 'ink'
				? target.shapeId
				: undefined;
	const childTnListForFilter = cTn['p:childTnLst'] as XmlObject | undefined;
	const effectFilter = parseAnimEffectFilter(childTnListForFilter);
	// A node with no recognised presetClass but a parsed `@filter` still
	// describes a real effect (third-party-authored decks routinely omit
	// presetClass/presetID and rely on the filter string alone), so it must
	// not be dropped. Requiring `presetClass` here used to silently discard
	// those nodes entirely.
	if (!((presetClass || effectFilter) && target)) {
		return undefined;
	}

	// Validate preset class against known OOXML preset classes. When the
	// attribute itself is absent/invalid, derive entr/exit from the
	// filter's `@transition` ("out" -> exit, anything else -> the OOXML
	// default of a reveal) so every downstream consumer that branches on
	// `presetClass` (fill/hide bookkeeping, `resolveEffect`'s filter
	// fallback) sees accurate in/out semantics without special-casing.
	const validPresetClass = (
		presetClass && ['entr', 'exit', 'emph', 'path'].includes(presetClass)
			? presetClass
			: effectFilter
				? effectFilter.transition === 'out'
					? 'exit'
					: 'entr'
				: undefined
	) as PptxNativeAnimation['presetClass'];

	const childTnList = childTnListForFilter;
	const childMotion = extractChildMotionValues(childTnList);
	const repeatInfo = extractRepeatInfo(cTn);
	const colorAnimation = extractColorAnimation(childTnList);
	const iterateInfo = extractIterate(cTn);
	const cmdInfo = extractCommand(childTnList);
	const textTarget = extractTextTargetFromCTn(cTn);
	const keyframes = extractChildKeyframes(childTnList);
	const keyframeAttrName = extractChildKeyframeAttrName(childTnList);
	const attributeAnimations = extractAttributeAnimations(childTnList);
	const setAnimations = extractSetAnimations(childTnList);
	// Round-trip surface for cTn attrs that don't have a typed home.
	const roundTripAttrs = captureRoundTripCTnAttrs(cTn);
	const afterEffectFlag = extractAfterEffect(cTn);
	const parsedAfterAnimation = extractAfterAnimationFromSubTnLst(cTn);
	const timingAttrs = extractCTnTimingAttrs(cTn);
	const calcMode = extractChildCalcMode(childTnList);
	const cBhvrAttrs = extractChildCBhvrAttrs(childTnList);
	const nodeIdRaw = cTn['@_id'];
	const nodeId = nodeIdRaw !== undefined ? Number.parseInt(String(nodeIdRaw), 10) : undefined;

	return {
		targetId,
		target,
		nodeId: nodeId !== undefined && !Number.isNaN(nodeId) ? nodeId : undefined,
		calcMode,
		...cBhvrAttrs,
		trigger,
		presetClass: validPresetClass,
		presetId,
		presetSubtype,
		durationMs,
		delayMs,
		accel,
		decel,
		fill: timingAttrs.fill,
		restart: timingAttrs.restart,
		repeatDurMs: timingAttrs.repeatDurMs,
		speedPct: timingAttrs.speedPct,
		seqConcurrent: group.seqConcurrent,
		seqNextAction: group.seqNextAction,
		seqPrevAction: group.seqPrevAction,
		triggerDelayMs: trigger === 'afterDelay' ? delayMs : undefined,
		motionPath: childMotion.motionPath,
		motionOrigin: childMotion.motionOrigin,
		motionPathRotateAuto: childMotion.motionPathRotateAuto,
		motionPathEditMode: childMotion.motionPathEditMode,
		motionPtsTypes: childMotion.motionPtsTypes,
		motionPathRotationAngle: childMotion.motionPathRotationAngle,
		motionPathRotationCenterX: childMotion.motionPathRotationCenterX,
		motionPathRotationCenterY: childMotion.motionPathRotationCenterY,
		rotationBy: childMotion.rotationBy,
		rotationFrom: childMotion.rotationFrom,
		rotationTo: childMotion.rotationTo,
		scaleByX: childMotion.scaleByX,
		scaleByY: childMotion.scaleByY,
		scaleFromX: childMotion.scaleFromX,
		scaleFromY: childMotion.scaleFromY,
		scaleToX: childMotion.scaleToX,
		scaleToY: childMotion.scaleToY,
		scaleZoomContents: childMotion.scaleZoomContents,
		keyframes: keyframes ?? undefined,
		attrName: keyframeAttrName,
		attributeAnimations,
		setAnimations,
		repeatCount: repeatInfo.repeatCount,
		autoReverse: repeatInfo.autoReverse ?? childAutoReverseTiming?.autoReverse,
		soundRId: soundInfo.soundRId,
		stopSound: soundInfo.stopSound,
		startConditions: startConditions ?? undefined,
		endConditions: endConditions ?? undefined,
		rawEndCondLst: rawEndCondLst ?? undefined,
		colorAnimation: colorAnimation ?? undefined,
		iterate: iterateInfo ?? undefined,
		commandType: cmdInfo.commandType,
		commandString: cmdInfo.commandString,
		textTarget: textTarget ?? undefined,
		cTnAttributes: roundTripAttrs,
		afterEffect: afterEffectFlag,
		afterAnimationAction: parsedAfterAnimation?.action,
		afterAnimationColor: parsedAfterAnimation?.color,
		afterAnimationColorRef: parsedAfterAnimation?.colorRef,
		groupAutoStart: group.groupAutoStart,
		parGroupIndex: group.parGroupIndex,
		parGroupDelayMs: group.parGroupDelayMs,
		effectFilter,
	};
}

/**
 * Extract text-level animation target (character or paragraph range)
 * from a `p:cTn` node's child animation behavior elements.
 *
 * Checks `p:animEffect`, `p:anim`, and `p:set` nodes for `p:spTgt/p:txEl`
 * sub-elements that specify text-level targeting.
 *
 * @param cTn - The common timing node to inspect.
 * @returns Text animation target with range info, or `undefined`.
 */
function extractTextTargetFromCTn(cTn: XmlObject): PptxTextAnimationTarget | undefined {
	const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
	if (!childTnList) {
		return undefined;
	}

	const animNodes = [
		...ensureArray(childTnList['p:animEffect']),
		...ensureArray(childTnList['p:anim']),
		...ensureArray(childTnList['p:set']),
	];

	for (const animNode of animNodes) {
		const behavior = animNode['p:cBhvr'] as XmlObject | undefined;
		const tgtEl = behavior?.['p:tgtEl'] as XmlObject | undefined;
		const spTgt = tgtEl?.['p:spTgt'] as XmlObject | undefined;
		if (spTgt) {
			const result = extractTextTarget(spTgt);
			if (result) {
				return result;
			}
		}
	}

	return undefined;
}
