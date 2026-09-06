/**
 * Media (`p:audio` / `p:video`) node collection for the native OOXML
 * animation timing-tree walk. Extracted from `PptxNativeAnimationService`
 * to keep file sizes manageable.
 */
import type { PptxNativeAnimation, XmlObject } from '../types';
import {
	captureRoundTripCTnAttrs,
	ensureArray,
	extractAfterEffect,
} from './native-animation-helpers';

/**
 * Walk the timing tree for `p:audio` / `p:video` nodes and emit a
 * `kind: 'media'` PptxNativeAnimation entry per media node, capturing the
 * target shape id, optional `afterEffect` flag, and opaque round-trip
 * cTn attributes. This puts media playback nodes in the same typed list
 * as preset-driven animations so callers can reason about timeline order.
 *
 * Trim values, fade durations, bookmarks etc. are intentionally NOT
 * captured here -- they remain owned by
 * `PptxHandlerRuntimeMediaTimingParsing`'s media-timing map.
 */
export function parseMediaAnimations(timing: XmlObject, animations: PptxNativeAnimation[]): void {
	collectMediaNodes(timing, animations);
}

/**
 * Recursively descend into the timing tree and push a media-kind entry
 * for each `p:audio` / `p:video` node found.
 */
function collectMediaNodes(node: XmlObject | undefined, animations: PptxNativeAnimation[]): void {
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
				durationMs: durationMs !== undefined && !Number.isNaN(durationMs) ? durationMs : undefined,
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
				collectMediaNodes(child, animations);
			}
		}
		// Also inspect direct media children inside childTnLst.
		collectMediaNodes(childTnList, animations);
	}

	for (const container of ['p:par', 'p:seq', 'p:excl', 'p:tnLst'] as const) {
		const children = ensureArray(node[container]);
		for (const child of children) {
			collectMediaNodes(child, animations);
		}
	}
}
