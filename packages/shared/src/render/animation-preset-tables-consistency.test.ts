import { getNativeAnimationPresetMetadata, ooxmlToPresetName } from 'pptx-viewer-core';
/**
 * Cross-table consistency lock for the three OOXML animation-preset tables:
 *
 *  - `PRESET_ID_TO_EFFECT` / `EMPH_FILTER_PRESETS` (`./animation-presets`) -
 *    drives PLAYBACK.
 *  - `OOXML_TO_PRESET_ENTR` / `OOXML_TO_PRESET_EXIT` / `OOXML_TO_PRESET_EMPH`
 *    (`pptx-viewer-core`'s `animation-write-mappings`) - the reverse lookup
 *    used when reading a real deck back into the editor (and, via
 *    `PRESET_TO_OOXML`, when authoring a new one).
 *  - `getNativeAnimationPresetMetadata` (`pptx-viewer-core`'s
 *    `animation-preset-catalog`) - drives the UI labels.
 *
 * A real, confirmed bug (fixed alongside this test) shipped because these
 * three tables silently disagreed on what nine specific preset IDs meant: a
 * real "Circle", "Flash Once", "Peek In" or "Split" entrance, and a real
 * "Change Font Color" or "Change Line Color" emphasis, played back as a
 * DIFFERENT effect than the one the editor's inspector labelled it as. A
 * follow-up COM verification pass resolved several more IDs left out of that
 * first fix: entr.26/37 (Bounce/Rise Up were swapped), entr.49's inconsistent
 * catalog label, the entr.18/19 (Strips/Swivel) double-booking, exit.6/11,
 * and emph.1/2/10/16. This test does not re-derive ground truth (that was
 * done directly against retail PowerPoint via COM automation; see the
 * comments on the tables themselves) - it only asserts that, going forward,
 * the three tables cannot drift apart again without a test failure pointing
 * at the exact ID.
 *
 * @module render/animation-preset-tables-consistency
 */
import { describe, expect, it } from 'vitest';

import { EMPH_FILTER_PRESETS, PRESET_ID_TO_EFFECT } from './animation-presets';

type PresetClass = 'entr' | 'exit' | 'emph';

/**
 * Reduce a playback `EffectName` or an authoring/catalog typed preset name to
 * a comparable identity: strip a trailing "In"/"Out" direction/build suffix
 * (however it is spelled - a separate word as in a catalog label like
 * "Peek In", or a camelCase suffix as in a typed name like `peekIn`), then
 * drop all non-alphanumeric characters and lowercase what is left.
 */
function canonicalIdentity(raw: string): string {
	const trimmed = raw.trim();
	const spaceSuffix = /\s(?:In|Out)$/;
	const camelSuffix = /(?<=[a-z0-9])(?:In|Out)$/;
	const stripped = spaceSuffix.test(trimmed)
		? trimmed.replace(spaceSuffix, '')
		: camelSuffix.test(trimmed)
			? trimmed.replace(camelSuffix, '')
			: trimmed;
	return stripped.replace(/[^a-zA-Z0-9]/gu, '').toLowerCase();
}

/**
 * Two canonical identities "agree" if they are equal, or one is a prefix/
 * substring of the other. This tolerates a shorter historical alias standing
 * in for a more specific modern name (e.g. playback's `wave` for emph.2
 * against authoring's canonical `colorWave`, or `flashIn` for entr.11's
 * `flashOnceIn`), while still catching an outright DIFFERENT effect (e.g.
 * `peek` vs `split` share no such relationship).
 */
function identitiesAgree(a: string, b: string): boolean {
	return a === b || a.includes(b) || b.includes(a);
}

/**
 * Preset IDs whose playback `EffectName` is a deliberate approximation (no
 * dedicated keyframe exists for the real effect) with no textual overlap at
 * all against the real name, rather than a same-or-aliased name. Each entry
 * is documented at its source; this is a closed, reviewed list, not an
 * escape hatch - a new mismatch must be diagnosed, not added here reflexively.
 */
const APPROXIMATION_ALLOWLIST: ReadonlySet<string> = new Set([
	'entr.17', // Stretch has no dedicated keyframe; expandIn is the closest existing match
	// exit.6 = Circle, confirmed via COM (see the note on
	// `PRESET_ID_TO_EFFECT.exit[6]` in `animation-presets.ts`). There is no
	// dedicated exit iris/circle-mask keyframe yet, so playback keeps the
	// `shrinkOut` approximation (both read as "collapse to nothing") even
	// though authoring/catalog now correctly agree on `circleOut`/"Circle".
	'exit.6',
]);

function checkClassAgreement(presetClass: PresetClass): void {
	const effects = PRESET_ID_TO_EFFECT[presetClass];
	for (const [idStr, effectName] of Object.entries(effects)) {
		const id = Number(idStr);
		const key = `${presetClass}.${id}`;
		if (APPROXIMATION_ALLOWLIST.has(key)) {
			continue;
		}
		const playbackIdentity = canonicalIdentity(effectName);
		const typedName = ooxmlToPresetName({ presetClass, presetId: id });
		if (typedName !== undefined) {
			const authoringIdentity = canonicalIdentity(typedName);
			expect(
				identitiesAgree(playbackIdentity, authoringIdentity),
				`${key}: playback ("${effectName}" -> "${playbackIdentity}") vs authoring reverse lookup ("${typedName}" -> "${authoringIdentity}")`,
			).toBeTruthy();
		}
		if (presetClass !== 'exit') {
			const metadata = getNativeAnimationPresetMetadata({ presetClass, presetId: id });
			if (metadata !== undefined) {
				const catalogIdentity = canonicalIdentity(metadata.label);
				expect(
					identitiesAgree(playbackIdentity, catalogIdentity),
					`${key}: playback ("${effectName}" -> "${playbackIdentity}") vs catalog label ("${metadata.label}" -> "${catalogIdentity}")`,
				).toBeTruthy();
			}
		}
	}
}

describe('animation preset table cross-consistency', () => {
	it('agrees with the authoring reverse lookup and the UI catalog for every entrance ID playback covers', () => {
		checkClassAgreement('entr');
	});

	it('agrees with the authoring reverse lookup for every exit ID playback covers', () => {
		checkClassAgreement('exit');
	});

	it('agrees with the authoring reverse lookup and the UI catalog for every emphasis ID playback covers', () => {
		checkClassAgreement('emph');
	});

	it('agrees for every emphasis ID EMPH_FILTER_PRESETS covers', () => {
		for (const idStr of Object.keys(EMPH_FILTER_PRESETS)) {
			const id = Number(idStr);
			const filterIdentity = canonicalIdentity(EMPH_FILTER_PRESETS[id].name);
			const typedName = ooxmlToPresetName({ presetClass: 'emph', presetId: id });
			if (typedName !== undefined) {
				expect(
					identitiesAgree(filterIdentity, canonicalIdentity(typedName)),
					`emph.${id}`,
				).toBeTruthy();
			}
			const metadata = getNativeAnimationPresetMetadata({ presetClass: 'emph', presetId: id });
			if (metadata !== undefined) {
				expect(
					identitiesAgree(filterIdentity, canonicalIdentity(metadata.label)),
					`emph.${id}`,
				).toBeTruthy();
			}
		}
	});

	// The nine IDs a real, confirmed bug shipped at: explicit, named locks so
	// a regression on any one of them fails with an unambiguous message
	// rather than relying solely on the generic sweep above.
	describe('the nine previously-mismatched IDs resolve to the same real effect everywhere', () => {
		// IDs where playback, authoring and the catalog all now carry an entry.
		const coveredByPlayback: ReadonlyArray<{
			presetClass: PresetClass;
			presetId: number;
			effect: string;
		}> = [
			{ presetClass: 'entr', presetId: 6, effect: 'circle' },
			{ presetClass: 'entr', presetId: 11, effect: 'flashonce' },
			{ presetClass: 'entr', presetId: 12, effect: 'peek' },
			{ presetClass: 'entr', presetId: 16, effect: 'split' },
		];

		it.each(coveredByPlayback)(
			'$presetClass.$presetId -> $effect (playback, authoring, catalog)',
			({ presetClass, presetId, effect }) => {
				const fromPlayback = PRESET_ID_TO_EFFECT[presetClass][presetId];
				expect(
					fromPlayback,
					`${presetClass}.${presetId} should be covered by playback`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromPlayback!), effect)).toBeTruthy();

				const fromAuthoring = ooxmlToPresetName({ presetClass, presetId });
				expect(
					fromAuthoring,
					`${presetClass}.${presetId} should be covered by authoring`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromAuthoring!), effect)).toBeTruthy();

				const fromCatalog = getNativeAnimationPresetMetadata({ presetClass, presetId });
				expect(
					fromCatalog,
					`${presetClass}.${presetId} should be covered by the catalog`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), effect)).toBeTruthy();
			},
		);

		// emph.3/4/5/7 are intentionally NOT covered by playback: emph.3
		// (Change Font Color) and emph.7 (Change Line Color) already render
		// correctly via the `p:animClr` colour-animation path, and emph.4/5
		// (Change Font Size/Style) have no dynamic keyframe support yet, so
		// all four correctly fall back to the neutral emphasis animation
		// rather than a fabricated static effect. Authoring and the catalog
		// still agree with each other on the real effect for all four.
		const notCoveredByPlayback: ReadonlyArray<{ presetId: number; effect: string }> = [
			{ presetId: 3, effect: 'changefontcolor' },
			{ presetId: 4, effect: 'changefontsize' },
			{ presetId: 5, effect: 'changefontstyle' },
			{ presetId: 7, effect: 'changelinecolor' },
		];

		it.each(notCoveredByPlayback)(
			'emph.$presetId -> $effect is correctly absent from playback, but authoring/catalog agree',
			({ presetId, effect }) => {
				expect(PRESET_ID_TO_EFFECT.emph[presetId]).toBeUndefined();
				expect(EMPH_FILTER_PRESETS[presetId]).toBeUndefined();

				const fromAuthoring = ooxmlToPresetName({ presetClass: 'emph', presetId });
				expect(fromAuthoring, `emph.${presetId} should be covered by authoring`).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromAuthoring!), effect)).toBeTruthy();

				const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'emph', presetId });
				expect(fromCatalog, `emph.${presetId} should be covered by the catalog`).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), effect)).toBeTruthy();
			},
		);

		// entr.17 (Stretch) has no dedicated keyframe, so playback keeps the
		// `expandIn` approximation (see APPROXIMATION_ALLOWLIST above); the
		// point of this lock is that authoring and the catalog now agree with
		// each other AND with reality, even though playback's approximation
		// does not literally spell "stretch".
		it('entr.17 (Stretch): authoring and catalog agree, playback uses the documented expandIn approximation', () => {
			const fromAuthoring = ooxmlToPresetName({ presetClass: 'entr', presetId: 17 });
			expect(identitiesAgree(canonicalIdentity(fromAuthoring!), 'stretch')).toBeTruthy();

			const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId: 17 });
			expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), 'stretch')).toBeTruthy();

			expect(PRESET_ID_TO_EFFECT.entr[17]).toBe('expandIn');
		});
	});

	// IDs resolved in a follow-up COM verification pass (entr.26/entr.37,
	// entr.49's catalog label, the entr.18/19 double-booking, exit.6/exit.11,
	// and emph.1/2/10/16). Ground truth for all of these came from the same
	// method: `MainSequence.AddEffect` with a named `MsoAnimEffect` constant,
	// then inspecting the raw `presetID`/`presetClass`/filter PowerPoint wrote.
	describe('the follow-up COM verification pass resolves to the same real effect everywhere', () => {
		const coveredByPlayback: ReadonlyArray<{
			presetClass: PresetClass;
			presetId: number;
			effect: string;
		}> = [
			// entr.26/37 were swapped: msoAnimEffectBounce serializes as
			// presetID 26 and msoAnimEffectRiseUp as presetID 37.
			{ presetClass: 'entr', presetId: 26, effect: 'bounce' },
			{ presetClass: 'entr', presetId: 37, effect: 'riseup' },
			// entr.49: write-mappings already had this right (`spinnerIn`);
			// only the catalog label ("Pinwheel IV") was inconsistent.
			{ presetClass: 'entr', presetId: 49, effect: 'spinner' },
			// emph.10 is really Bold Flash (targets style.fontWeight), not
			// Change Font Size (that is emph.4, unaffected).
			{ presetClass: 'emph', presetId: 10, effect: 'boldflash' },
		];

		it.each(coveredByPlayback)(
			'$presetClass.$presetId -> $effect (playback, authoring, catalog)',
			({ presetClass, presetId, effect }) => {
				const fromPlayback = PRESET_ID_TO_EFFECT[presetClass][presetId];
				expect(
					fromPlayback,
					`${presetClass}.${presetId} should be covered by playback`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromPlayback!), effect)).toBeTruthy();

				const fromAuthoring = ooxmlToPresetName({ presetClass, presetId });
				expect(
					fromAuthoring,
					`${presetClass}.${presetId} should be covered by authoring`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromAuthoring!), effect)).toBeTruthy();

				const fromCatalog = getNativeAnimationPresetMetadata({ presetClass, presetId });
				expect(
					fromCatalog,
					`${presetClass}.${presetId} should be covered by the catalog`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), effect)).toBeTruthy();
			},
		);

		// entr.18/19 (Strips/Swivel) were double-booked: authoring/catalog had
		// entr.19 as Strips and a separate name (`swivel`) pointing at entr.47.
		// entr.18 (Strips) still has no dedicated keyframe; entr.19 (Swivel)
		// is now ALSO covered by playback (see "a further COM verification
		// pass resolves more ids" below), so only entr.18 is checked here.
		it.each([{ presetId: 18, effect: 'strips' }])(
			'entr.$presetId -> $effect (authoring, catalog; not covered by playback)',
			({ presetId, effect }) => {
				expect(PRESET_ID_TO_EFFECT.entr[presetId]).toBeUndefined();

				const fromAuthoring = ooxmlToPresetName({ presetClass: 'entr', presetId });
				expect(fromAuthoring, `entr.${presetId} should be covered by authoring`).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromAuthoring!), effect)).toBeTruthy();

				const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId });
				expect(fromCatalog, `entr.${presetId} should be covered by the catalog`).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), effect)).toBeTruthy();
			},
		);

		// emph.1/2/16 have no dynamic keyframe or animClr path today, so they
		// correctly fall back to the neutral emphasis animation rather than a
		// fabricated static effect (mirroring the emph.3/4/5/7 precedent
		// above). Authoring and the catalog agree with each other.
		it.each([
			{ presetId: 1, effect: 'changefillcolor' },
			{ presetId: 2, effect: 'changefont' },
			{ presetId: 16, effect: 'brushoncolor' },
		])(
			'emph.$presetId -> $effect is correctly absent from playback, but authoring/catalog agree',
			({ presetId, effect }) => {
				expect(PRESET_ID_TO_EFFECT.emph[presetId]).toBeUndefined();
				expect(EMPH_FILTER_PRESETS[presetId]).toBeUndefined();

				const fromAuthoring = ooxmlToPresetName({ presetClass: 'emph', presetId });
				expect(fromAuthoring, `emph.${presetId} should be covered by authoring`).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromAuthoring!), effect)).toBeTruthy();

				const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'emph', presetId });
				expect(fromCatalog, `emph.${presetId} should be covered by the catalog`).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), effect)).toBeTruthy();
			},
		);

		// exit.6 (Circle) has no dedicated exit iris/circle-mask keyframe, so
		// playback keeps the `shrinkOut` approximation (see
		// APPROXIMATION_ALLOWLIST above); authoring and the catalog now agree
		// with each other AND with reality.
		it('exit.6 (Circle): authoring and catalog agree, playback uses the documented shrinkOut approximation', () => {
			const fromAuthoring = ooxmlToPresetName({ presetClass: 'exit', presetId: 6 });
			expect(identitiesAgree(canonicalIdentity(fromAuthoring!), 'circle')).toBeTruthy();

			const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'exit', presetId: 6 });
			expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), 'circle')).toBeTruthy();

			expect(PRESET_ID_TO_EFFECT.exit[6]).toBe('shrinkOut');
		});

		// exit.11 (Flash Once) is not covered by playback (no dedicated
		// keyframe distinct from the entrance flash), but authoring and the
		// catalog now agree with each other.
		it('exit.11 (Flash Once): authoring and catalog agree, not covered by playback', () => {
			expect(PRESET_ID_TO_EFFECT.exit[11]).toBeUndefined();

			const fromAuthoring = ooxmlToPresetName({ presetClass: 'exit', presetId: 11 });
			expect(identitiesAgree(canonicalIdentity(fromAuthoring!), 'flashonce')).toBeTruthy();

			const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'exit', presetId: 11 });
			expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), 'flashonce')).toBeTruthy();
		});
	});

	// A further, independent COM verification pass (AddEffect + `Effect.Exit =
	// True` + raw OOXML inspection) found: (1) entr.19 (Swivel) was already
	// correctly resolved by authoring and the catalog but never wired up in
	// playback, even though its dedicated `swivel` keyframe already existed;
	// (2) exit.26/exit.37 (Bounce / Sink Down, i.e. Rise Up's exit-gallery
	// name) were swapped in all three tables, mirroring the entr.26/37
	// mix-up already fixed on the entrance side; (3) emph.14/emph.32 (Blast /
	// Teeter) were likewise swapped; (4) emph.20/emph.34 (Color Wave / Wave)
	// were already correctly resolved by authoring and the catalog but never
	// wired up in playback, even though their dedicated keyframes already
	// existed.
	describe('a further COM verification pass resolves more ids', () => {
		it('entr.19 (Swivel): now covered by playback, matching authoring and the catalog', () => {
			expect(PRESET_ID_TO_EFFECT.entr[19]).toBe('swivel');

			const fromAuthoring = ooxmlToPresetName({ presetClass: 'entr', presetId: 19 });
			expect(identitiesAgree(canonicalIdentity(fromAuthoring!), 'swivel')).toBeTruthy();

			const fromCatalog = getNativeAnimationPresetMetadata({ presetClass: 'entr', presetId: 19 });
			expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), 'swivel')).toBeTruthy();
		});

		it.each([
			{ presetClass: 'exit' as const, presetId: 26, effect: 'bounce' },
			{ presetClass: 'exit' as const, presetId: 37, effect: 'sinkdown' },
			{ presetClass: 'emph' as const, presetId: 32, effect: 'teeter' },
			{ presetClass: 'emph' as const, presetId: 20, effect: 'colorwave' },
			{ presetClass: 'emph' as const, presetId: 34, effect: 'wave' },
		])(
			'$presetClass.$presetId -> $effect (playback, authoring, catalog agree)',
			({ presetClass, presetId, effect }) => {
				const fromPlayback = PRESET_ID_TO_EFFECT[presetClass][presetId];
				expect(
					fromPlayback,
					`${presetClass}.${presetId} should be covered by playback`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromPlayback!), effect)).toBeTruthy();

				const fromAuthoring = ooxmlToPresetName({ presetClass, presetId });
				expect(
					fromAuthoring,
					`${presetClass}.${presetId} should be covered by authoring`,
				).toBeDefined();
				expect(identitiesAgree(canonicalIdentity(fromAuthoring!), effect)).toBeTruthy();

				if (presetClass !== 'exit') {
					const fromCatalog = getNativeAnimationPresetMetadata({ presetClass, presetId });
					expect(
						fromCatalog,
						`${presetClass}.${presetId} should be covered by the catalog`,
					).toBeDefined();
					expect(identitiesAgree(canonicalIdentity(fromCatalog!.label), effect)).toBeTruthy();
				}
			},
		);

		it('exit.26/exit.37 no longer carry their old (swapped) effect names', () => {
			expect(PRESET_ID_TO_EFFECT.exit[26]).not.toBe('sinkDown');
			expect(PRESET_ID_TO_EFFECT.exit[37]).not.toBe('bounceOut');
		});

		it('emph.14 (real Blast, not Teeter) has no dedicated keyframe and is correctly left unmapped', () => {
			expect(PRESET_ID_TO_EFFECT.emph[14]).toBeUndefined();

			const fromAuthoring = ooxmlToPresetName({ presetClass: 'emph', presetId: 14 });
			expect(fromAuthoring).toBeUndefined();
		});
	});
});
