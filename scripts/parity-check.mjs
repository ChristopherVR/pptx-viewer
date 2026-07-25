/**
 * Cross-binding parity advisory for pull requests.
 *
 * This project ships the same viewer through five bindings, so a UI change that
 * lands in one of them is usually incomplete (see CONTRIBUTING.md). This script
 * reads a PR's changed-file list and reports where parity looks likely to have
 * been missed.
 *
 * It is ADVISORY ONLY and never exits non-zero. The heuristics below are path
 * based, so they cannot tell a genuinely framework-specific fix from a parity
 * gap; that judgement stays with the author and reviewer. Failing a PR on a
 * guess would train people to ignore it.
 *
 * Usage: node scripts/parity-check.mjs <changed-files.json> [out.md]
 */

import { readFileSync, writeFileSync } from 'node:fs';

export const BINDINGS = [
	{ key: 'react', label: 'React', dir: 'packages/react' },
	{ key: 'vue', label: 'Vue', dir: 'packages/vue' },
	{ key: 'angular', label: 'Angular', dir: 'packages/angular' },
	{ key: 'svelte', label: 'Svelte', dir: 'packages/svelte' },
	{ key: 'vanilla', label: 'Vanilla', dir: 'packages/vanilla' },
];

const SHARED_SRC = 'packages/shared/src/';
const EN_TRANSLATIONS = 'packages/shared/src/i18n/translations-en.ts';
const LOCALE_RE = /^packages\/locales\/src\/(de|es|fr)\//u;
const TEST_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const E2E_SPEC_RE = /^e2e\/(?!capture-)[^/]+\.spec\.ts$/u;

function isSource(file) {
	return !TEST_RE.test(file);
}

/** Bindings whose non-test source was touched. */
export function touchedBindings(files) {
	return BINDINGS.filter((b) => files.some((f) => f.startsWith(`${b.dir}/src/`) && isSource(f)));
}

/** Bindings with any change at all, tests included. */
function testedBindings(files) {
	return BINDINGS.filter((b) => files.some((f) => f.startsWith(`${b.dir}/`) && TEST_RE.test(f)));
}

export function analyse(files) {
	const touched = touchedBindings(files);
	const tested = testedBindings(files);
	const missing = BINDINGS.filter((b) => !touched.includes(b));
	const sharedTouched = files.some((f) => f.startsWith(SHARED_SRC) && isSource(f));
	const e2eTouched = files.some((f) => E2E_SPEC_RE.test(f));
	const enTouched = files.includes(EN_TRANSLATIONS);
	const localesTouched = files.some((f) => LOCALE_RE.test(f));

	const findings = [];

	if (touched.length > 0 && missing.length > 0) {
		findings.push({
			id: 'partial-bindings',
			title: `UI source changed in ${touched.length} of ${BINDINGS.length} bindings`,
			body:
				`Changed: **${touched.map((b) => b.label).join(', ')}**. ` +
				`Not changed: **${missing.map((b) => b.label).join(', ')}**.\n\n` +
				'If this is a new UI feature, it needs to land in all five. If it is a ' +
				'fix, please confirm in the PR description whether the other bindings ' +
				'have the same defect, and fix the ones that do. If the change really ' +
				'is framework-specific, say so and this note can be ignored.',
		});
	}

	if (touched.length >= 2 && !sharedTouched) {
		findings.push({
			id: 'no-shared',
			title: 'Several bindings changed, but `packages/shared` did not',
			body:
				'Parallel edits across bindings with no shared change often mean the ' +
				'same logic was written more than once. Framework-agnostic logic ' +
				'belongs in `pptx-viewer-shared`, with each binding importing it. ' +
				'View-layer-only changes are a legitimate exception.',
		});
	}

	if (touched.length > 0 && !e2eTouched) {
		findings.push({
			id: 'no-e2e',
			title: 'Binding UI changed with no framework-neutral e2e spec',
			body:
				'Specs in `e2e/` run against all five demos, so they are what stops a ' +
				'binding quietly falling behind. New UI features should add or extend ' +
				'one. Fixes covered by unit tests can skip this.',
		});
	}

	if (touched.length > 0 && tested.length < touched.length) {
		const untested = touched.filter((b) => !tested.includes(b));
		findings.push({
			id: 'no-unit-tests',
			title: 'Some changed bindings have no test changes',
			body: `No test files changed under: **${untested.map((b) => b.label).join(', ')}**.`,
		});
	}

	if (enTouched && !localesTouched) {
		findings.push({
			id: 'missing-locales',
			title: 'English i18n keys changed without `de`/`es`/`fr`',
			body:
				'`packages/locales/src/locales.test.ts` requires every locale to cover ' +
				'every canonical key, so this will fail CI if keys were added.',
		});
	}

	return { touched, missing, findings };
}

export const COMMENT_MARKER = '<!-- pptx-viewer:parity-check -->';

export function renderReport({ touched, missing, findings }) {
	if (findings.length === 0) {
		return null;
	}

	const rows = BINDINGS.map((b) => {
		const state = touched.includes(b) ? 'changed' : 'not changed';
		return `| ${b.label} | ${state} |`;
	}).join('\n');

	return [
		COMMENT_MARKER,
		'### Cross-binding parity check',
		'',
		'This is **advisory only** and does not block the PR. It looks at changed ' +
			'file paths, so it cannot tell a genuinely framework-specific change from ' +
			'a parity gap. If it is wrong here, just say so in a comment.',
		'',
		'| Binding | This PR |',
		'| --- | --- |',
		rows,
		'',
		...findings.flatMap((f) => [`#### ${f.title}`, '', f.body, '']),
		'---',
		'',
		'See [the parity rule](https://github.com/ChristopherVR/pptx-viewer/blob/main/CONTRIBUTING.md#the-parity-rule-read-this-before-writing-ui-code) ' +
			`for what is expected. Missing: ${missing.map((b) => b.label).join(', ') || 'none'}.`,
	].join('\n');
}

function main() {
	const [inputPath, outPath = 'parity-report.md'] = process.argv.slice(2);
	if (!inputPath) {
		console.error('usage: node scripts/parity-check.mjs <changed-files.json> [out.md]');
		process.exit(2);
	}

	const files = JSON.parse(readFileSync(inputPath, 'utf8'));
	const result = analyse(files);
	const report = renderReport(result);

	for (const finding of result.findings) {
		console.log(`::warning::[parity] ${finding.title}`);
	}

	if (report) {
		writeFileSync(outPath, report, 'utf8');
	}

	if (process.env.GITHUB_OUTPUT) {
		writeFileSync(process.env.GITHUB_OUTPUT, `has_findings=${report ? 'true' : 'false'}\n`, {
			flag: 'a',
		});
	}

	console.log(
		report ? `${result.findings.length} parity note(s) written to ${outPath}` : 'No parity notes.',
	);
}

if (
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith('parity-check.mjs')
) {
	main();
}
