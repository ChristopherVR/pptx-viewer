import { describe, expect, it } from 'vitest';

import { PptxRuntimeDependencyFactory } from './PptxRuntimeDependencyFactory';

const factory = new PptxRuntimeDependencyFactory();

describe('runtime dependency factory XML builder', () => {
	it('keeps the value of an attribute whose text is literally "true"', () => {
		// fast-xml-parser defaults `suppressBooleanAttributes` to true, which
		// rewrites `val="true"` as the HTML-style valueless `val`. XML 1.0 has no
		// boolean attributes, so the result is not well-formed and PowerPoint
		// refuses the whole package. Reproduced on
		// e2e/fixtures/animation-builds-color.pptx, whose slide3 carries a single
		// `<p:strVal val="true"/>` inside an animation build.
		const xml = factory.createBuilder().build({
			'p:strVal': { '@_val': 'true' },
			'p:other': { '@_a': 'true', '@_b': 'x' },
		});
		expect(xml).toContain('val="true"');
		expect(xml).toContain('a="true"');
		expect(xml).not.toMatch(/\sval[\s/>]/u);
		expect(xml).not.toMatch(/\sa[\s/>]/u);
	});

	it('survives a parse -> build -> parse round-trip of a "true"-valued attribute', () => {
		const source =
			'<p:sld><p:strVal val="true"/><p:falseVal val="false"/><p:numVal val="1"/></p:sld>';
		const parser = factory.createParser();
		const builder = factory.createBuilder();
		const rebuilt = builder.build(parser.parse(source));
		expect(rebuilt).toContain('val="true"');

		// The parser leaves `allowBooleanAttributes` at its default `false`, so a
		// valueless attribute is silently DROPPED on read-back. Re-parsing the
		// mangled output therefore loses the attribute outright, which is what
		// made the defect invisible to load-side assertions.
		const reparsed = parser.parse(rebuilt) as Record<string, Record<string, unknown>>;
		expect(reparsed['p:sld']['p:strVal']).toStrictEqual({ '@_val': 'true' });
		expect(reparsed['p:sld']['p:falseVal']).toStrictEqual({ '@_val': 'false' });
		expect(reparsed['p:sld']['p:numVal']).toStrictEqual({ '@_val': '1' });
	});

	it('still emits an explicitly empty attribute value as ="" rather than dropping it', () => {
		const xml = factory.createBuilder().build({ 'p:cNvPr': { '@_id': '1', '@_name': '' } });
		expect(xml).toContain('name=""');
	});
});

describe('runtime dependency factory XML attribute entities', () => {
	const source =
		'<p:sld>' +
		'<p:cNvPr id="2" name="R&amp;D &quot;Team&quot;" descr="line one&#xA;line two"/>' +
		'<a:hlinkClick tgt="https://example.com/s?a=1&amp;b=2&amp;c=3"/>' +
		'<a:buChar char="&#x2022;"/>' +
		'</p:sld>';

	type Sld = Record<string, Record<string, Record<string, string>>>;

	it('decodes entities in attribute values into the model', () => {
		const parsed = factory.createParser().parse(source) as Sld;
		const shape = parsed['p:sld']['p:cNvPr'];
		expect(shape['@_name']).toBe('R&D "Team"');
		expect(shape['@_descr']).toBe('line one\nline two');
		expect(parsed['p:sld']['a:hlinkClick']['@_tgt']).toBe('https://example.com/s?a=1&b=2&c=3');
		expect(parsed['p:sld']['a:buChar']['@_char']).toBe('•');
	});

	it('re-encodes attribute values symmetrically, without compounding over five saves', () => {
		const parser = factory.createParser();
		const builder = factory.createBuilder();

		let xml = source;
		for (let i = 0; i < 5; i++) {
			xml = builder.build(parser.parse(xml));
			expect(xml).not.toContain('&amp;amp;');
			expect(xml).toContain('name="R&amp;D &quot;Team&quot;"');
			expect(xml).toContain('tgt="https://example.com/s?a=1&amp;b=2&amp;c=3"');
			// A raw newline inside an attribute is normalised to a space on the next
			// load, so alt-text line breaks only survive as `&#xA;`.
			expect(xml).toContain('descr="line one&#xA;line two"');
		}

		const model = parser.parse(xml) as Sld;
		expect(model['p:sld']['p:cNvPr']['@_name']).toBe('R&D "Team"');
		expect(model['p:sld']['p:cNvPr']['@_descr']).toBe('line one\nline two');
		expect(model['p:sld']['a:hlinkClick']['@_tgt']).toBe('https://example.com/s?a=1&b=2&c=3');
	});

	it('leaves element text encoding byte-for-byte as fast-xml-parser produced it', () => {
		const xml = factory.createBuilder().build({
			'a:t': `Tom & Jerry <b> it's "so"`,
		});
		expect(xml).toBe('<a:t>Tom &amp; Jerry &lt;b&gt; it&apos;s &quot;so&quot;</a:t>');
	});
});
