/**
 * Guard: no source file may contain a raw NUL byte.
 *
 * ripgrep decides a file is BINARY when it finds a NUL in the first block it
 * reads, and a binary file is silently skipped by a default search - no match,
 * no warning, no non-zero exit. Four files in this repo had crossed that line
 * by writing `'\0'` as a literal byte inside a string literal (a NUL separator
 * for join/split keys, which is a perfectly good sentinel). The semantics were
 * fine; the ENCODING made the files invisible to every `grep`-based audit,
 * including the ones that decide whether a fix reached all five bindings.
 *
 * The fix is to spell the character as a unicode escape (backslash, `u`, four
 * zeroes), which is the same string at runtime and plain ASCII on disk. This
 * check keeps it that way - including in this file, which is why the escape is
 * described in words here rather than written out.
 *
 * Run: `node scripts/check-searchable-sources.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Directories that are build output, dependencies or caches, not sources. */
const SKIPPED_DIRECTORIES = new Set([
	'node_modules',
	'dist',
	'.git',
	'.vite',
	'.angular',
	'.turbo',
	'cache',
	'coverage',
	'test-results',
	'playwright-report',
	'shared-src',
]);

/** Text formats a developer greps. Binary assets are excluded by extension. */
const SEARCHABLE_EXTENSIONS = new Set([
	'.ts',
	'.tsx',
	'.mts',
	'.cts',
	'.js',
	'.jsx',
	'.mjs',
	'.cjs',
	'.vue',
	'.svelte',
	'.css',
	'.html',
	'.json',
	'.md',
	'.yml',
	'.yaml',
]);

/** Top-level directories worth walking. */
const SEARCHED_ROOTS = ['packages', 'demos', 'e2e', 'scripts', 'docs'];

function* walk(directory) {
	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (SKIPPED_DIRECTORIES.has(entry.name)) {
			continue;
		}
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			yield* walk(path);
		} else if (entry.isFile() && SEARCHABLE_EXTENSIONS.has(extname(entry.name))) {
			yield path;
		}
	}
}

/**
 * @param {string} root repository root to scan
 * @returns {{ file: string, line: number }[]} one entry per NUL byte found
 */
export function findUnsearchableSources(root = ROOT) {
	const offences = [];
	for (const searchedRoot of SEARCHED_ROOTS) {
		const directory = resolve(root, searchedRoot);
		try {
			if (!statSync(directory).isDirectory()) {
				continue;
			}
		} catch {
			continue;
		}
		for (const path of walk(directory)) {
			const bytes = readFileSync(path);
			let index = bytes.indexOf(0);
			while (index >= 0) {
				offences.push({
					file: relative(root, path).replaceAll('\\', '/'),
					line: bytes.subarray(0, index).toString('utf8').split('\n').length,
				});
				index = bytes.indexOf(0, index + 1);
			}
		}
	}
	return offences;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	const offences = findUnsearchableSources();
	if (offences.length > 0) {
		for (const offence of offences) {
			console.error(
				`${offence.file}:${offence.line}  raw NUL byte - ripgrep will treat this file as binary and skip it. Write the escape \\u0000 instead.`,
			);
		}
		process.exit(1);
	}
	console.log('No unsearchable source files.');
}
