/**
 * Tests for {@link PptxGraphicFrameParser.parseGraphicFrameType}.
 *
 * Phase 3 Stream A (CH-H3): the parser must recognise ink graphicFrames
 * (Office 2010+ `aink` namespace) so loaded ink elements survive the
 * `unknown`-type fallback and round-trip via `rawXml`.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxGraphicFrameParser } from './PptxGraphicFrameParser';

function makeParser() {
	return new PptxGraphicFrameParser({
		emuPerPx: 9525,
		getOrderedSlidePaths: () => [],
		slideRelsMap: new Map(),
		externalRelsMap: new Map(),
		readFlipState: () => ({}),
		parseTableData: () => undefined,
		parseMediaData: () => ({}),
		parseElementActions: () => ({}),
		inspectGraphicFrameCompatibility: () => {},
	});
}

describe('pptxGraphicFrameParser.parseGraphicFrameType', () => {
	it('detects table graphic frames by `a:tbl` child', () => {
		const parser = makeParser();
		expect(parser.parseGraphicFrameType({ 'a:tbl': {} } as XmlObject)).toBe('table');
	});

	it('detects chart graphic frames by `c:chart` child', () => {
		const parser = makeParser();
		expect(parser.parseGraphicFrameType({ 'c:chart': {} } as XmlObject)).toBe('chart');
	});

	it('detects OLE graphic frames by URI', () => {
		const parser = makeParser();
		const data: XmlObject = {
			'@_uri': 'http://schemas.openxmlformats.org/presentationml/2006/ole',
			'p:oleObj': { '@_progId': 'Excel.Sheet.12' },
		};
		expect(parser.parseGraphicFrameType(data)).toBe('ole');
	});

	it('returns "unknown" when graphicData is missing', () => {
		const parser = makeParser();
		expect(parser.parseGraphicFrameType(undefined)).toBe('unknown');
	});

	// CH-H3: ink graphicFrame URI detection.
	it('detects ink graphic frames by the 2010 ink URI', () => {
		const parser = makeParser();
		const data: XmlObject = {
			'@_uri': 'http://schemas.microsoft.com/office/drawing/2010/ink',
		};
		expect(parser.parseGraphicFrameType(data)).toBe('ink');
	});

	it('detects ink graphic frames by direct `aink:ink` child', () => {
		const parser = makeParser();
		const data: XmlObject = {
			'@_uri': '',
			'aink:ink': { 'aink:trace': '0,0 100,100' },
		};
		expect(parser.parseGraphicFrameType(data)).toBe('ink');
	});

	it('detects ink graphic frames wrapped in `mc:AlternateContent` with `Requires="aink"`', () => {
		const parser = makeParser();
		const data: XmlObject = {
			'mc:AlternateContent': {
				'mc:Choice': {
					'@_Requires': 'aink',
					'aink:ink': {},
				},
				'mc:Fallback': {},
			},
		};
		expect(parser.parseGraphicFrameType(data)).toBe('ink');
	});

	it('does not treat unrelated AlternateContent envelopes as ink', () => {
		const parser = makeParser();
		const data: XmlObject = {
			'mc:AlternateContent': {
				'mc:Choice': {
					'@_Requires': 'p14',
					'p14:something': {},
				},
				'mc:Fallback': {},
			},
		};
		expect(parser.parseGraphicFrameType(data)).toBe('unknown');
	});

	it('parses a full ink graphicFrame and preserves rawXml', () => {
		const parser = makeParser();
		const frame: XmlObject = {
			'p:nvGraphicFramePr': {
				'p:cNvPr': { '@_id': '5', '@_name': 'Ink 1' },
				'p:cNvGraphicFramePr': {},
				'p:nvPr': {},
			},
			'p:xfrm': {
				'a:off': { '@_x': '914400', '@_y': '914400' },
				'a:ext': { '@_cx': '1828800', '@_cy': '914400' },
			},
			'a:graphic': {
				'a:graphicData': {
					'@_uri': 'http://schemas.microsoft.com/office/drawing/2010/ink',
					'mc:AlternateContent': {
						'mc:Choice': {
							'@_Requires': 'aink',
							'aink:ink': {},
						},
					},
				},
			},
		};
		const result = parser.parseGraphicFrame(frame, 'ink-1', 'ppt/slides/slide1.xml');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('ink');
		expect(result!.rawXml).toBe(frame);
	});
});
