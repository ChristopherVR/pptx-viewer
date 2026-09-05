/**
 * Diffs `PRESET_ID_TO_EFFECT` against the COM-derived
 * `ANIMATION_PRESET_GROUND_TRUTH` fixture: for every id in the trustworthy
 * 1-26 band whose ground-truth row carries a recognised `p:animEffect/@filter`
 * family, playback must use the SAME family's keyframe (entrance) or its exit
 * counterpart. A future edit that swaps one of these ids onto a different
 * family's keyframe fails here with the exact id, rather than only showing up
 * as a visual regression.
 *
 * @module render/animation-preset-ground-truth
 */
import { describe, expect, it } from 'vitest';

import { ANIMATION_PRESET_GROUND_TRUTH } from './animation-preset-ground-truth';
import { PRESET_ID_TO_EFFECT } from './animation-presets';
import type { EffectName } from './animation-timeline-types';

/**
 * Recognised `p:animEffect/@filter` family tokens (the part before the
 * optional `(...)` direction argument) mapped to the entrance/exit keyframe
 * family `PRESET_ID_TO_EFFECT` must use when a ground-truth row carries them.
 * Mirrors `FILTER_FAMILY_EFFECT` in `animation-filter-effects.ts`.
 */
const FAMILY_TO_EFFECT: Readonly<Record<string, { entr: EffectName; exit: EffectName }>> = {
	blinds: { entr: 'blindsIn', exit: 'blindsOut' },
	box: { entr: 'boxIn', exit: 'boxOut' },
	checkerboard: { entr: 'checkerboardIn', exit: 'checkerboardOut' },
	circle: { entr: 'circleIn', exit: 'shrinkOut' }, // exit.6 keeps its documented shrinkOut approximation
	diamond: { entr: 'diamondIn', exit: 'diamondOut' },
	dissolve: { entr: 'dissolveIn', exit: 'dissolveOut' },
	plus: { entr: 'plusIn', exit: 'plusOut' },
	randombar: { entr: 'randomBarsIn', exit: 'randomBarsOut' },
	wedge: { entr: 'wedgeIn', exit: 'wedgeOut' },
	wheel: { entr: 'wheelIn', exit: 'wheelOut' },
	wipe: { entr: 'wipeIn', exit: 'wipeOut' },
	// `fade` and `barn` are deliberately NOT in this table: `fade` is the
	// generic degeneracy PowerPoint's automation falls back to for effects
	// that carry real additional richness (Bounce/Boomerang; see the SKIP_IDS
	// note below), so matching it strictly would defeat the point of their
	// dedicated keyframes; `barn` (Split) collides with the same numeric ids
	// this pass's automation also produced for Peek (see SKIP_IDS).
};

/**
 * Ids where a strict filter-family match is deliberately NOT enforced:
 *  - entr.12/exit.12/exit.16: this pass's fresh COM data disagrees with the
 *    already-established authoring identity for the Peek/Split cluster
 *    (authoring: peekOut is exit.16, splitOut is exit.17; this pass's data
 *    read exit.16 as Split). `PRESET_ID_TO_EFFECT` trusts the pre-existing,
 *    previously-reviewed authoring identity over this one fresh COM run (see
 *    the "needs:" note on `PRESET_ID_TO_EFFECT.exit`'s leading comment in
 *    `animation-presets.ts`), so it disagrees with this fixture's raw filter
 *    reading for these three ids specifically.
 *  - entr.26/exit.26 (Bounce): carries `filter="wipe(down)"` AND
 *    `p:animScale`, but the authored visual is a scale bounce, not a plain
 *    wipe reveal; `bounceIn`/`bounceOut` are correct here, not `wipeIn`/`wipeOut`.
 *  - entr.25/exit.25 (Boomerang): the ground-truth `filter="fade"` reading is
 *    the automation-degraded reveal only (see the module doc); the dedicated
 *    `boomerangIn`/`boomerangOut` keyframes are the deliberate choice.
 */
const SKIP_IDS: ReadonlySet<string> = new Set([
	'entr.12',
	'exit.12',
	'exit.16',
	'entr.25',
	'exit.25',
	'entr.26',
	'exit.26',
]);

/** Extract the family token from a filter string like `wipe(up)` or `wedge`. */
function filterFamily(filter: string): string {
	const parenIndex = filter.indexOf('(');
	return parenIndex === -1 ? filter : filter.slice(0, parenIndex);
}

describe('animation preset playback matches COM ground truth (ids 1-26)', () => {
	it.each(
		ANIMATION_PRESET_GROUND_TRUTH.filter(
			(row) =>
				row.filter !== undefined &&
				FAMILY_TO_EFFECT[filterFamily(row.filter)] &&
				!SKIP_IDS.has(`${row.presetClass}.${row.presetId}`),
		),
	)('$presetClass.$presetId (filter=$filter) uses the matching keyframe family', (row) => {
		const family = FAMILY_TO_EFFECT[filterFamily(row.filter!)];
		const expected = row.presetClass === 'entr' ? family.entr : family.exit;
		const actual = PRESET_ID_TO_EFFECT[row.presetClass][row.presetId];
		expect(actual, `${row.presetClass}.${row.presetId} playback effect`).toBe(expected);
	});

	it('every ground-truth row resolves to SOME playback effect, except the two documented gaps', () => {
		for (const row of ANIMATION_PRESET_GROUND_TRUTH) {
			const effect = PRESET_ID_TO_EFFECT[row.presetClass][row.presetId];
			// exit.11/exit.12 are the two deliberate, documented omissions in
			// this band (see the note on PRESET_ID_TO_EFFECT.exit's leading
			// comment in animation-presets.ts).
			if (row.presetClass === 'exit' && (row.presetId === 11 || row.presetId === 12)) {
				expect(effect).toBeUndefined();
				continue;
			}
			expect(
				effect,
				`${row.presetClass}.${row.presetId} should have a playback effect`,
			).toBeDefined();
		}
	});
});
