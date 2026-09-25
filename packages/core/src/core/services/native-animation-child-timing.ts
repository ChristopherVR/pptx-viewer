import type { XmlObject } from '../types';
import { readTimingAttr } from './native-animation-extended-helpers';

const PRIMARY_BEHAVIOUR_FAMILIES = [
	['p:animMotion', 'p:animRot', 'p:animScale'],
	['p:animClr'],
	['p:animEffect'],
	['p:anim'],
] as const;

export interface ChildAutoReverseTiming {
	autoReverse: true;
	durationMs: number;
}

function isEnabled(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

const TIMED_BEHAVIOUR_TAGS = PRIMARY_BEHAVIOUR_FAMILIES.flat();

function allTimedBehavioursReverseTogether(
	childTnLst: XmlObject,
	toArray: (value: unknown) => XmlObject[],
): boolean {
	let shared: number | undefined;
	for (const tag of TIMED_BEHAVIOUR_TAGS) {
		for (const behaviour of toArray(childTnLst[tag])) {
			const inner = (behaviour['p:cBhvr'] as XmlObject | undefined)?.['p:cTn'] as
				| XmlObject
				| undefined;
			const durationMs = readTimingAttr(inner?.['@_dur']);
			if (durationMs === undefined || durationMs <= 1) {
				continue;
			}
			if (!isEnabled(inner?.['@_autoRev']) || (shared !== undefined && durationMs !== shared)) {
				return false;
			}
			shared = durationMs;
		}
	}
	return true;
}

/**
 * Read an auto-reverse timing authored on the behaviour `p:cTn`, rather than
 * on the enclosing effect `p:cTn`.
 *
 * PowerPoint commonly writes Flash Bulb and complementary-colour effects this
 * way. The priority mirrors shared playback: authored transforms win first,
 * then colour, filter effects, and generic attribute animation. A family is
 * surfaced only when all of its sibling behaviours agree on duration and
 * auto-reverse, avoiding a lossy collapse of independently timed children.
 */
export function extractChildAutoReverseTiming(
	cTn: XmlObject,
	toArray: (value: unknown) => XmlObject[],
): ChildAutoReverseTiming | undefined {
	const childTnLst = cTn['p:childTnLst'] as XmlObject | undefined;
	if (!childTnLst) {
		return undefined;
	}

	// A reversing child only speaks for the whole effect when EVERY timed
	// behaviour reverses on the same clock. Light Speed's 400 ms wobble
	// reverses while its 600 ms fly-in does not; treating the wobble as the
	// effect's timing played the entire entrance as a 400 ms back-and-forth.
	if (!allTimedBehavioursReverseTogether(childTnLst, toArray)) {
		return undefined;
	}
	for (const family of PRIMARY_BEHAVIOUR_FAMILIES) {
		const behaviours = family.flatMap((tag) => toArray(childTnLst[tag]));
		if (behaviours.length === 0) {
			continue;
		}
		const timings = behaviours.map((behaviour) => {
			const common = behaviour['p:cBhvr'] as XmlObject | undefined;
			const inner = common?.['p:cTn'] as XmlObject | undefined;
			return {
				autoReverse: isEnabled(inner?.['@_autoRev']),
				durationMs: readTimingAttr(inner?.['@_dur']),
			};
		});
		const durationMs = timings[0]?.durationMs;
		if (
			durationMs !== undefined &&
			timings.every((timing) => timing.autoReverse && timing.durationMs === durationMs)
		) {
			return { autoReverse: true, durationMs };
		}
		return undefined;
	}
	return undefined;
}
