/**
 * Real (byte-derived) media duration attachment for native animations.
 *
 * PowerPoint writes `onStopAudio` "After Previous" chaining as a plain
 * `p:cond/@delay` on the DEPENDENT effect (COM-verified, see
 * `docs/guide/limitations.md`, "`onStopAudio` in headless export"): the
 * delay value is PowerPoint's OWN estimate of the referenced clip's
 * duration at export time, which desyncs from real playback once the
 * embedded file is trimmed differently or swapped. A real `<audio>`/
 * `<video>` element corrects this live, by firing the DOM `ended` event
 * (`render/animation-media-end-gating.ts`); a context with no mounted media
 * element (headless export, SSR, an unmounted slide) has nothing to listen
 * to and just plays out that authored estimate.
 *
 * This module closes that gap at PARSE time instead: it decodes each
 * embedded audio/video part's REAL duration from its bytes
 * ({@link estimateMediaDurationMs}, a pure decoder covering
 * WAV/MP3/MP4/M4A/MOV/OGG/Opus/WebM/MKV/AAC-ADTS) and, wherever that
 * duration is real, overwrites:
 *
 *  1. the media animation's own `durationMs` (round-trip metadata),
 *  2. every OTHER animation's `onStopAudio` start/end condition that names
 *     THIS media node (`p:cond/@_tn` or `p:tgtEl/p:spTgt`), and
 *  3. (see `native-animation-media-duration-plain-delay.ts`) any "play the
 *     media" effect node's own duration estimate, plus any bare
 *     `p:cond/@delay` elsewhere copied verbatim from it - the form real
 *     PowerPoint COM authoring actually uses for "After Previous" audio
 *     chaining, per the `media-trigger-tgtel.pptx` ground-truth fixture,
 *
 * so the estimate baked into `TimelineStep.delayMs` at `pptx-viewer-shared`'s
 * timeline-build time is the real duration from the very first (or a wholly
 * headless) render, in every binding - this module is the ONLY place that
 * value is computed, and every binding already consumes it through the same
 * shared timeline builder.
 *
 * Runs BEFORE `reconcileAnimationTargets`, deliberately: `targetShapeId` on
 * an `onStopAudio` condition is never touched by that pass (only
 * `PptxNativeAnimation.targetId`/`triggerShapeId` are), so matching it
 * against a media node's element must happen in the same RAW `p:cNvPr` id
 * space {@link readCnvPrId} reads, before anything gets rewritten to a
 * positional `element.id`.
 *
 * A THIRD, more common real-world form - a follow-on effect chained via a
 * bare `<p:cond delay="N"/>` with no `onStopAudio` event at all, `N` copied
 * verbatim by PowerPoint from a separate "play the media" effect node's own
 * duration estimate - carries no structural link to the media node either,
 * so it cannot be patched here; see
 * `native-animation-media-duration-plain-delay.ts` for that value-matched
 * heuristic, applied by this module as its third and final pass.
 *
 * @module services/native-animation-media-duration
 */
import type { MediaPptxElement, PptxElement, PptxNativeAnimation } from '../types';
import { estimateMediaDurationMs } from '../utils/media-duration';
import { readCnvPrId } from './animation-target-reconcile';
import {
	applyPlainDelayRemap,
	patchMediaCallDuration,
} from './native-animation-media-duration-plain-delay';

/** Read a media element's own bytes, given its in-archive path. `undefined` when unreadable. */
export type MediaBytesReader = (mediaPath: string) => Promise<Uint8Array | undefined>;

function isMediaElement(el: PptxElement): el is MediaPptxElement {
	return el.type === 'media';
}

/** Flatten the element tree (including group children) into raw-cNvPr-id -> media element. */
function collectMediaElementsByRawId(
	elements: readonly PptxElement[],
): Map<string, MediaPptxElement> {
	const map = new Map<string, MediaPptxElement>();
	const walk = (els: readonly PptxElement[]): void => {
		for (const el of els) {
			if (isMediaElement(el) && el.mediaPath) {
				const rawId = readCnvPrId(el.rawXml);
				if (rawId) {
					map.set(rawId, el);
				}
			}
			if (el.type === 'group' && Array.isArray(el.children)) {
				walk(el.children);
			}
		}
	};
	walk(elements);
	return map;
}

/** Overwrite every `onStopAudio` condition (in any animation's start/end list) that names `nodeId`/`rawShapeId` with `realMs`. */
function patchOnStopAudioConditions(
	animations: readonly PptxNativeAnimation[],
	nodeId: number | undefined,
	rawShapeId: string,
	realMs: number,
): void {
	for (const anim of animations) {
		for (const conditions of [anim.startConditions, anim.endConditions]) {
			if (!conditions) {
				continue;
			}
			for (const cond of conditions) {
				if (cond.event !== 'onStopAudio') {
					continue;
				}
				const namesThisNode =
					(nodeId !== undefined && cond.targetTimeNodeId === nodeId) ||
					cond.targetShapeId === rawShapeId;
				if (namesThisNode) {
					cond.delay = Math.round(realMs);
				}
			}
		}
	}
}

/**
 * Decode each `kind: 'media'` animation's real duration from its element's
 * embedded bytes (via `readBytes`) and patch it onto that animation entry
 * plus every `onStopAudio` condition elsewhere that depends on it. Mutates
 * `elements` (stamps `metadata.duration`) and `nativeAnimations` in place;
 * a media part that cannot be read or decoded (missing, linked/external,
 * unsupported format) is left exactly as it was, so this is purely additive.
 */
export async function attachRealMediaDurations(
	elements: readonly PptxElement[],
	nativeAnimations: readonly PptxNativeAnimation[] | undefined,
	readBytes: MediaBytesReader,
): Promise<void> {
	if (!nativeAnimations || nativeAnimations.length === 0) {
		return;
	}
	const mediaByRawId = collectMediaElementsByRawId(elements);
	if (mediaByRawId.size === 0) {
		return;
	}

	const plainDelayRemap = new Map<number, number>();
	for (const anim of nativeAnimations) {
		if (anim.kind !== 'media' || anim.targetId === undefined) {
			continue;
		}
		const element = mediaByRawId.get(anim.targetId);
		if (!element?.mediaPath) {
			continue;
		}
		let bytes: Uint8Array | undefined;
		try {
			bytes = await readBytes(element.mediaPath);
		} catch {
			continue;
		}
		if (!bytes) {
			continue;
		}
		const realMs = estimateMediaDurationMs(bytes);
		if (realMs === undefined || !Number.isFinite(realMs) || realMs <= 0) {
			continue;
		}
		anim.durationMs = Math.round(realMs);
		element.metadata = { ...element.metadata, duration: realMs / 1000 };
		patchOnStopAudioConditions(nativeAnimations, anim.nodeId, anim.targetId, realMs);
		patchMediaCallDuration(nativeAnimations, anim.targetId, realMs, plainDelayRemap);
	}
	applyPlainDelayRemap(nativeAnimations, plainDelayRemap);
}
