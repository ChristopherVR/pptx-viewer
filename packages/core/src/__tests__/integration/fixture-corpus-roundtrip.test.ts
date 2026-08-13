/**
 * The corpus-wide load -> save -> reload -> validate harness.
 *
 * ## What it is for
 *
 * Eight defects that made PowerPoint refuse to open a saved deck shipped under
 * a green suite because no test ever opened a saved file. Every one of them is
 * visible from a plain no-edit round trip of a real deck, and every one of them
 * is invisible to a model-level assertion, because re-parsing our own output
 * forgives the damage. This harness runs that round trip over EVERY deck in
 * `fixture-corpus-manifest.ts` and asserts, per fixture:
 *
 *   1. the saved package still opens through our own loader;
 *   2. the part list is preserved (allowed losses are declared per fixture);
 *   3. per-slide element counts are stable;
 *   4. every XML part in the output is well-formed;
 *   5. `validatePptx` reports no new errors, and none at all on a deck that
 *      was clean going in.
 *
 * ## Running it
 *
 *     bun run --filter pptx-viewer-core test -- fixture-corpus-roundtrip
 *
 * A full pass is roughly 30 seconds; the whole binary corpus is 130 MB.
 *
 * ## PowerPoint acceptance
 *
 * Passing here is necessary, not sufficient: our loader is more forgiving than
 * PowerPoint's. `scripts/com-acceptance.mjs` drives the real application over
 * the same manifest and is the ground truth. It is deliberately NOT part of
 * `bun run test`, because it needs a local PowerPoint install. Run it after any
 * change to the save pipeline:
 *
 *     bun run scripts/com-acceptance.mjs
 *
 * @see fixture-corpus-manifest.ts for provenance and the accepted deviations.
 * @see save-invariants.test.ts for the specific corruption classes this repo
 *      has already shipped once.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import {
	chartFlavourMismatches,
	describeIssues,
	malformedParts,
	partNames,
	readFixture,
	roundTrip,
	validationErrors,
} from './fixture-corpus-harness';
import type { RoundTrip } from './fixture-corpus-harness';
import { FIXTURE_MANIFEST, listFixturesOnDisk, manifestFor } from './fixture-corpus-manifest';
import type { FixtureEntry } from './fixture-corpus-manifest';

const TIMEOUT = 120_000;

/**
 * The presence guard, and the reason `it.skipIf(!existsSync(fixture))` is
 * banned in this directory: a skipped test is a green test, so deleting a
 * fixture used to reduce coverage silently. Here the manifest and the
 * directory must agree exactly, in both directions.
 */
describe('fixture corpus: the manifest and the tree agree', () => {
	for (const dir of ['e2e', 'corpus'] as const) {
		it(`every .pptx in ${dir} is declared, and every declaration exists`, () => {
			expect(listFixturesOnDisk(dir)).toStrictEqual(manifestFor(dir).map((e) => e.file));
		});
	}

	it('keeps genuine, non-synthetic decks in the corpus', () => {
		// Synthetic decks are our serializer feeding our parser, so they cannot
		// witness a disagreement between us and PowerPoint. If this ever drops
		// to zero the harness has stopped proving anything about real files.
		const genuine = FIXTURE_MANIFEST.filter((e) => e.provenance !== 'synthetic');
		expect(genuine.length).toBeGreaterThanOrEqual(15);
		expect(genuine.filter((e) => e.provenance === 'powerpoint').length).toBeGreaterThanOrEqual(8);
	});

	it('documents a cause for every known defect', () => {
		for (const entry of FIXTURE_MANIFEST) {
			for (const [check, reason] of Object.entries(entry.knownDefects ?? {})) {
				if (reason.length <= 40) {
					throw new Error(
						`${entry.file} knownDefects.${check} needs a written cause, got: ${reason}`,
					);
				}
			}
		}
	});
});

describe('fixture corpus: an encrypted package is rejected, not mis-parsed', () => {
	for (const entry of FIXTURE_MANIFEST.filter((e) => e.status === 'encrypted')) {
		it(
			`${entry.file} fails to open with a diagnosable error`,
			async () => {
				const { PptxHandler } = await import('../../core/PptxHandler');
				await expect(new PptxHandler().load(readFixture(entry))).rejects.toThrow();

				// The validator must say WHY rather than crash or pass it.
				const errors = await validationErrors(readFixture(entry));
				expect(errors.map((e) => e.code)).toContain('INVALID_ZIP');
			},
			TIMEOUT,
		);
	}
});

/** Element counts per slide, the cheapest signal that a shape was dropped or duplicated. */
function elementCounts(slides: RoundTrip['original']): number[] {
	return slides.map((slide) => slide.elements.length);
}

/**
 * The `type` discriminant of every element, per slide, in document order.
 *
 * Counts alone cannot see a RECLASSIFICATION: a shape that goes in as one kind
 * and comes back as another keeps the total the same while changing what the
 * markup means and what every renderer and editor does with it. Two such
 * defects are known (see the manifest ledger), and both are invisible to a
 * count-only assertion.
 */
function elementTypeShape(slides: RoundTrip['original']): string[] {
	return slides.map((slide) => slide.elements.map((el) => el.type).join(','));
}

/**
 * Assert a check, honouring a declared known defect. A known defect must
 * actually still be broken: if it starts passing the entry is stale and the
 * test says so, which is what keeps the ledger honest.
 */
function expectOrKnownDefect(entry: FixtureEntry, check: string, assertion: () => void): void {
	const known = entry.knownDefects?.[check];
	if (!known) {
		assertion();
		return;
	}
	let threw = false;
	try {
		assertion();
	} catch {
		threw = true;
	}
	if (!threw) {
		throw new Error(
			`${entry.file}: knownDefects.${check} says this is broken, but it passed. ` +
				`If it has been fixed, delete the entry from fixture-corpus-manifest.ts. ` +
				`Recorded cause: ${known}`,
		);
	}
}

for (const entry of FIXTURE_MANIFEST.filter((e) => e.status === 'roundtrip')) {
	describe(`fixture corpus: ${entry.file}`, () => {
		let rt: RoundTrip;

		beforeAll(async () => {
			rt = await roundTrip(entry);
		}, TIMEOUT);

		it('reopens through our own loader with the same slide count', () => {
			expect(rt.reloaded).toHaveLength(rt.original.length);
			expect(rt.reloaded.length).toBeGreaterThan(0);
		});

		it('preserves the part list', () => {
			const before = partNames(rt.before);
			const after = new Set(partNames(rt.after));
			const allowed = new Set(entry.allowedPartLoss ?? []);
			const lost = before.filter((name) => !after.has(name) && !allowed.has(name));
			expect(lost).toStrictEqual([]);

			// An allowance that no longer applies is dead weight: drop it.
			const stillPresent = [...allowed].filter((name) => after.has(name));
			expect(stillPresent, 'allowedPartLoss lists parts that are not lost').toStrictEqual([]);
		});

		it('keeps a consistent package: no dangling content types or relationships', async () => {
			const errors = await validationErrors(rt.savedBytes);
			const opc = errors.filter(
				(e) =>
					e.code === 'MISSING_CONTENT_TYPE' ||
					e.code === 'UNRESOLVED_RELATIONSHIP' ||
					e.code === 'MISSING_REQUIRED_FILE',
			);
			expect(describeIssues(opc)).toStrictEqual([]);
		});

		it('keeps per-slide element counts stable', () => {
			expectOrKnownDefect(entry, 'elementCountStable', () => {
				expect(elementCounts(rt.reloaded)).toStrictEqual(elementCounts(rt.original));
			});
		});

		it('keeps per-slide element types stable', () => {
			expectOrKnownDefect(entry, 'elementTypeStable', () => {
				expect(elementTypeShape(rt.reloaded)).toStrictEqual(elementTypeShape(rt.original));
			});
		});

		it(
			'writes well-formed XML in every part',
			async () => {
				await expect(malformedParts(rt.after)).resolves.toStrictEqual([]);
			},
			TIMEOUT,
		);

		it('binds every chart part to the content type its root element implies', async () => {
			await expect(chartFlavourMismatches(rt.after)).resolves.toStrictEqual([]);
		});

		/**
		 * The validator only earns the right to gate saves if it is honest
		 * about genuine input, so this asserts BOTH directions: a deck that was
		 * clean going in must be clean coming out, and a deck that was not must
		 * not get worse. See `pptx-validator-facet-constants.ts` for the three
		 * rule families that had to be corrected before this could be asserted
		 * at all.
		 */
		it(
			'introduces no new validation errors',
			async () => {
				const before = await validationErrors(rt.originalBytes);
				const after = await validationErrors(rt.savedBytes);
				const beforeCodes = new Set(before.map((e) => `${e.code}|${e.message}`));
				const introduced = after.filter((e) => !beforeCodes.has(`${e.code}|${e.message}`));
				expectOrKnownDefect(entry, 'validationErrorsNotIntroduced', () => {
					expect(describeIssues(introduced)).toStrictEqual([]);
				});
			},
			TIMEOUT,
		);

		it(
			'is a valid package before it is saved',
			async () => {
				expect(describeIssues(await validationErrors(rt.originalBytes))).toStrictEqual([]);
			},
			TIMEOUT,
		);

		it(
			'is a valid package after it is saved',
			async () => {
				const after = describeIssues(await validationErrors(rt.savedBytes));
				expectOrKnownDefect(entry, 'validationErrorsNotIntroduced', () => {
					expect(after).toStrictEqual([]);
				});
			},
			TIMEOUT,
		);
	});
}
