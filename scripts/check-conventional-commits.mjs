/**
 * Conventional Commit validation for pull requests.
 *
 * This is not style policing. Each package here is versioned and released
 * independently, and the bump level is derived from the commit type
 * (see cliff.toml -> commit_parsers and scripts/release-plan.mjs), so a
 * mislabelled commit mis-versions a published package and a non-conforming one
 * is dropped from the changelog silently.
 *
 * Two severities, because a linter that rejects a quarter of this repo's own
 * history is a linter people will switch off:
 *
 *   ERROR   - breaks the release pipeline (no type, or a type cliff.toml does
 *             not parse). These fail the check.
 *   WARNING - cosmetic (header length, casing, trailing period). Reported as
 *             annotations only. A 76-char subject and a proper noun after the
 *             colon are both common and harmless in this history.
 *
 * The accepted type list is kept in sync with cliff.toml by
 * scripts/check-conventional-commits.test.mjs.
 *
 * Usage: node scripts/check-conventional-commits.mjs <subjects.json>
 *   where subjects.json is a JSON array of commit subject lines. The PR title
 *   is validated the same way, because a squash merge can use either.
 */

import { readFileSync } from 'node:fs';

export const TYPES = [
	'feat',
	'fix',
	'perf',
	'refactor',
	'docs',
	'test',
	'build',
	'ci',
	'style',
	'chore',
	'revert',
];

// `scopes` is a repeating group rather than a single one so that Dependabot's
// doubled `chore(deps-dev)(deps-dev):` form parses instead of hard-failing. The
// duplication is a dependabot.yml misconfiguration (a scoped `prefix` plus
// `include: scope`), reported as a warning below.
const SUBJECT_RE = /^(?<type>[a-z]+)(?<scopes>(?:\([^)]*\))*)(?<breaking>!)?: (?<desc>.+)$/u;
const SCOPE_RE = /\(([^)]*)\)/gu;

/** Advisory only. CLAUDE.md says "~72", and real history regularly runs to 84. */
const SOFT_HEADER_LIMIT = 72;

/**
 * Subjects nobody hand-writes, plus `merge:`, which is an established local
 * convention in this repo for folding a long-lived branch back in. It is not in
 * cliff.toml on purpose, so those commits land in "Other" and bump patch.
 */
export function isExempt(subject) {
	return (
		/^Merge (?:branch|pull request|remote-tracking)\b/u.test(subject) ||
		/^Revert "/u.test(subject) ||
		/^merge:/u.test(subject)
	);
}

export function validate(subject) {
	const errors = [];
	const warnings = [];
	const trimmed = subject.trim();

	if (isExempt(trimmed)) {
		return { errors, warnings };
	}

	const match = SUBJECT_RE.exec(trimmed);
	if (!match?.groups) {
		errors.push(
			'does not match `<type>(<scope>): <subject>`. ' +
				`Valid types: ${TYPES.join(', ')}. ` +
				'Example: `fix(vue): apply the same clip-path fix as react`',
		);
		return { errors, warnings };
	}

	const { type, scopes, desc } = match.groups;
	const scopeList = [...(scopes ?? '').matchAll(SCOPE_RE)].map((m) => m[1]);

	if (!TYPES.includes(type)) {
		errors.push(
			`unknown type \`${type}\`. cliff.toml cannot parse it, so the commit would ` +
				`be dropped from the changelog. Valid types: ${TYPES.join(', ')}`,
		);
	}

	if (scopeList.length > 1) {
		warnings.push(
			`has ${scopeList.length} scopes (\`${scopeList.join('`, `')}\`); ` +
				'Conventional Commits allows one',
		);
	}

	if (scopeList.some((s) => s.trim() === '')) {
		warnings.push('has an empty scope; drop the parentheses or name the package');
	}

	if (/^[A-Z][a-z]/u.test(desc)) {
		warnings.push('subject is usually lower-case (ignore this for a proper noun)');
	}

	if (desc.endsWith('.')) {
		warnings.push('subject does not normally end with a period');
	}

	if (trimmed.length > SOFT_HEADER_LIMIT) {
		warnings.push(`header is ${trimmed.length} chars; ${SOFT_HEADER_LIMIT} or under reads better`);
	}

	return { errors, warnings };
}

export function validateAll(subjects) {
	return subjects
		.map((subject) => ({ subject, ...validate(subject) }))
		.filter((r) => r.errors.length > 0 || r.warnings.length > 0);
}

function main() {
	const [inputPath] = process.argv.slice(2);
	if (!inputPath) {
		console.error('usage: node scripts/check-conventional-commits.mjs <subjects.json>');
		process.exit(2);
	}

	const subjects = JSON.parse(readFileSync(inputPath, 'utf8')).filter(Boolean);
	const flagged = validateAll(subjects);
	const failed = flagged.filter((r) => r.errors.length > 0);

	for (const { subject, errors, warnings } of flagged) {
		const level = errors.length > 0 ? 'error' : 'warning';
		console.log(`::${level}::${subject}`);
		for (const message of [...errors, ...warnings]) {
			console.log(`  - ${message}`);
		}
	}

	if (failed.length === 0) {
		console.log(`\nOK: ${subjects.length} subject(s) checked, ${flagged.length} with warnings.`);
		return;
	}

	console.log(
		'\nCommit types drive published version bumps here, so this is load-bearing.\n' +
			'See https://github.com/ChristopherVR/pptx-viewer/blob/main/CONTRIBUTING.md#commit-conventions',
	);
	process.exit(1);
}

if (process.argv[1]?.endsWith('check-conventional-commits.mjs')) {
	main();
}
