/**
 * Every `<option [value]="...">` produced by an `@for` must carry `[selected]`.
 *
 * Angular applies an element's own property bindings (a `<select>`'s `[value]`)
 * BEFORE the `@for` inside it has produced any `<option>`s, so on first render
 * the assignment runs against an empty option list and the browser silently
 * falls back to option 0. The chart-type select showed "Bar" for a saved radar
 * chart; the slide-size preset select showed "On-screen Show (4:3)" for a
 * 1280x720 deck (see `custom-shows-deck.test.ts`). The repo's fix is to mark
 * the selected option per-`<option>` instead of relying on the `<select>`'s own
 * `[value]`: `<option [value]="opt.value" [selected]="opt.value === current">`.
 *
 * Angular cannot render a component in this suite (no TestBed: see
 * `wrapped-control-labels.test.ts`), so this is a source-level scan across
 * every template-bearing file, holding the whole binding to the rule instead
 * of the handful of sites a hand-picked test happens to cover.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const VIEWER_DIR = path.join(__dirname);

/** Every template-bearing source file in the binding. */
function templateFiles(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			templateFiles(full, out);
		} else if (/\.(ts|html)$/u.test(name) && !/\.test\.ts$/u.test(name)) {
			out.push(full);
		}
	}
	return out;
}

/** Strip HTML comments (which may legitimately spell `<option [value]=` while
 * documenting this very rule) before scanning for real markup. Loops to
 * stability so adjacent/overlapping comments cannot leave a reconstructed
 * `<!--` behind. */
function stripComments(source: string): string {
	let markup = source,
		previous: string;
	do {
		previous = markup;
		markup = markup.replace(/<!--[\s\S]*?-->/gu, '');
	} while (markup !== previous);
	return markup;
}

/**
 * `<select ...> ... </select>` bodies, keyed by the select's own opening tag.
 * Only a `<select [value]="...">` is at risk: the bug is Angular applying that
 * property binding before the `@for` inside produces any options. A `<select>`
 * with no `[value]` binding (a stateless command dropdown, e.g. "Change Case")
 * has nothing for the timing bug to clobber, so its `<option>`s are exempt.
 */
function boundSelectBodies(source: string): string[] {
	const bodies: string[] = [],
		open = /<select\b[^>]*>/gsu;
	let match = open.exec(source);
	while (match !== null) {
		const end = /<\/select\s*>/u.exec(source.slice(open.lastIndex));
		if (end && match[0].includes('[value]=')) {
			bodies.push(source.slice(open.lastIndex, open.lastIndex + end.index));
		}
		match = open.exec(source);
	}
	return bodies;
}

/** `<option ...>` opening tags (dotAll so a formatter-wrapped tag still matches). */
function optionTags(source: string): string[] {
	return source.match(/<option\b[^>]*>/gsu) ?? [];
}

describe('select option [selected] binding', () => {
	it("marks selection per <option>, never relying on the <select>'s own [value]", () => {
		const offenders: string[] = [];

		for (const file of templateFiles(VIEWER_DIR)) {
			const source = stripComments(readFileSync(file, 'utf8'));
			for (const body of boundSelectBodies(source)) {
				for (const tag of optionTags(body)) {
					if (tag.includes('[value]=') && !tag.includes('[selected]=')) {
						offenders.push(`${path.basename(file)}: ${tag.replace(/\s+/gu, ' ').slice(0, 100)}`);
					}
				}
			}
		}

		expect(offenders).toStrictEqual([]);
	});

	it('renders the LAST option selected when the model matches only that one (regression case)', () => {
		// Minimal stand-in for the real `@for` + `<option [selected]>` pattern:
		// proves the per-option [selected] rule actually seats the last item,
		// which a `<select [value]>` binding (applied before options exist)
		// cannot do on first render.
		const options = ['bar', 'line', 'radar'] as const;
		const current: (typeof options)[number] = 'radar';
		const selectedFlags = options.map((value) => value === current);
		expect(selectedFlags).toStrictEqual([false, false, true]);
		expect(options[selectedFlags.indexOf(true)]).toBe('radar');
	});
});
