/**
 * Generic recursive OOXML timing-tree (`p:par`/`p:seq`/`p:excl`) walk for
 * native animation parsing. Extracted from `PptxNativeAnimationService` to
 * keep file sizes manageable. The per-node trigger resolution and the
 * (large) animation-entry field mapping live in
 * `native-animation-timing-node-extract`.
 */
import type { PptxAnimationTrigger, PptxNativeAnimation, XmlObject } from '../types';
import { childGroupContext, isMainSequence } from './animation-group-context';
import type { AnimationGroupContext } from './animation-group-context';
import { extractSeqAttrs } from './animation-timing-attrs';
import { ensureArray } from './native-animation-helpers';
import { isInteractiveSequence } from './native-animation-interactive-predicate';
import {
	buildTimingNodeAnimation,
	resolveNodeTrigger,
} from './native-animation-timing-node-extract';

/**
 * Mutable per-parse state the walk needs but does not own: assigning each
 * `p:excl` container its own id so playback can tell two independent
 * exclusive groups apart (see {@link PptxNativeAnimation.exclGroupId}).
 * `PptxNativeAnimationService` owns the counter (reset once per
 * `parseNativeAnimations` call) and shares it across both the main walk and
 * the interactive-sequence walk via this context.
 */
export interface TimingWalkContext {
	allocateExclGroupId: () => number;
}

/**
 * Recursively walk a timing tree node, extracting animation effects.
 *
 * At each `p:cTn` node, resolves the trigger and (via
 * `native-animation-timing-node-extract`) the effect's full field set, then
 * recurses into `p:childTnLst` and direct child containers.
 *
 * @param node - Current XML node in the timing tree.
 * @param animations - Mutable array to collect discovered animations.
 * @param currentTrigger - Inherited trigger type from parent context.
 * @param group - Click-group / effect-wrapper context inherited from the
 *        parent node. See `animation-group-context` for why the flat list
 *        needs it.
 * @param ctx - Shared per-parse state (see {@link TimingWalkContext}).
 */
export function walkTimingTree(
	node: XmlObject,
	animations: PptxNativeAnimation[],
	currentTrigger: PptxAnimationTrigger,
	group: AnimationGroupContext,
	ctx: TimingWalkContext,
): void {
	if (!node) {
		return;
	}

	const cTn = node['p:cTn'] as XmlObject | undefined;
	if (cTn) {
		const trigger = resolveNodeTrigger(cTn, currentTrigger);
		const animation = buildTimingNodeAnimation(cTn, trigger, group);
		if (animation) {
			animations.push(animation);
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
				walkTimingTree(
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
					ctx,
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
				walkTimingTree(sequence, animations, trigger, { ...group, ...seqAttrs }, ctx);
			}
			// Exclusive containers: animations are mutually exclusive at runtime
			for (const excl of exclusives) {
				const exclAnims: PptxNativeAnimation[] = [];
				walkTimingTree(excl, exclAnims, trigger, group, ctx);
				const exclGroupId = ctx.allocateExclGroupId();
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
		walkTimingTree(
			parallel,
			animations,
			currentTrigger,
			childGroupContext(group, parallel['p:cTn'] as XmlObject | undefined, {
				isClickLevelGroup: false,
			}),
			ctx,
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
		walkTimingTree(sequence, animations, currentTrigger, { ...group, ...seqAttrs }, ctx);
	}
}
