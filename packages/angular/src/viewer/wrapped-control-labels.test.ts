/**
 * No `<select>` may leave its naming to the `<label>` that wraps it.
 *
 * A control nested inside its label has no accessible name of its own, so a
 * label-text consumer reads the label element's WHOLE text content instead -
 * and once the options are nested in there too, that text is the caption plus
 * every option. The transition picker announced itself as "Transition None Cut
 * Fade ... Rotate ...", and a slide-show spec hunting for a rotate handle
 * matched it instead.
 *
 * Angular cannot render a component in this suite (no TestBed: see
 * `vitest.config.ts`), so the accessible NAME itself is asserted in
 * `e2e/connector-arrows.spec.ts` ('every control names itself instead of
 * borrowing its option list'), which drives the real Angular demo in a real
 * browser. What this test adds is breadth: it holds the whole binding to the
 * rule rather than the handful of controls a spec happens to click, which is
 * how the 21 Angular sites drifted in the first place.
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

/** `<label>…</label>` bodies in `source` (labels cannot nest). */
function labelBodies(source: string): string[] {
	const bodies: string[] = [];
	const open = /<label\b[^>]*>/giu;
	let match = open.exec(source);
	while (match !== null) {
		// `</label\n>` as well as `</label>`: a template formatter may break the
		// closing tag across lines, and a plain `indexOf('</label>')` then finds
		// nothing and silently reports the file as clean.
		const end = /<\/label\s*>/u.exec(source.slice(open.lastIndex));
		if (end) {
			bodies.push(source.slice(open.lastIndex, open.lastIndex + end.index));
		}
		match = open.exec(source);
	}
	return bodies;
}

describe('wrapped control labels', () => {
	it('names every <select> that is nested inside its <label>', () => {
		const offenders: string[] = [];

		for (const file of templateFiles(VIEWER_DIR)) {
			const source = readFileSync(file, 'utf8');
			for (const body of labelBodies(source)) {
				// An HTML comment may legitimately SPELL `<select>` while explaining
				// this very rule, so strip comments before looking for controls.
				const markup = body.replace(/<!--[\s\S]*?-->/gu, '');
				const selects = markup.match(/<select\b[^>]*>/giu) ?? [];
				for (const tag of selects) {
					if (!/aria-label/u.test(tag)) {
						offenders.push(`${path.basename(file)}: ${tag.slice(0, 60)}`);
					}
				}
			}
		}

		expect(offenders).toStrictEqual([]);
	});
});
