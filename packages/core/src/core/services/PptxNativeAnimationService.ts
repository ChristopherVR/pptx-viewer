/**
 * Service for parsing native OOXML animation timing trees from slide XML.
 *
 * Native animations follow the full OOXML timing model (ISO/IEC 29500-1 S19.5),
 * with nested `p:par`, `p:seq`, and `p:excl` containers forming a tree of
 * timed animation effects. This service walks that tree and extracts a flat
 * list of {@link PptxNativeAnimation} objects suitable for playback.
 *
 * @module PptxNativeAnimationService
 */
import type {
	PptxAnimationTrigger,
	PptxNativeAnimation,
	PptxTextAnimationTarget,
	XmlObject,
} from '../types';
import { parseAnimEffectFilter } from './animation-effect-filter-parsing';
import { childGroupContext, createGroupContext, isMainSequence } from './animation-group-context';
import type { AnimationGroupContext } from './animation-group-context';
import { extractAnimationTarget } from './animation-target-build-helpers';
import { extractCTnTimingAttrs, extractSeqAttrs } from './animation-timing-attrs';
import { extractChildKeyframeAttrName } from './native-animation-attr-name';
import { extractAttributeAnimations } from './native-animation-attribute-components';
import { extractChildCBhvrAttrs, extractChildCalcMode } from './native-animation-cbhvr-attrs';
import { extractChildAutoReverseTiming } from './native-animation-child-timing';
import {
	extractColorAnimation,
	extractTextTarget,
	extractIterate,
	extractCommand,
	extractOleChartBuilds,
	extractSmartArtBuilds,
	extractGraphicBuilds,
	readTimingAttr,
	extractStartConditionDelayMs,
	extractChildBehaviourDurationMs,
} from './native-animation-extended-helpers';
import {
	extractSoundAction,
	extractChildMotionValues,
	extractChildKeyframes,
	extractRepeatInfo,
	applyBuildList,
	extractTriggerShapeId,
	ensureArray,
	parseConditionList,
	captureRoundTripCTnAttrs,
	extractAfterEffect,
	parseTimingPercentFraction,
} from './native-animation-helpers';
import { resolveSlideTimingNode } from './slide-transition-envelope';

/**
 * True when a `p:seq` is an INTERACTIVE sequence: one that only runs when the
 * viewer clicks a specific shape (`p:cTn/p:stCondLst/p:cond[@evt="onClick"]`
 * with a `p:spTgt/@spid`), rather than a step of the slide's main sequence.
 *
 * Such a sequence is owned exclusively by
 * {@link PptxNativeAnimationService.parseInteractiveSequences}, which re-walks
 * it and tags every effect `onShapeClick`. The generic timing-tree walk must
 * therefore SKIP it: walking it under the inherited `onClick` trigger emitted a
 * duplicate of every interactive effect as a phantom MAIN-sequence click step,
 * so pressing Next in a slide show silently burned a click doing nothing
 * instead of advancing the slide (any deck with a click-to-pause video, e.g.
 * `e2e/fixtures/solution-explorer.pptx` slide 2, froze on that slide for two
 * presses and looked like "the slide show does not animate").
 */
function isInteractiveSequence(seq: XmlObject): boolean {
	const cTn = seq['p:cTn'] as XmlObject | undefined;
	if (!cTn || String(cTn['@_nodeType'] || '') === 'mainSeq') {
		return false;
	}
	return extractTriggerShapeId(cTn) !== undefined;
}

/**
 * Interface for parsing native OOXML animation data from slide XML.
 */
export interface IPptxNativeAnimationService {
	/**
	 * Parse the native OOXML timing tree from a slide XML object.
	 * @param slideXml - The full slide XML object.
	 * @returns Array of native animations, or `undefined` if no timing data exists.
	 */
	parseNativeAnimations(slideXml: XmlObject): PptxNativeAnimation[] | undefined;
}

/**
 * Concrete implementation that recursively walks the OOXML `p:timing` tree
 * and extracts animation effect data into a flat array.
 */
export class PptxNativeAnimationService implements IPptxNativeAnimationService {
	/**
	 * Assigns each `p:excl` container encountered while walking one slide's
	 * timing tree its own id, so playback can tell two independent exclusive
	 * groups apart (see {@link PptxNativeAnimation.exclGroupId}). Reset at the
	 * start of every {@link parseNativeAnimations} call; this service instance
	 * is reused across slides, and ids only need to be unique within one
	 * slide's own animation list.
	 */
	private exclGroupSeq = 0;

	/**
	 * Parse native OOXML animations from a slide's timing tree.
	 *
	 * Extracts the `p:timing/p:tnLst` structure, recursively walks the nested
	 * `p:par`/`p:seq`/`p:excl` containers, parses interactive sequences, and
	 * applies build list metadata to the resulting animations.
	 *
	 * @param slideXml - The full slide XML object.
	 * @returns Array of native animations, or `undefined` if the slide has no
	 *          timing data or parsing fails.
	 */
	public parseNativeAnimations(slideXml: XmlObject): PptxNativeAnimation[] | undefined {
		this.exclGroupSeq = 0;
		try {
			// `resolveSlideTimingNode` also finds a `p:timing` wrapped in a
			// slide-root `mc:AlternateContent` envelope (issue #132 deck).
			const timing = resolveSlideTimingNode(slideXml?.['p:sld'] as XmlObject | undefined);
			if (!timing || typeof timing !== 'object') {
				return undefined;
			}

			const tnLst = (timing as XmlObject)['p:tnLst'];
			if (!tnLst || typeof tnLst !== 'object') {
				return undefined;
			}

			const animations: PptxNativeAnimation[] = [];
			const rootPar = (tnLst as XmlObject)['p:par'];
			if (!rootPar || typeof rootPar !== 'object') {
				return undefined;
			}

			this.walkTimingTree(rootPar as XmlObject, animations, 'onClick', createGroupContext());

			// Parse interactive sequences (sibling p:seq nodes with trigger shape)
			this.parseInteractiveSequences(rootPar as XmlObject, animations);

			// Walk for media (p:audio / p:video) entries and emit a
			// PptxNativeAnimation per node so the timeline order is preserved
			// alongside other animations. Media-trim metadata remains the
			// responsibility of PptxHandlerRuntimeMediaTimingParsing — this
			// pass only mints the typed entries.
			this.parseMediaAnimations(timing as XmlObject, animations);

			// Parse p:bldOleChart entries and attach OLE chart build info
			// before running the bldP pass — applyBuildList relies on the
			// groupId being set so its grpId-fallback can find the right
			// animation node.
			const bldLst = (timing as XmlObject)['p:bldLst'] as XmlObject | undefined;
			const oleChartBuilds = extractOleChartBuilds(bldLst);
			for (const entry of oleChartBuilds) {
				for (const anim of animations) {
					if (anim.targetId === entry.spid) {
						anim.groupId = entry.grpId;
						// Preserve the staged-build token so the timeline can reveal the
						// OLE chart by series / category / element (PowerPoint parity).
						anim.oleChartBuild = entry.bld;
					}
				}
			}

			// SmartArt diagram builds (p:bldDgm) — attach the build mode so
			// downstream renderers / writers know which diagram-build sequence
			// to emit.
			const smartArtBuilds = extractSmartArtBuilds(bldLst);
			for (const entry of smartArtBuilds) {
				for (const anim of animations) {
					if (anim.targetId === entry.spid) {
						anim.smartArtBuild = entry.bld;
					}
				}
			}

			// Generic graphic-frame builds (p:bldGraphic) — attach the build
			// mode for non-OLE graphic frames (pictures, generic content).
			const graphicBuilds = extractGraphicBuilds(bldLst);
			for (const entry of graphicBuilds) {
				for (const anim of animations) {
					if (anim.targetId === entry.shapeId) {
						anim.graphicBuildProperties = entry.build;
						anim.graphicBuild = entry.build.mode === 'asOne' ? 'asOne' : entry.build.build;
						anim.groupId ??= entry.groupId;
					}
				}
			}

			// Parse p:bldLst to attach text build info to animations.
			// Run after the OLE/SmartArt/Graphic merges so the grpId fallback
			// in applyBuildList can reach groupId-tagged animations whose
			// targetId differs from the bldP's spid.
			applyBuildList(timing as XmlObject, animations);

			return animations.length > 0 ? animations : undefined;
		} catch (error) {
			console.warn('Failed to parse native animations:', error);
			return undefined;
		}
	}

	/**
	 * Recursively walk a timing tree node, extracting animation effects.
	 *
	 * At each `p:cTn` node, determines the trigger type from the nodeType
	 * attribute and start conditions, extracts motion/rotation/scale/color
	 * data, and collects sound and text-target information. Then recurses
	 * into `p:childTnLst` and direct child containers.
	 *
	 * @param node - Current XML node in the timing tree.
	 * @param animations - Mutable array to collect discovered animations.
	 * @param currentTrigger - Inherited trigger type from parent context.
	 * @param group - Click-group / effect-wrapper context inherited from the
	 *        parent node. See `animation-group-context` for why the flat list
	 *        needs it.
	 */
	private walkTimingTree(
		node: XmlObject,
		animations: PptxNativeAnimation[],
		currentTrigger: PptxAnimationTrigger,
		group: AnimationGroupContext = createGroupContext(),
	): void {
		if (!node) {
			return;
		}

		const cTn = node['p:cTn'] as XmlObject | undefined;
		if (cTn) {
			const nodeType = String(cTn['@_nodeType'] || '');
			const presetClass = cTn['@_presetClass'] as string | undefined;
			const presetId = cTn['@_presetID']
				? Number.parseInt(String(cTn['@_presetID']), 10)
				: undefined;
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

			// Determine trigger from nodeType attribute, falling back to inherited trigger
			let trigger = currentTrigger;
			if (nodeType === 'afterEffect' || nodeType === 'afterPrevious' || nodeType === 'afterPrev') {
				trigger = 'afterPrevious';
			} else if (nodeType === 'withPrevious' || nodeType === 'withEffect') {
				trigger = 'withPrevious';
			} else if (nodeType === 'clickEffect') {
				trigger = 'onClick';
			} else if (
				nodeType === 'mouseOver' ||
				nodeType === 'onMouseOver' ||
				nodeType === 'hoverEffect'
			) {
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

			// Parse structured conditions from stCondLst and endCondLst
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
			if ((presetClass || effectFilter) && target) {
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
				const textTarget = this.extractTextTargetFromCTn(cTn);
				const keyframes = extractChildKeyframes(childTnList);
				const keyframeAttrName = extractChildKeyframeAttrName(childTnList);
				const attributeAnimations = extractAttributeAnimations(childTnList);
				// Round-trip surface for cTn attrs that don't have a typed home.
				const roundTripAttrs = captureRoundTripCTnAttrs(cTn);
				const afterEffectFlag = extractAfterEffect(cTn);
				const timingAttrs = extractCTnTimingAttrs(cTn);
				const calcMode = extractChildCalcMode(childTnList);
				const cBhvrAttrs = extractChildCBhvrAttrs(childTnList);
				const nodeIdRaw = cTn['@_id'];
				const nodeId = nodeIdRaw !== undefined ? Number.parseInt(String(nodeIdRaw), 10) : undefined;

				animations.push({
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
					groupAutoStart: group.groupAutoStart,
					parGroupIndex: group.parGroupIndex,
					parGroupDelayMs: group.parGroupDelayMs,
					effectFilter,
				});
			}

			// Recurse into child containers (parallel, sequence, exclusive).
			// A direct `p:par` child of the mainSeq is a click step, so its own
			// start conditions decide whether that step waits for a click.
			const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
			if (childTnList) {
				const isClickLevel = isMainSequence(cTn);
				const parallels = ensureArray(childTnList['p:par']);
				const sequences = ensureArray(childTnList['p:seq']);
				const exclusives = ensureArray(childTnList['p:excl']);
				for (const parallel of parallels) {
					const mainSequenceId = cTn['@_id'];
					this.walkTimingTree(
						parallel,
						animations,
						trigger,
						childGroupContext(group, parallel['p:cTn'] as XmlObject | undefined, {
							isClickLevelGroup: isClickLevel,
							mainSequence:
								isClickLevel && mainSequenceId !== undefined
									? {
											autoStart: group.seqConcurrent === true && group.seqNextAction === 'seek',
											id: String(mainSequenceId),
										}
									: undefined,
						}),
					);
				}
				for (const sequence of sequences) {
					// Interactive sequences belong to `parseInteractiveSequences`.
					if (isInteractiveSequence(sequence)) {
						continue;
					}
					// `@concurrent`/`@nextAc`/`@prevAc` are attributes of `<p:seq>`
					// itself (ECMA-376 S19.5.60), not of its nested `<p:cTn>`.
					const seqAttrs = extractSeqAttrs(sequence);
					this.walkTimingTree(sequence, animations, trigger, { ...group, ...seqAttrs });
				}
				// Exclusive containers: animations are mutually exclusive at runtime
				for (const excl of exclusives) {
					const exclAnims: PptxNativeAnimation[] = [];
					this.walkTimingTree(excl, exclAnims, trigger, group);
					const exclGroupId = this.exclGroupSeq++;
					for (const a of exclAnims) {
						a.exclusive = true;
						a.exclGroupId = exclGroupId;
						animations.push(a);
					}
				}
			}
		}

		// Also walk direct child p:par/p:seq nodes (not wrapped in p:cTn)
		const directParallels = ensureArray(node['p:par']);
		const directSequences = ensureArray(node['p:seq']);
		for (const parallel of directParallels) {
			this.walkTimingTree(
				parallel,
				animations,
				currentTrigger,
				childGroupContext(group, parallel['p:cTn'] as XmlObject | undefined, {
					isClickLevelGroup: false,
				}),
			);
		}
		for (const sequence of directSequences) {
			// Interactive sequences belong to `parseInteractiveSequences`.
			if (isInteractiveSequence(sequence)) {
				continue;
			}
			// `@concurrent`/`@nextAc`/`@prevAc` are attributes of `<p:seq>` itself
			// (ECMA-376 S19.5.60), not of its nested `<p:cTn>`.
			const seqAttrs = extractSeqAttrs(sequence);
			this.walkTimingTree(sequence, animations, currentTrigger, { ...group, ...seqAttrs });
		}
	}

	/**
	 * Walk the timing tree for `p:audio` / `p:video` nodes and emit a
	 * `kind: 'media'` PptxNativeAnimation entry per media node, capturing the
	 * target shape id, optional `afterEffect` flag, and opaque round-trip
	 * cTn attributes. This puts media playback nodes in the same typed list
	 * as preset-driven animations so callers can reason about timeline order.
	 *
	 * Trim values, fade durations, bookmarks etc. are intentionally NOT
	 * captured here — they remain owned by
	 * `PptxHandlerRuntimeMediaTimingParsing`'s media-timing map.
	 */
	private parseMediaAnimations(timing: XmlObject, animations: PptxNativeAnimation[]): void {
		this.collectMediaNodes(timing, animations);
	}

	/**
	 * Recursively descend into the timing tree and push a media-kind entry
	 * for each `p:audio` / `p:video` node found.
	 */
	private collectMediaNodes(node: XmlObject | undefined, animations: PptxNativeAnimation[]): void {
		if (!node) {
			return;
		}

		for (const tag of ['p:audio', 'p:video'] as const) {
			const mediaNodes = ensureArray(node[tag]);
			for (const mediaNode of mediaNodes) {
				const cMediaNode = mediaNode['p:cMediaNode'] as XmlObject | undefined;
				if (!cMediaNode) {
					continue;
				}
				const tgtEl = cMediaNode['p:tgtEl'] as XmlObject | undefined;
				const spTgt = tgtEl?.['p:spTgt'] as XmlObject | undefined;
				const targetId = spTgt?.['@_spid'] ? String(spTgt['@_spid']) : undefined;
				if (!targetId) {
					continue;
				}

				const cTn = cMediaNode['p:cTn'] as XmlObject | undefined;
				const roundTripAttrs = cTn ? captureRoundTripCTnAttrs(cTn) : undefined;
				const afterEffectFlag = cTn ? extractAfterEffect(cTn) : undefined;
				const durationMs =
					cTn && cTn['@_dur'] !== undefined && String(cTn['@_dur']) !== 'indefinite'
						? Number.parseInt(String(cTn['@_dur']), 10)
						: undefined;

				animations.push({
					kind: 'media',
					mediaType: tag === 'p:audio' ? 'audio' : 'video',
					targetId,
					durationMs:
						durationMs !== undefined && !Number.isNaN(durationMs) ? durationMs : undefined,
					cTnAttributes: roundTripAttrs,
					afterEffect: afterEffectFlag,
				});
			}
		}

		// Descend into the timing tree containers.
		const cTn = node['p:cTn'] as XmlObject | undefined;
		const childTnList = cTn?.['p:childTnLst'] as XmlObject | undefined;
		if (childTnList) {
			for (const container of ['p:par', 'p:seq', 'p:excl'] as const) {
				const children = ensureArray(childTnList[container]);
				for (const child of children) {
					this.collectMediaNodes(child, animations);
				}
			}
			// Also inspect direct media children inside childTnLst.
			this.collectMediaNodes(childTnList, animations);
		}

		for (const container of ['p:par', 'p:seq', 'p:excl', 'p:tnLst'] as const) {
			const children = ensureArray(node[container]);
			for (const child of children) {
				this.collectMediaNodes(child, animations);
			}
		}
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
	private extractTextTargetFromCTn(cTn: XmlObject): PptxTextAnimationTarget | undefined {
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

	/**
	 * Collect every interactive `p:seq` reachable from `node`.
	 *
	 * Interactive sequences are normally siblings of the main sequence under the
	 * root `p:par`, but a deck may nest one deeper. The generic walk skips every
	 * sequence {@link isInteractiveSequence} matches, so this collector has to
	 * reach exactly the same set or those effects would be dropped entirely.
	 * Collection stops at an interactive sequence: its own subtree is walked by
	 * {@link parseInteractiveSequences} under that sequence's trigger shape.
	 */
	private collectInteractiveSequences(node: XmlObject, found: XmlObject[]): void {
		const containers: XmlObject[] = [];
		const cTn = node['p:cTn'] as XmlObject | undefined;
		const childTnList = cTn?.['p:childTnLst'] as XmlObject | undefined;
		if (childTnList) {
			containers.push(
				...ensureArray(childTnList['p:par']),
				...ensureArray(childTnList['p:seq']),
				...ensureArray(childTnList['p:excl']),
			);
		}
		containers.push(...ensureArray(node['p:par']), ...ensureArray(node['p:seq']));

		for (const container of containers) {
			if (isInteractiveSequence(container)) {
				found.push(container);
				continue;
			}
			this.collectInteractiveSequences(container, found);
		}
	}

	/**
	 * Parse interactive sequences from the root `p:par` node.
	 *
	 * In OOXML, interactive sequences are sibling `p:seq` nodes alongside the
	 * main sequence. They have a `p:stCondLst` condition with `evt="onClick"`
	 * targeting a specific shape via `p:tgtEl/p:spTgt/@spid`.
	 *
	 * See ISO/IEC 29500-1 S19.5.60 (CT_TLTimeNodeSequence).
	 */
	private parseInteractiveSequences(rootPar: XmlObject, animations: PptxNativeAnimation[]): void {
		const sequences: XmlObject[] = [];
		this.collectInteractiveSequences(rootPar, sequences);

		for (const seq of sequences) {
			const seqCTn = seq['p:cTn'] as XmlObject | undefined;
			const triggerShapeId = seqCTn ? extractTriggerShapeId(seqCTn) : undefined;
			if (!triggerShapeId) {
				continue;
			}
			const endSync = seqCTn?.['p:endSync'] as XmlObject | undefined;
			const runtimeTrigger = endSync?.['p:rtn'] as XmlObject | undefined;
			const restartable = String(runtimeTrigger?.['@_val'] ?? '') === 'all';

			// Walk this interactive sequence children and tag them.
			// `@concurrent`/`@nextAc`/`@prevAc` are attributes of `<p:seq>` itself
			// (ECMA-376 S19.5.60), not of its nested `<p:cTn>` (`seqCTn`).
			const interactiveAnims: PptxNativeAnimation[] = [];
			const seqAttrs = extractSeqAttrs(seq);
			this.walkTimingTree(seq, interactiveAnims, 'onShapeClick', {
				...createGroupContext(),
				...seqAttrs,
			});

			for (const anim of interactiveAnims) {
				anim.triggerShapeId = triggerShapeId;
				anim.interactiveSequence = true;
				anim.interactiveRestart = restartable;
				// Preserve within-sequence with/after timing. Keep the historical
				// public `onShapeClick` token for click effects themselves.
				if (anim.trigger === 'onClick') {
					anim.trigger = 'onShapeClick';
				}
				animations.push(anim);
			}
		}
	}
}
