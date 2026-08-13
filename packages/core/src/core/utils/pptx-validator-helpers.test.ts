/**
 * The validator must read a package the way the LOADER reads it.
 *
 * `pptx-validator-helpers.createParser()` builds a second, independent
 * `XMLParser` for validation and repair. It used to take fast-xml-parser's
 * defaults while `PptxRuntimeDependencyFactory.createParser()` runs a
 * deliberately hardened configuration, and the two then disagreed about what
 * the same bytes said. A validator that disagrees with the loader reports on a
 * package nobody will ever open: it flags parts that resolve fine, and
 * `repairPptx` then "fixes" relationships that were never broken.
 *
 * Both divergences below were reproduced against the real loader parser before
 * the configurations were aligned.
 *
 * @module utils/pptx-validator-helpers.test
 */
import { describe, expect, it } from 'vitest';

import { PptxRuntimeDependencyFactory } from '../core/factories/PptxRuntimeDependencyFactory';
import { createParser, extractRelationships, tryParseXml } from './pptx-validator-helpers';

const loaderParser = () => new PptxRuntimeDependencyFactory().createParser();

describe('validator parser agrees with the loader parser', () => {
	it('resolves a relationship target to the same string the loader resolves', () => {
		// `&#x5F;` is an underscore. fast-xml-parser decodes `&amp;` by default
		// but leaves numeric character references alone, so the validator saw
		// `Q&A&#x5F;chart.png` where the loader saw `Q&A_chart.png` and reported a
		// missing media part for a deck that opens correctly.
		const rels =
			'<?xml version="1.0"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			'<Relationship Id="rId1" Type="http://x/image" Target="../media/Q&amp;A&#x5F;chart.png"/>' +
			'</Relationships>';

		const parsed = tryParseXml(rels, createParser());
		expect(parsed).not.toHaveProperty('error');
		const validatorTarget = extractRelationships(
			(parsed as { data: Record<string, unknown> }).data,
		)[0].target;

		const loaded = loaderParser().parse(rels) as {
			Relationships: { Relationship: Record<string, string> };
		};
		const loaderTarget = loaded.Relationships.Relationship['@_Target'];

		expect(validatorTarget).toBe('../media/Q&A_chart.png');
		expect(validatorTarget).toBe(loaderTarget);
	});

	it('parses a part carrying a DTD instead of calling it malformed', () => {
		// With `processEntities` at its default `true`, fast-xml-parser enforces a
		// 10,000-character cap on an internal entity and THROWS past it. The
		// loader (entity processing off) reads the same part without complaint, so
		// `validatePptx` reported an XML error on a package that opens.
		const dtd = `<!DOCTYPE Relationships [<!ENTITY pad "${'x'.repeat(20000)}">]>`;
		const xml =
			`<?xml version="1.0"?>${dtd}` +
			'<Relationships><Relationship Id="rId1" Type="t" Target="a.xml"/></Relationships>';

		const parsed = tryParseXml(xml, createParser());

		expect(parsed).not.toHaveProperty('error');
		expect(extractRelationships((parsed as { data: Record<string, unknown> }).data)).toStrictEqual([
			{ id: 'rId1', type: 't', target: 'a.xml' },
		]);
	});

	it('keeps element text as an untyped string, like the loader', () => {
		// `parseTagValue` defaults to true and coerces `16.0000` to the number 16,
		// which is the exact coercion that used to corrupt `AppVersion` on save.
		const xml = '<Properties><AppVersion>16.0000</AppVersion></Properties>';

		const parsed = tryParseXml(xml, createParser()) as {
			data: { Properties: { AppVersion: unknown } };
		};

		expect(parsed.data.Properties.AppVersion).toBe('16.0000');
	});
});
