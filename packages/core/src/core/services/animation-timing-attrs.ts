/**
 * Parsers for `p:cTn` / `p:bldP` / `p:seq` timing attributes that previously
 * had no typed home: `@fill`, `@restart`, `@repeatDur`, `@spd` on an effect's
 * own `p:cTn`; `@rev` / `@advAuto` on a TEXT `p:bldP`; and `@concurrent` /
 * `@nextAc` / `@prevAc` on a `p:seq` container.
 *
 * @module services/animation-timing-attrs
 */
import type { PptxNativeAnimation, XmlObject } from '../types';
import { readTimingAttr } from './native-animation-extended-helpers';

const FILL_VALUES: ReadonlySet<string> = new Set(['remove', 'freeze', 'hold', 'transition']);
const RESTART_VALUES: ReadonlySet<string> = new Set(['always', 'whenNotActive', 'never']);

/** Timing attributes read from an effect's own `p:cTn` (ECMA-376 §19.5.27). */
export interface CTnTimingAttrs {
	fill?: PptxNativeAnimation['fill'];
	restart?: PptxNativeAnimation['restart'];
	repeatDurMs?: number;
	speedPct?: number;
}

/**
 * Extract `@fill`, `@restart`, `@repeatDur` and `@spd` from a `p:cTn`.
 *
 * `@repeatDur="indefinite"` is preserved as `Infinity` (same convention as
 * {@link extractRepeatInfo}'s `repeatCount`). `@spd` is stored in OOXML as
 * 1000ths of a percent (`150000` = 150%); this normalizes it to a plain
 * percentage so a consumer can divide a duration by `speedPct / 100`.
 */
export function extractCTnTimingAttrs(cTn: XmlObject): CTnTimingAttrs {
	const result: CTnTimingAttrs = {};

	const fillRaw = cTn['@_fill'];
	if (fillRaw !== undefined && FILL_VALUES.has(String(fillRaw))) {
		result.fill = String(fillRaw) as CTnTimingAttrs['fill'];
	}

	const restartRaw = cTn['@_restart'];
	if (restartRaw !== undefined && RESTART_VALUES.has(String(restartRaw))) {
		result.restart = String(restartRaw) as CTnTimingAttrs['restart'];
	}

	const repeatDurRaw = cTn['@_repeatDur'];
	if (repeatDurRaw !== undefined) {
		const token = String(repeatDurRaw).trim();
		result.repeatDurMs = token === 'indefinite' ? Infinity : readTimingAttr(repeatDurRaw);
	}

	const spdRaw = cTn['@_spd'];
	if (spdRaw !== undefined) {
		const parsed = Number.parseInt(String(spdRaw), 10);
		if (Number.isFinite(parsed) && parsed > 0) {
			result.speedPct = parsed / 1000;
		}
	}

	return result;
}

/** `@rev` / `@advAuto` from a TEXT `p:bldP` (distinct from `p:bldDgm/@rev`). */
export interface BldPResumeAttrs {
	buildReverse?: boolean;
	buildAdvAutoMs?: number;
}

export function extractBldPResumeAttrs(bldP: XmlObject): BldPResumeAttrs {
	const result: BldPResumeAttrs = {};
	if (bldP['@_rev'] === '1' || bldP['@_rev'] === 'true') {
		result.buildReverse = true;
	}
	const advAutoRaw = bldP['@_advAuto'];
	if (advAutoRaw !== undefined) {
		const token = String(advAutoRaw).trim();
		result.buildAdvAutoMs = token === 'indefinite' ? Infinity : readTimingAttr(advAutoRaw);
	}
	return result;
}

/**
 * `@concurrent` / `@nextAc` / `@prevAc` from a `p:seq` element. Per
 * ECMA-376 S19.5.60 (CT_TLTimeNodeSequence), these three are attributes of
 * `<p:seq>` ITSELF, not of its nested `<p:cTn>` child (which only carries the
 * common timing data every time-node type shares) - pass the `p:seq` object,
 * not `p:seq['p:cTn']`.
 */
export interface SeqTimingAttrs {
	seqConcurrent?: boolean;
	seqNextAction?: PptxNativeAnimation['seqNextAction'];
	seqPrevAction?: PptxNativeAnimation['seqPrevAction'];
}

export function extractSeqAttrs(seq: XmlObject | undefined): SeqTimingAttrs {
	if (!seq) {
		return {};
	}
	const result: SeqTimingAttrs = {};
	if (seq['@_concurrent'] === '1' || seq['@_concurrent'] === 'true') {
		result.seqConcurrent = true;
	}
	const nextAc = seq['@_nextAc'];
	if (nextAc === 'seek' || nextAc === 'none') {
		result.seqNextAction = nextAc;
	}
	const prevAc = seq['@_prevAc'];
	if (prevAc === 'skipTimeNode' || prevAc === 'none') {
		result.seqPrevAction = prevAc;
	}
	return result;
}
