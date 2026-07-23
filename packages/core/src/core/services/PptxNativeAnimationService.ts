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
import { extractAnimationTarget } from './animation-target-build-helpers';
import {
	extractColorAnimation,
	extractTextTarget,
	extractIterate,
	extractCommand,
	extractOleChartBuilds,
	extractSmartArtBuilds,
	extractGraphicBuilds,
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
		try {
			const timing = (slideXml?.['p:sld'] as XmlObject | undefined)?.['p:timing'];
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

			this.walkTimingTree(rootPar as XmlObject, animations, 'onClick');

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
	 */
	private walkTimingTree(
		node: XmlObject,
		animations: PptxNativeAnimation[],
		currentTrigger: PptxAnimationTrigger,
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
			const durationMs = cTn['@_dur'] ? Number.parseInt(String(cTn['@_dur']), 10) : undefined;
			const delayMs = cTn['@_delay'] ? Number.parseInt(String(cTn['@_delay']), 10) : undefined;
			const accel = parseTimingPercentFraction(cTn['@_accel']);
			const decel = parseTimingPercentFraction(cTn['@_decel']);

			// Determine trigger from nodeType attribute, falling back to inherited trigger
			let trigger = currentTrigger;
			if (nodeType === 'afterPrevious' || nodeType === 'afterPrev') {
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

			// Extract the target shape ID from child behavior nodes
			const target = extractAnimationTarget(cTn);
			const targetId =
				target?.type === 'shape' || target?.type === 'ink' ? target.shapeId : undefined;
			if (presetClass && target) {
				// Validate preset class against known OOXML preset classes
				const validPresetClass = (
					['entr', 'exit', 'emph', 'path'].includes(presetClass) ? presetClass : undefined
				) as PptxNativeAnimation['presetClass'];

				const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
				const childMotion = extractChildMotionValues(childTnList);
				const repeatInfo = extractRepeatInfo(cTn);
				const colorAnimation = extractColorAnimation(childTnList);
				const iterateInfo = extractIterate(cTn);
				const cmdInfo = extractCommand(childTnList);
				const textTarget = this.extractTextTargetFromCTn(cTn);
				const keyframes = extractChildKeyframes(childTnList);
				// Round-trip surface for cTn attrs that don't have a typed home.
				const roundTripAttrs = captureRoundTripCTnAttrs(cTn);
				const afterEffectFlag = extractAfterEffect(cTn);

				animations.push({
					targetId,
					target,
					trigger,
					presetClass: validPresetClass,
					presetId,
					presetSubtype,
					durationMs,
					delayMs,
					accel,
					decel,
					triggerDelayMs: trigger === 'afterDelay' ? delayMs : undefined,
					motionPath: childMotion.motionPath,
					motionOrigin: childMotion.motionOrigin,
					motionPathRotateAuto: childMotion.motionPathRotateAuto,
					motionPathEditMode: childMotion.motionPathEditMode,
					motionPtsTypes: childMotion.motionPtsTypes,
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
					repeatCount: repeatInfo.repeatCount,
					autoReverse: repeatInfo.autoReverse,
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
				});
			}

			// Recurse into child containers (parallel, sequence, exclusive)
			const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
			if (childTnList) {
				const parallels = ensureArray(childTnList['p:par']);
				const sequences = ensureArray(childTnList['p:seq']);
				const exclusives = ensureArray(childTnList['p:excl']);
				for (const parallel of parallels) {
					this.walkTimingTree(parallel, animations, trigger);
				}
				for (const sequence of sequences) {
					this.walkTimingTree(sequence, animations, trigger);
				}
				// Exclusive containers: animations are mutually exclusive at runtime
				for (const excl of exclusives) {
					const exclAnims: PptxNativeAnimation[] = [];
					this.walkTimingTree(excl, exclAnims, trigger);
					for (const a of exclAnims) {
						a.exclusive = true;
						animations.push(a);
					}
				}
			}
		}

		// Also walk direct child p:par/p:seq nodes (not wrapped in p:cTn)
		const directParallels = ensureArray(node['p:par']);
		const directSequences = ensureArray(node['p:seq']);
		for (const parallel of directParallels) {
			this.walkTimingTree(parallel, animations, currentTrigger);
		}
		for (const sequence of directSequences) {
			this.walkTimingTree(sequence, animations, currentTrigger);
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
	 * Parse interactive sequences from the root `p:par` node.
	 *
	 * In OOXML, interactive sequences are sibling `p:seq` nodes alongside the
	 * main sequence. They have a `p:stCondLst` condition with `evt="onClick"`
	 * targeting a specific shape via `p:tgtEl/p:spTgt/@spid`.
	 *
	 * See ISO/IEC 29500-1 S19.5.60 (CT_TLTimeNodeSequence).
	 */
	private parseInteractiveSequences(rootPar: XmlObject, animations: PptxNativeAnimation[]): void {
		const rootCTn = rootPar['p:cTn'] as XmlObject | undefined;
		if (!rootCTn) {
			return;
		}

		const childTnList = rootCTn['p:childTnLst'] as XmlObject | undefined;
		if (!childTnList) {
			return;
		}

		const sequences = ensureArray(childTnList['p:seq']);
		for (const seq of sequences) {
			const seqCTn = seq['p:cTn'] as XmlObject | undefined;
			if (!seqCTn) {
				continue;
			}

			// Skip the main sequence -- it has nodeType="mainSeq"
			const nodeType = String(seqCTn['@_nodeType'] || '');
			if (nodeType === 'mainSeq') {
				continue;
			}

			// Extract the trigger shape ID from the sequence conditions
			const triggerShapeId = extractTriggerShapeId(seqCTn);
			if (!triggerShapeId) {
				continue;
			}

			// Walk this interactive sequence children and tag them
			const interactiveAnims: PptxNativeAnimation[] = [];
			this.walkTimingTree(seq, interactiveAnims, 'onShapeClick');

			for (const anim of interactiveAnims) {
				anim.triggerShapeId = triggerShapeId;
				anim.trigger = 'onShapeClick';
				animations.push(anim);
			}
		}
	}
}
