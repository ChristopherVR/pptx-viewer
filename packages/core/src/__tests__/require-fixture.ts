/**
 * Assert that a committed test fixture is present, loudly.
 *
 * ## The pattern this replaces
 *
 * Ten test files in this package used to open with
 *
 * ```ts
 * const hasFixture = existsSync(fixturePath);
 * it.skipIf(!hasFixture)('...', async () => { ... });
 * ```
 *
 * across twenty-one test sites. A skipped test is a GREEN test. Delete,
 * rename or move the deck and the suite still passes, with no output anyone
 * would notice, having silently stopped checking anything. That is precisely
 * how eight defects serious enough to make PowerPoint refuse a saved file
 * reached main under a green build.
 *
 * The guard is worth keeping; only its failure mode was wrong. These fixtures
 * are committed to the repository, so their absence is never a legitimate
 * environment difference the way a missing PowerPoint install is. It is a
 * broken checkout or a bad rename, and either deserves an error.
 *
 * ## Use
 *
 * Call it at MODULE scope and use the returned path. A missing fixture then
 * fails collection of the whole file, naming the file it wanted, rather than
 * failing one assertion deep inside a test:
 *
 * ```ts
 * const fixture = requireFixture(path.resolve(__dirname, '../fixtures/x.pptx'));
 * it('...', async () => { const bytes = readFileSync(fixture); });
 * ```
 *
 * For a whole directory of decks, prefer the exact set comparison in
 * `integration/fixture-corpus-manifest.ts`, which additionally catches a
 * fixture ADDED without being classified.
 *
 * @module __tests__/require-fixture
 */
import { existsSync } from 'node:fs';

export function requireFixture(fixturePath: string): string {
	if (!existsSync(fixturePath)) {
		throw new Error(
			`Missing committed test fixture: ${fixturePath}\n` +
				'This deck is checked into the repository, so its absence is a broken checkout ' +
				'or a rename that missed this test, never a valid environment difference. ' +
				'Restore the file rather than skipping the test: a skipped test is a green test, ' +
				'and silently losing coverage here is how save-pipeline corruption has shipped before.',
		);
	}
	return fixturePath;
}
