import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Drift guard for #342: dialogs and panels use `pptx-ui-select`,
 * `pptx-ui-checkbox` and `pptx-ui-radio`, not the OS-drawn `<select>` popup or
 * a bare `<input type="checkbox">` / `<input type="radio">`. The allow-list is
 * empty; a binding file that needs a native control must be
 * listed here with the technical reason, so the exception is visible in review.
 */
const PACKAGES = join(__dirname, '..', '..', '..');
const ROOTS = [
	...['react', 'vue', 'angular', 'svelte', 'vanilla'].map((name) => join(PACKAGES, name, 'src')),
	join(PACKAGES, 'shared', 'src', 'web-components'),
];
const SOURCE = /\.(tsx?|vue|svelte|html)$/u;
// Stylesheets only name the tags in selectors; `internal` is the generated shared copy.
const SKIP =
	/\.(test|spec|stories)\.|\.d\.ts$|[\\/]__tests__[\\/]|[\\/]internal[\\/]|[\\/]styles[\\/]|-(styles|css)\.ts$/u;

/** Relative path (forward slashes, from packages/) -> why the control stays native. */
const NATIVE_ALLOWED: Record<string, string> = {};

const NATIVE_SELECT = /<select[\s>]|createElement\(\s*['"]select['"]\s*\)/u;
const NATIVE_CHECKBOX = /type\s*=\s*['"]checkbox['"]|\.type\s*=\s*['"]checkbox['"]/u;

const NATIVE_RADIO = /type\s*=\s*['"]radio['"]|\.type\s*=\s*['"]radio['"]/u;
function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') {
			continue;
		}
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			walk(path, out);
		} else if (SOURCE.test(entry) && !SKIP.test(path)) {
			out.push(path);
		}
	}
	return out;
}

/** Drop comment-only lines so prose that mentions `<select>` does not trip the scan. */
function code(file: string): string {
	return readFileSync(file, 'utf8')
		.split('\n')
		.filter((line) => !/^\s*(\/\/|\/\*|\*|<!--)/u.test(line))
		.join('\n');
}

describe('native select, checkbox and radio drift (#342)', () => {
	const files = ROOTS.flatMap((root) => walk(root));
	const rel = (file: string): string => relative(PACKAGES, file).split(sep).join('/');

	it('finds the binding sources it scans', () => {
		expect(files.length).toBeGreaterThan(400);
	});

	it('no binding source renders a native <select>', () => {
		const offenders = files
			.filter((file) => NATIVE_SELECT.test(code(file)))
			.map(rel)
			.filter((path) => !(path in NATIVE_ALLOWED));
		expect(offenders).toStrictEqual([]);
	});

	it('no binding source renders a native checkbox input', () => {
		const offenders = files
			.filter((file) => NATIVE_CHECKBOX.test(code(file)))
			.map(rel)
			.filter((path) => !(path in NATIVE_ALLOWED));
		expect(offenders).toStrictEqual([]);
	});

	it('no binding source renders a native radio input', () => {
		const offenders = files
			.filter((file) => NATIVE_RADIO.test(code(file)))
			.map(rel)
			.filter((path) => !(path in NATIVE_ALLOWED));
		expect(offenders).toStrictEqual([]);
	});

	it('every allowed exception still needs its exemption', () => {
		for (const path of Object.keys(NATIVE_ALLOWED)) {
			const file = join(PACKAGES, path);
			const text = code(file);
			expect([
				path,
				NATIVE_SELECT.test(text) || NATIVE_CHECKBOX.test(text) || NATIVE_RADIO.test(text),
			]).toStrictEqual([path, true]);
			expect(NATIVE_ALLOWED[path].length).toBeGreaterThan(20);
		}
	});
});
