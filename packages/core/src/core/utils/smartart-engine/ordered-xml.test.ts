import { describe, expect, it } from 'vitest';

import { findOrderedDescendant, orderedChild, parseOrderedXml } from './ordered-xml';

describe('parseOrderedXml', () => {
	it('keeps differently-named siblings in document order and strips prefixes', () => {
		const doc = parseOrderedXml(
			'<dgm:layoutNode name="root"><dgm:alg type="lin"/><dgm:forEach axis="ch"/><dgm:layoutNode name="child"/></dgm:layoutNode>',
		);
		expect(doc?.name).toBe('layoutNode');
		expect(doc?.attrs.name).toBe('root');
		expect(doc?.children.map((child) => child.name)).toStrictEqual([
			'alg',
			'forEach',
			'layoutNode',
		]);
		expect(orderedChild(doc, 'alg')?.attrs.type).toBe('lin');
	});

	it('skips the prolog, comments, CDATA and DOCTYPE, and drops xmlns attributes', () => {
		const doc = parseOrderedXml(
			'<?xml version="1.0"?><!DOCTYPE x><!-- <fake a="1"/> --><r xmlns:dgm="urn:x" dgm:a="1"><![CDATA[<nope/>]]><c/></r>',
		);
		expect(doc?.name).toBe('r');
		expect(doc?.attrs).toStrictEqual({ a: '1' });
		expect(doc?.children.map((child) => child.name)).toStrictEqual(['c']);
	});

	it('reads single- and double-quoted values, a quoted ">", and entities', () => {
		const doc = parseOrderedXml(`<r a='x' b = "1 &gt; 0" c="&#x41;&#66;&amp;"/>`);
		expect(doc?.attrs).toStrictEqual({ a: 'x', b: '1 > 0', c: 'AB&' });
	});

	it('finds a nested descendant depth-first', () => {
		const doc = parseOrderedXml('<a><b><c id="1"/></b><c id="2"/></a>');
		expect(findOrderedDescendant(doc, 'c')?.attrs.id).toBe('1');
	});

	it('returns undefined when there is no element', () => {
		expect(parseOrderedXml('<!-- only a comment -->')).toBeUndefined();
		expect(parseOrderedXml('')).toBeUndefined();
	});

	it('stays linear on adversarial input (no regex backtracking)', () => {
		// Shapes that made the previous regex scanner backtrack polynomially:
		// a long run of name characters with no closing ">", and long runs of
		// whitespace around "=" with no value.
		const hostile = [
			`<a${'a'.repeat(200_000)}`,
			`<r ${'x'.repeat(100_000)}${' '.repeat(100_000)}=${' '.repeat(100_000)}/>`,
			`<r ${'a= '.repeat(60_000)}/>`,
		];
		const started = performance.now();
		for (const input of hostile) {
			parseOrderedXml(input);
		}
		expect(performance.now() - started).toBeLessThan(2_000);
	});
});
