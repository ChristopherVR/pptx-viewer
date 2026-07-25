import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isExempt, TYPES, validate, validateAll } from './check-conventional-commits.mjs';

const errorsFor = (s) => validate(s).errors;
const warningsFor = (s) => validate(s).warnings;

test('accepts subjects taken from this repo history', () => {
	const good = [
		'feat(core): typed xml-access helpers',
		'fix(react): remove dead table-cell comparisons',
		'chore(deps): update all dependencies to latest',
		'feat(core)!: drop the legacy save path',
		'docs: clarify the parity rule',
		'revert: feat(core) typed xml-access helpers',
	];
	for (const subject of good) {
		assert.deepEqual(validate(subject), { errors: [], warnings: [] }, `expected clean: ${subject}`);
	}
});

test('a missing type is a hard error', () => {
	assert.ok(errorsFor('made the ribbon nicer').length > 0);
});

test('an unknown type is a hard error', () => {
	assert.ok(errorsFor('feature(react): add a button').some((e) => e.includes('unknown type')));
});

test('cosmetic problems are warnings, not errors', () => {
	// Every one of these appears in real history and must not fail a PR.
	const cosmetic = [
		'fix: Svelte border width for selected element',
		'fix(react): remove dead code.',
		'fix(): remove dead code',
		`fix(react): ${'x'.repeat(80)}`,
	];
	for (const subject of cosmetic) {
		assert.deepEqual(errorsFor(subject), [], `should not fail: ${subject}`);
		assert.ok(warningsFor(subject).length > 0, `should warn: ${subject}`);
	}
});

test('`merge:` is exempt because this repo uses it for branch folds', () => {
	assert.ok(isExempt('merge: vue icon-parity sweep (glyphs to lucide-vue-next)'));
	assert.deepEqual(validate('merge: bring animClr e2e coverage from main into feature/v2'), {
		errors: [],
		warnings: [],
	});
});

test('exempts merge and revert commits GitHub generates', () => {
	assert.ok(isExempt('Merge pull request #107 from OrdalieTech/fix/bullets'));
	assert.ok(isExempt('Revert "feat(core): typed xml-access helpers"'));
	assert.deepEqual(errorsFor("Merge branch 'main' into fix/bullets"), []);
});

test('validateAll reports both errors and warnings', () => {
	const flagged = validateAll(['feat(core): fine', 'nope', 'fix(react): Capitalised']);
	assert.equal(flagged.length, 2);
	assert.equal(flagged.filter((f) => f.errors.length > 0).length, 1);
});

test('the accepted type list matches cliff.toml commit_parsers', () => {
	const cliff = readFileSync(new URL('../cliff.toml', import.meta.url), 'utf8');
	for (const type of TYPES) {
		assert.ok(
			cliff.includes(`^${type}`) || cliff.includes(`|${type})`) || cliff.includes(`(${type}|`),
			`cliff.toml has no parser for \`${type}\`, so it would land in "Other"`,
		);
	}
});

test('the last 200 commits on this repo produce no hard errors', () => {
	// A rule that would reject this project's own history is a rule that gets
	// switched off. This test is the guard against tightening one too far.
	const subjects = execFileSync('git', ['log', '-200', '--format=%s'], { encoding: 'utf8' })
		.split('\n')
		.filter(Boolean);

	const failures = validateAll(subjects).filter((r) => r.errors.length > 0);
	assert.deepEqual(
		failures.map((f) => f.subject),
		[],
		'real commits must not fail the check',
	);
});

test("dependabot's doubled scope warns rather than failing", () => {
	const subject = 'chore(deps-dev)(deps-dev): Update happy-dom requirement (#104)';
	assert.deepEqual(errorsFor(subject), []);
	assert.ok(warningsFor(subject).some((w) => w.includes('2 scopes')));
});
