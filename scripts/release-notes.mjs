/**
 * Single source of truth for a package's "what's new in this release" notes.
 *
 * Usage: `node scripts/release-notes.mjs <key>` where <key> is a package key in
 * release-plan.json (core, react, vue, angular, vanilla, svelte, tools, cli).
 * Prints the release-body markdown to stdout.
 *
 * Both the GitHub release body and (in future) the friendly CHANGELOG.md draw
 * from here, so the two can never diverge. The primary source is git-cliff,
 * scoped to the package's include paths and tag pattern, rendering the
 * unreleased section for the pending tag. Because release-plan.mjs releases a
 * package whenever any of its files changed (not only on conventional commits),
 * git-cliff can legitimately produce a heading-only, bullet-free section; when
 * that happens we fall back to a raw commit list over the package's baseline so
 * the release notes are never empty (the historical bug: a bullet-free section
 * left the GitHub release showing only the pruned-history footer).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadPackage(key) {
	const plan = JSON.parse(readFileSync(join(ROOT, 'release-plan.json'), 'utf8'));
	const pkg = plan.packages[key];
	if (!pkg) {
		throw new Error(
			`Unknown package key "${key}" (expected one of ${Object.keys(plan.packages).join(', ')})`,
		);
	}
	return pkg;
}

/**
 * Render the git-cliff section for the pending tag, or '' if it fails.
 *
 * Runs `bun x git-cliff ...` via execFileSync with an argument array: `bun` is
 * a real executable on every platform, and passing args as an array means no
 * shell is involved, so no interpolated value can be shell-interpreted. This
 * mirrors the workflow's `bunx git-cliff` invocation without a shell string.
 */
function cliffSection(pkg) {
	const includeArgs = pkg.includePaths.flatMap((p) => ['--include-path', p]);
	const args = [
		'x',
		'git-cliff',
		'--config',
		'cliff.toml',
		'--tag-pattern',
		`^${pkg.npm}@`,
		...includeArgs,
		'--unreleased',
		'--tag',
		pkg.tag,
		'--strip',
		'all',
	];
	try {
		return execFileSync('bun', args, {
			cwd: ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '';
	}
}

/** True when the section carries at least one bullet (real, renderable notes). */
function hasBullets(section) {
	return /^\s*[-*]\s/mu.test(section);
}

/** Raw commit list over the package baseline, for the empty-section fallback. */
function commitFallback(pkg) {
	const dirs = pkg.includePaths.map((p) => p.replace(/\/\*\*$/u, ''));
	if (!pkg.baseline) {
		return '### Changes\n\n- Initial release.';
	}
	let log = '';
	try {
		log = execFileSync(
			'git',
			['log', '--no-merges', '--format=- %s (%h)', `${pkg.baseline}..HEAD`, '--', ...dirs],
			{ cwd: ROOT, encoding: 'utf8' },
		);
	} catch {
		log = '';
	}
	const lines = log
		.split('\n')
		.filter((l) => l.trim().length > 0)
		.filter((l) => !/chore\(release\)|\[skip ci\]/u.test(l));
	if (lines.length === 0) {
		return '### Changes\n\n- Maintenance and internal updates.';
	}
	return `### Changes\n\n${lines.join('\n')}`;
}

function main() {
	const key = process.argv[2];
	if (!key) {
		process.stderr.write('usage: node scripts/release-notes.mjs <key>\n');
		process.exit(2);
	}
	const pkg = loadPackage(key);
	const section = cliffSection(pkg);
	const notes = hasBullets(section) ? section : commitFallback(pkg);
	process.stdout.write(`${notes}\n`);
}

main();
