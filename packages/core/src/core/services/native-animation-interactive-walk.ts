import type {
	PptxAnimationTrigger,
	PptxMediaBookmarkTarget,
	PptxNativeAnimation,
	XmlObject,
} from '../types';
/**
 * Interactive-sequence (`p:seq` triggered by clicking a specific shape)
 * discovery for the native OOXML animation timing-tree walk. Extracted from
 * `PptxNativeAnimationService` to keep file sizes manageable.
 */
import type { AnimationGroupContext } from './animation-group-context';
import { createGroupContext } from './animation-group-context';
import { extractSeqAttrs } from './animation-timing-attrs';
import {
	extractBookmarkTrigger,
	extractTriggerShapeId,
	ensureArray,
} from './native-animation-helpers';
import { isInteractiveSequence } from './native-animation-interactive-predicate';

/**
 * Signature of the generic timing-tree walker, injected so this module does
 * not need to depend on (or duplicate) `PptxNativeAnimationService`'s own
 * `walkTimingTree`, which shares mutable per-parse state (the exclusive
 * group id counter) with the caller.
 */
export type WalkTimingTreeFn = (
	node: XmlObject,
	animations: PptxNativeAnimation[],
	currentTrigger: PptxAnimationTrigger,
	group: AnimationGroupContext,
) => void;

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
function collectInteractiveSequences(node: XmlObject, found: XmlObject[]): void {
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
		collectInteractiveSequences(container, found);
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
export function parseInteractiveSequences(
	rootPar: XmlObject,
	animations: PptxNativeAnimation[],
	walk: WalkTimingTreeFn,
): void {
	const sequences: XmlObject[] = [];
	collectInteractiveSequences(rootPar, sequences);

	const bookmarkAnims: PptxNativeAnimation[] = [];
	for (const seq of sequences) {
		const seqCTn = seq['p:cTn'] as XmlObject | undefined;
		const bookmark = seqCTn ? extractBookmarkTrigger(seqCTn) : undefined;
		if (bookmark) {
			const seqAnims: PptxNativeAnimation[] = [];
			walk(seq, seqAnims, 'withPrevious', { ...createGroupContext(), ...extractSeqAttrs(seq) });
			for (const anim of seqAnims) {
				gateOnBookmark(anim, bookmark);
				bookmarkAnims.push(anim);
			}
			continue;
		}
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
		walk(seq, interactiveAnims, 'onShapeClick', {
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
	// A bookmark sequence runs independently of the click sequence: it is armed
	// as the slide starts and fires when the media reaches the bookmark, so its
	// effects lead the list (the timeline turns a leading non-click run into
	// the slide-entry group, which is what wires the media listener).
	animations.unshift(...bookmarkAnims);
}

/**
 * Re-gate an effect from a bookmark-triggered interactive sequence on the
 * bookmark itself. PowerPoint puts the `onMediaBookmark` condition on the
 * SEQUENCE and a plain `delay="0"` on each effect; the playback side reads
 * the effect's own start conditions, so the bookmark is copied down.
 */
function gateOnBookmark(anim: PptxNativeAnimation, bookmark: PptxMediaBookmarkTarget): void {
	anim.trigger = 'onMediaBookmark';
	anim.triggerShapeId = bookmark.shapeId;
	anim.triggerBookmark = bookmark.bookmarkName;
	// Armed on slide entry rather than on a click (see the unshift above).
	anim.groupAutoStart = true;
	anim.startConditions = [{ event: 'onMediaBookmark', delay: 0, bookmarkTarget: { ...bookmark } }];
}
