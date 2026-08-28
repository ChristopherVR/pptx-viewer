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
