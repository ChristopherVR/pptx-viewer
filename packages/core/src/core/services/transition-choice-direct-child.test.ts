/**
 * p14/p15 transitions written as DIRECT children of `p:transition`
 * (issue #132).
 *
 * PowerPoint writes modern transitions in a slide-root
 * `mc:AlternateContent` envelope. Inside the `mc:Choice Requires="p14"` /
 * `Requires="p15"` branch the requirement is already declared by the
 * envelope, so the extension element (`<p14:reveal/>`,
 * `<p15:prstTrans/>`) sits DIRECTLY on `p:transition` instead of going
 * through the `p:extLst` escape hatch. The parsers only read the extLst
 * form, so these decks silently played the `mc:Fallback` fade.
 */
import { XMLParser } from 'fast-xml-parser';
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseP14DirectChild } from './p14-transition-parser';
import { parseP15DirectChild } from './p15-transition-parser';
import { PptxSlideTransitionService } from './PptxSlideTransitionService';
import { PptxXmlLookupService } from './PptxXmlLookupService';
import { resolveSlideTimingNode } from './slide-transition-envelope';

function getXmlLocalName(xmlKey: string): string {
	if (!xmlKey) {
		return '';
	}
	const withoutAttr = xmlKey.startsWith('@_') ? xmlKey.slice(2) : xmlKey;
	const idx = withoutAttr.lastIndexOf(':');
	return idx < 0 ? withoutAttr : withoutAttr.slice(idx + 1);
}

function createService(): PptxSlideTransitionService {
	return new PptxSlideTransitionService({
		xmlLookupService: new PptxXmlLookupService(),
		getXmlLocalName,
	});
}

// Mirrors the runtime's fast-xml-parser configuration
// (PptxRuntimeDependencyFactory) so the parsed shape matches production.
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	trimValues: true,
});

/** The exact envelope form from the issue-132 deck (p15 Origami). */
const ORIGAMI_SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main">
	<mc:AlternateContent>
		<mc:Choice Requires="p15">
			<p:transition spd="slow" p14:dur="3250" advTm="3000">
				<p15:prstTrans prst="origami"/>
			</p:transition>
		</mc:Choice>
		<mc:Fallback>
			<p:transition spd="slow" advTm="3000">
				<p:fade/>
			</p:transition>
		</mc:Fallback>
	</mc:AlternateContent>
</p:sld>`;

/**
 * The p14 form: `p14:reveal` as a direct child. Note the stray
 * `Requires="p14"` attribute PowerPoint leaves on `p:transition` itself;
 * parsing must tolerate it.
 */
const REVEAL_SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">
	<mc:AlternateContent>
		<mc:Choice Requires="p14">
			<p:transition spd="slow" p14:dur="2000" Requires="p14">
				<p14:reveal dir="r"/>
			</p:transition>
		</mc:Choice>
		<mc:Fallback>
			<p:transition spd="slow">
				<p:fade/>
			</p:transition>
		</mc:Fallback>
	</mc:AlternateContent>
</p:sld>`;

describe('parseP14DirectChild', () => {
	it('parses p14:reveal dir="r" as a direct child, tolerating a stray Requires attribute', () => {
		const result = parseP14DirectChild(
			{
				'@_spd': 'slow',
				'@_p14:dur': '2000',
				'@_Requires': 'p14',
				'p14:reveal': { '@_dir': 'r' },
			},
			getXmlLocalName,
		);
		expect(result?.type).toBe('reveal');
		expect(result?.direction).toBe('r');
	});

	it('parses p14:ripple as a direct child', () => {
		expect(parseP14DirectChild({ 'p14:ripple': {} }, getXmlLocalName)?.type).toBe('ripple');
	});

	it('returns undefined when there is no p14 direct child', () => {
		expect(parseP14DirectChild({ 'p:fade': {} }, getXmlLocalName)).toBeUndefined();
	});
});

describe('parseP15DirectChild', () => {
	it('parses p15:prstTrans prst="origami" as a direct child', () => {
		const result = parseP15DirectChild(
			{ '@_spd': 'slow', 'p15:prstTrans': { '@_prst': 'origami' } },
			getXmlLocalName,
		);
		expect(result?.type).toBe('origami');
	});

	it('ignores a prstTrans with an unknown preset name', () => {
		expect(
			parseP15DirectChild({ 'p15:prstTrans': { '@_prst': 'teleport' } }, getXmlLocalName),
		).toBeUndefined();
	});
});

describe('issue-132 envelope integration', () => {
	const service = createService();

	it('parses the p15 Origami envelope as origami, not the fallback fade', () => {
		const slideXml = xmlParser.parse(ORIGAMI_SLIDE_XML) as XmlObject;
		const result = service.parseSlideTransition(slideXml);

		expect(result?.type).toBe('origami');
		expect(result?.speed).toBe('slow');
		expect(result?.durationMs).toBe(3250);
		expect(result?.advanceAfterMs).toBe(3000);
	});

	it('parses the p14 Reveal envelope as reveal with its direction', () => {
		const slideXml = xmlParser.parse(REVEAL_SLIDE_XML) as XmlObject;
		const result = service.parseSlideTransition(slideXml);

		expect(result?.type).toBe('reveal');
		expect(result?.direction).toBe('r');
		expect(result?.durationMs).toBe(2000);
	});

	it('uses the fallback when the choice requires an unsupported namespace', () => {
		const slideXml = xmlParser.parse(
			ORIGAMI_SLIDE_XML.replace('Requires="p15"', 'Requires="p20"').replace(
				'p15:prstTrans',
				'p20:prstTrans',
			),
		) as XmlObject;
		const result = service.parseSlideTransition(slideXml);

		expect(result?.type).toBe('fade');
	});

	it('finds the transition and the timing across TWO sibling envelopes', () => {
		// Deck slides 5/22 carry two slide-root mc:AlternateContent siblings:
		// one wrapping p:transition, one wrapping p:timing. The parser surfaces
		// them as an array; both payloads must resolve.
		const twoEnvelopeXml = ORIGAMI_SLIDE_XML.replace(
			'</mc:AlternateContent>',
			`</mc:AlternateContent>
	<mc:AlternateContent>
		<mc:Choice Requires="p14">
			<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" nodeType="tmRoot"/></p:par></p:tnLst></p:timing>
		</mc:Choice>
		<mc:Fallback>
			<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" nodeType="tmRoot"/></p:par></p:tnLst></p:timing>
		</mc:Fallback>
	</mc:AlternateContent>`,
		);
		const slideXml = xmlParser.parse(twoEnvelopeXml) as XmlObject;

		expect(service.parseSlideTransition(slideXml)?.type).toBe('origami');
		const timing = resolveSlideTimingNode(slideXml['p:sld'] as XmlObject | undefined);
		expect(timing).toBeDefined();
		expect((timing as XmlObject)['p:tnLst']).toBeDefined();
	});
});

describe('round-trip of the direct-child forms (no double emission)', () => {
	const service = createService();

	it('re-serialises the preserved p15:prstTrans child without fabricating an extLst copy', () => {
		const parsed = service.parseSlideTransition(xmlParser.parse(ORIGAMI_SLIDE_XML) as XmlObject);
		const node = service.buildSlideTransitionXml(parsed!);

		expect((node?.['p15:prstTrans'] as XmlObject | undefined)?.['@_prst']).toBe('origami');
		expect(node?.['p:extLst']).toBeUndefined();
		expect(node?.['p:cut']).toBeUndefined();
	});

	it('re-serialises the preserved p14:reveal child without fabricating an extLst copy', () => {
		const parsed = service.parseSlideTransition(xmlParser.parse(REVEAL_SLIDE_XML) as XmlObject);
		const node = service.buildSlideTransitionXml(parsed!);

		expect((node?.['p14:reveal'] as XmlObject | undefined)?.['@_dir']).toBe('r');
		expect(node?.['p:extLst']).toBeUndefined();
		expect(node?.['p:cut']).toBeUndefined();
	});

	it('writes the direct-child form when there is no preserved one', () => {
		const node = service.buildSlideTransitionXml({ type: 'origami' });

		expect((node?.['p15:prstTrans'] as XmlObject | undefined)?.['@_prst']).toBe('origami');
		expect(node?.['p:extLst']).toBeUndefined();
	});

	it('prunes a stale direct child when the transition type was edited', () => {
		const parsed = service.parseSlideTransition(xmlParser.parse(ORIGAMI_SLIDE_XML) as XmlObject);
		const node = service.buildSlideTransitionXml({ ...parsed!, type: 'fade' });

		expect(node?.['p:fade']).toBeDefined();
		expect(node?.['p15:prstTrans']).toBeUndefined();
	});

	it('re-points the direct child on a p15-to-p15 edit, emitting exactly one', () => {
		const parsed = service.parseSlideTransition(xmlParser.parse(ORIGAMI_SLIDE_XML) as XmlObject);
		const node = service.buildSlideTransitionXml({ ...parsed!, type: 'fracture' });

		expect((node?.['p15:prstTrans'] as XmlObject | undefined)?.['@_prst']).toBe('fracture');
		expect(node?.['p:extLst']).toBeUndefined();
		expect(JSON.stringify(node)).not.toContain('origami');
	});
});
