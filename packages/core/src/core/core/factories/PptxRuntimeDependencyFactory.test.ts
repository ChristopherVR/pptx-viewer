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

describe('runtime dependency factory XML nesting depth', () => {
	/** A slide whose `p:spTree` wraps one decorated text shape in `groups` nested `p:grpSp`. */
	function nestedGroupSlide(groups: number): string {
		let body =
			'<p:sp><p:txBody><a:p><a:r><a:rPr><a:solidFill><a:srgbClr val="FF0000">' +
			'<a:alpha val="50000"/></a:srgbClr></a:solidFill></a:rPr><a:t>hi</a:t></a:r></a:p>' +
			'</p:txBody></p:sp>';
		for (let i = 0; i < groups; i++) {
			body = `<p:grpSp><p:grpSpPr/>${body}</p:grpSp>`;
		}
		return `<p:sld><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
	}

	it('never accepts on load a part it cannot write back on save', () => {
		// The defect: fast-xml-parser and fast-xml-builder both default
		// `maxNestedTags` to 100 but compare it differently (`> max` vs `>= max`),
		// and the builder measures the parsed OBJECT rather than the source XML.
		// At the shared default that made 89, 90 and 91 nested `p:grpSp` parse
		// cleanly and throw "Maximum nested tags exceeded" on save - a deck the
		// user can open and edit but can never keep. A refusal on load costs a
		// day; a refusal on save costs the work.
		const parser = factory.createParser();
		const builder = factory.createBuilder();

		const unsaveable: number[] = [];
		let deepestLoadable = 0;
		for (let groups = 1; groups <= 320; groups += 1) {
			let parsed: unknown;
			try {
				parsed = parser.parse(nestedGroupSlide(groups));
			} catch {
				continue; // Rejected on load, which is allowed: nothing was promised.
			}
			deepestLoadable = groups;
			try {
				builder.build(parsed);
			} catch {
				unsaveable.push(groups);
			}
		}

		expect(unsaveable).toStrictEqual([]);
		// Guard the sweep itself: if the parser started accepting everything (or
		// nothing) the loop above would pass vacuously.
		expect(deepestLoadable).toBeGreaterThan(100);
		expect(deepestLoadable).toBeLessThan(320);
	});

	it('accepts far deeper group nesting than any real deck reaches', () => {
		// Scanned across all 45 committed decks, the deepest nested-group chain is
		// 3 and the deepest element nesting of any kind is 25. `MAX_GROUP_DEPTH`,
		// the depth our own enrichment walkers descend, is 32.
		const parser = factory.createParser();
		expect(() => parser.parse(nestedGroupSlide(32))).not.toThrow();
		expect(() => parser.parse(nestedGroupSlide(100))).not.toThrow();
	});

	it('still refuses unbounded nesting', () => {
		// The cap is raised, not removed: a hostile part must not be able to drive
		// the parser's own recursive JSON conversion into a stack overflow.
		expect(() => factory.createParser().parse(nestedGroupSlide(5000))).toThrow(/nested/iu);
	});
});

describe('runtime dependency factory XML comments', () => {
	// Comments are dropped deliberately (`commentPropName` left `false`). Zero of
	// the 45 committed decks carry one in any part, and preserving them would not
	// be faithful anyway: fast-xml-parser stores a comment as a `#comment` key on
	// its parent, grouped by tag like every other key, so interleaved comments
	// all migrate ahead of their siblings on rebuild - the same collapse that has
	// already cost this repo four separate sibling-order annotators. This test
	// exists so that turning the option on is a deliberate act with a failing
	// test attached, not a one-word edit whose consequence surfaces in a deck.
	it('drops XML comments rather than relocating them', () => {
		const parser = factory.createParser();
		const source = '<p:spTree><!--A--><p:sp id="1"/><!--B--><p:sp id="2"/><!--C--></p:spTree>';
		const rebuilt = factory.createBuilder().build(parser.parse(source));

		expect(rebuilt).not.toContain('<!--');
		expect(rebuilt).toBe('<p:spTree><p:sp id="1"></p:sp><p:sp id="2"></p:sp></p:spTree>');
	});
});
