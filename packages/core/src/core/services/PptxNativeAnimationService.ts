/**
 * Service for parsing native OOXML animation timing trees from slide XML.
 *
 * Native animations follow the full OOXML timing model (ISO/IEC 29500-1 S19.5),
 * with nested `p:par`, `p:seq`, and `p:excl` containers forming a tree of
 * timed animation effects. This service walks that tree and extracts a flat
 * list of {@link PptxNativeAnimation} objects suitable for playback.
 *
 * The recursive tree walk, the interactive-sequence pass, and the media
 * (`p:audio`/`p:video`) pass live in sibling `native-animation-*-walk`
 * modules (extracted to keep file sizes manageable); this service owns the
 * per-parse state (the exclusive-group id counter) and orchestrates them.
 *
 * @module PptxNativeAnimationService
 */
import type { PptxNativeAnimation, XmlObject } from '../types';
import { createGroupContext } from './animation-group-context';
import {
	extractOleChartBuilds,
	extractSmartArtBuilds,
	extractGraphicBuilds,
} from './native-animation-extended-helpers';
import { applyBuildList } from './native-animation-helpers';
import { parseInteractiveSequences } from './native-animation-interactive-walk';
import { parseMediaAnimations } from './native-animation-media-walk';
import type { TimingWalkContext } from './native-animation-timing-walk';
import { walkTimingTree } from './native-animation-timing-walk';
import { resolveSlideTimingNode } from './slide-transition-envelope';

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

			const walkCtx: TimingWalkContext = { allocateExclGroupId: () => this.exclGroupSeq++ };
			walkTimingTree(rootPar as XmlObject, animations, 'onClick', createGroupContext(), walkCtx);

			// Parse interactive sequences (sibling p:seq nodes with trigger shape).
			// Shares `walkCtx` with the main walk above so the exclusive-group id
			// counter stays continuous across both passes, exactly as it did when
			// both walks were the same recursive method on this instance.
			parseInteractiveSequences(rootPar as XmlObject, animations, (node, anims, trigger, group) =>
				walkTimingTree(node, anims, trigger, group, walkCtx),
			);

			// Walk for media (p:audio / p:video) entries and emit a
			// PptxNativeAnimation per node so the timeline order is preserved
			// alongside other animations. Media-trim metadata remains the
			// responsibility of PptxHandlerRuntimeMediaTimingParsing -- this
			// pass only mints the typed entries.
			parseMediaAnimations(timing as XmlObject, animations);

			// Parse p:bldOleChart entries and attach OLE chart build info
			// before running the bldP pass -- applyBuildList relies on the
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

			// SmartArt diagram builds (p:bldDgm) -- attach the build mode so
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

			// Generic graphic-frame builds (p:bldGraphic) -- attach the build
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
}
