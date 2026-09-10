/**
 * Real-world PowerPoint decks (COM-authored, see the `media-trigger-tgtel.pptx`
 * fixture in `fixture-corpus-manifest.ts`) do NOT usually chain a follow-on
 * effect to an audio/video clip via an explicit `onStopAudio` condition at
 * all: `Slide.TimeLine.MainSequence.AddEffect(msoAnimTriggerAfterPrevious)`
 * writes a plain `<p:cond delay="N"/>` on the FOLLOWING click-group, with NO
 * `@evt`, `@tn`, or `p:tgtEl` - just a numeric delay PowerPoint copies
 * verbatim from the "play the media" effect's OWN `p:cTn/@dur` (a SEPARATE
 * timing node, `presetClass="mediacall"`, that also targets the media shape,
 * distinct from the actual `p:audio`/`p:video` declaration `kind: 'media'`
 * animations track).
 *
 * `native-animation-media-duration.ts`'s `onStopAudio`-condition patch (a
 * structural id/shape reference) cannot see this form at all: nothing in the
 * XML names WHICH media node a bare delay is "about". This module closes
 * that gap with a narrow, value-matched heuristic instead:
 *
 *  1. {@link patchMediaCallDuration} finds every OTHER animation entry that
 *     targets the SAME raw shape id as a media node whose real duration was
 *     just decoded (the "mediacall" play effect) and corrects its own
 *     `durationMs` too, recording `oldAuthoredMs -> realMs` in `remap`.
 *  2. {@link applyPlainDelayRemap}, called once after every media node has
 *     been processed, rewrites any PLAIN condition (no event, no `@tn`, no
 *     `p:tgtEl`) whose delay exactly equals a recorded `oldAuthoredMs` to the
 *     real value.
 *
 * The exact-value match is deliberately conservative: a plain delay is an
 * extremely common, otherwise-unlinked shape (used for ordinary
 * afterPrevious/afterDelay chaining throughout a timing tree), so this only
 * ever touches one whose value is a suspiciously specific number that came
 * from an authored media duration estimate, and only for the mapping this
 * pass itself just discovered was wrong. An ambiguous old value (two
 * different clips PowerPoint happened to estimate identically) is dropped
 * from the remap rather than guessed at.
 *
 * @module services/native-animation-media-duration-plain-delay
 */
import type { PptxNativeAnimation } from '../types';

/**
 * Find every animation entry (excluding `kind: 'media'` itself, handled by
 * the caller) that targets `rawShapeId` and carries its own authored
 * `durationMs` (the "mediacall"/play-effect node's `p:cTn/@dur`), correct it
 * to `realMs`, and record the old -> new mapping in `remap` for
 * {@link applyPlainDelayRemap} to use afterwards.
 */
export function patchMediaCallDuration(
	animations: readonly PptxNativeAnimation[],
	rawShapeId: string,
	realMs: number,
	remap: Map<number, number>,
): void {
	const roundedReal = Math.round(realMs);
	for (const anim of animations) {
		if (anim.kind === 'media' || anim.targetId !== rawShapeId) {
			continue;
		}
		const oldMs = anim.durationMs;
		if (oldMs === undefined || oldMs <= 0 || oldMs === roundedReal) {
			continue;
		}
		anim.durationMs = roundedReal;
		const existing = remap.get(oldMs);
		if (existing === undefined) {
			remap.set(oldMs, roundedReal);
		} else if (existing !== roundedReal) {
			// Two different clips shared the same PowerPoint-estimated duration:
			// a bare delay copied from one could easily belong to the other, so
			// stop claiming this old value means anything specific.
			remap.delete(oldMs);
		}
	}
}

/**
 * Rewrite every PLAIN (no `@evt`, no `@tn`, no `p:tgtEl`) start/end
 * condition delay found in `remap`'s keys to its mapped real value, PLUS
 * `parGroupDelayMs` (the wrapping `p:par`'s own start delay, kept on the
 * CHILD entry rather than as a `startConditions` entry - see
 * {@link PptxNativeAnimation.parGroupDelayMs}'s doc comment - which is where
 * the `media-trigger-tgtel.pptx` ground-truth deck's copied `2000` value
 * actually lands, not in `startConditions` at all). Call once, after every
 * media node in the slide has run through {@link patchMediaCallDuration}.
 */
export function applyPlainDelayRemap(
	animations: readonly PptxNativeAnimation[],
	remap: ReadonlyMap<number, number>,
): void {
	if (remap.size === 0) {
		return;
	}
	for (const anim of animations) {
		if (anim.parGroupDelayMs !== undefined) {
			const real = remap.get(anim.parGroupDelayMs);
			if (real !== undefined) {
				anim.parGroupDelayMs = real;
			}
		}
		for (const conditions of [anim.startConditions, anim.endConditions]) {
			if (!conditions) {
				continue;
			}
			for (const cond of conditions) {
				if (
					cond.event !== undefined ||
					cond.targetTimeNodeId !== undefined ||
					cond.targetShapeId !== undefined ||
					typeof cond.delay !== 'number' ||
					cond.delay <= 0
				) {
					continue;
				}
				const real = remap.get(cond.delay);
				if (real !== undefined) {
					cond.delay = real;
				}
			}
		}
	}
}
