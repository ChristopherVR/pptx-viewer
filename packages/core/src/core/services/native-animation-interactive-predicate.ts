/**
 * Predicate for recognising an INTERACTIVE `p:seq` in an OOXML timing tree.
 * Extracted from `PptxNativeAnimationService` to keep file sizes manageable.
 */
import type { XmlObject } from '../types';
import { extractTriggerShapeId } from './native-animation-helpers';

/**
 * True when a `p:seq` is an INTERACTIVE sequence: one that only runs when the
 * viewer clicks a specific shape (`p:cTn/p:stCondLst/p:cond[@evt="onClick"]`
 * with a `p:spTgt/@spid`), rather than a step of the slide's main sequence.
 *
 * Such a sequence is owned exclusively by
 * {@link parseInteractiveSequences}, which re-walks it and tags every effect
 * `onShapeClick`. The generic timing-tree walk must therefore SKIP it:
 * walking it under the inherited `onClick` trigger emitted a duplicate of
 * every interactive effect as a phantom MAIN-sequence click step, so
 * pressing Next in a slide show silently burned a click doing nothing
 * instead of advancing the slide (any deck with a click-to-pause video, e.g.
 * `e2e/fixtures/solution-explorer.pptx` slide 2, froze on that slide for two
 * presses and looked like "the slide show does not animate").
 */
export function isInteractiveSequence(seq: XmlObject): boolean {
	const cTn = seq['p:cTn'] as XmlObject | undefined;
	if (!cTn || String(cTn['@_nodeType'] || '') === 'mainSeq') {
		return false;
	}
	return extractTriggerShapeId(cTn) !== undefined;
}
