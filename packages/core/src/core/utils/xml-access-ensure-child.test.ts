/**
 * `ensureXmlChild`: the write-side counterpart to `xmlChild`.
 *
 * fast-xml-parser materialises an element with no attributes, no children and
 * no text as the string `''`. `xmlChild`/`xmlPath` return `undefined` for such
 * a node, which is right for reads and wrong for writes - the caller needs the
 * container to exist in order to put something in it, and a write to a node
 * the walk never returned silently goes nowhere.
 *
 * This defect self-conceals: our own builder re-emits `''` as `<tag></tag>`,
 * so a round-trip test sees the element in and the element out and reports
 * success while the edit in between was dropped. That is why these assertions
 * check the PARENT after the call rather than round-tripping.
 *
 * @module utils/xml-access-ensure-child.test
 */
import { describe, expect, it } from 'vitest';

import { PptxRuntimeDependencyFactory } from '../core/factories/PptxRuntimeDependencyFactory';
import { ensureXmlChild, xmlChild } from './xml-access';

describe('ensureXmlChild', () => {
	it('returns an existing object child without touching it', () => {
		const parent = { 'p:spPr': { 'a:noFill': '', '@_x': '1' } };

		const child = ensureXmlChild(parent, 'p:spPr');

		expect(child).toBe(parent['p:spPr']);
		expect(child).toStrictEqual({ 'a:noFill': '', '@_x': '1' });
	});

	it('materialises a PRESENT but empty child, and writes land on the parent', () => {
		// This is the whole point: `xmlChild` says undefined here, so a writer
		// gated on it does nothing at all.
		const parent: Record<string, unknown> = { 'p:spPr': '' };
		expect(xmlChild(parent, 'p:spPr')).toBeUndefined();

		const child = ensureXmlChild(parent, 'p:spPr');
		expect(child).toStrictEqual({});

		child!['a:solidFill'] = { 'a:srgbClr': { '@_val': 'FF00FF' } };
		expect(parent['p:spPr']).toStrictEqual({
			'a:solidFill': { 'a:srgbClr': { '@_val': 'FF00FF' } },
		});
	});

	it('leaves an ABSENT child absent, so callers keep the schema decision', () => {
		// Creating the element here would put `<p:spPr/>` in places CT_* does not
		// allow it, so absence stays the caller's problem.
		const parent: Record<string, unknown> = {};

		expect(ensureXmlChild(parent, 'p:spPr')).toBeUndefined();
		expect(parent).not.toHaveProperty('p:spPr');
	});

	it('returns the first entry when the child repeats', () => {
		const parent = { 'a:p': [{ '@_i': '0' }, { '@_i': '1' }] };

		expect(ensureXmlChild(parent, 'a:p')).toStrictEqual({ '@_i': '0' });
	});

	it('heals every bare container the real parser produces', () => {
		// Parsed with the production parser rather than a hand-built object, so
		// this pins the actual representation rather than an assumption about it.
		const parsed = new PptxRuntimeDependencyFactory()
			.createParser()
			.parse('<p:sp><p:spPr/><p:nvSpPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp>') as Record<
			string,
			Record<string, unknown>
		>;
		const shape = parsed['p:sp'];
		expect(shape['p:spPr']).toBe('');

		for (const [parent, key] of [
			[shape, 'p:spPr'],
			[shape['p:nvSpPr'] as Record<string, unknown>, 'p:cNvSpPr'],
			[shape['p:nvSpPr'] as Record<string, unknown>, 'p:nvPr'],
		] as const) {
			expect(xmlChild(parent, key)).toBeUndefined();
			expect(ensureXmlChild(parent, key)).toStrictEqual({});
		}
	});

	it('is byte-neutral: a healed empty node serializes exactly as it arrived', () => {
		const factory = new PptxRuntimeDependencyFactory();
		const source = '<p:sp><p:spPr/></p:sp>';
		const parsed = factory.createParser().parse(source) as Record<string, Record<string, unknown>>;
		const untouched = factory.createBuilder().build(parsed);

		ensureXmlChild(parsed['p:sp'], 'p:spPr');

		expect(factory.createBuilder().build(parsed)).toBe(untouched);
	});
});
