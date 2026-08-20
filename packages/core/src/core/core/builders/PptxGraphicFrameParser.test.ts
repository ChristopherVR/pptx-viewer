/**
 * Tests for {@link PptxGraphicFrameParser.parseGraphicFrameType}.
 *
 * Phase 3 Stream A (CH-H3): the parser must recognise ink graphicFrames
 * (Office 2010+ `aink` namespace) so loaded ink elements survive the
 * `unknown`-type fallback and round-trip via `rawXml`.
 */
import { describe, it, expect } from 'vitest';

import type { OlePptxElement, TablePptxElement, XmlObject } from '../../types';
import { PptxGraphicFrameParser } from './PptxGraphicFrameParser';
import type { PptxGraphicFrameParserContext } from './PptxGraphicFrameParser';

function makeParser(overrides: Partial<PptxGraphicFrameParserContext> = {}) {
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
		...overrides,
	});
}

function makeOleFrame(oleObj: XmlObject): XmlObject {
	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '7', '@_name': 'Object 1' },
			'p:cNvGraphicFramePr': {},
			'p:nvPr': {},
		},
		'p:xfrm': {
			'a:off': { '@_x': '0', '@_y': '0' },
			'a:ext': { '@_cx': '2286000', '@_cy': '1714500' },
		},
		'a:graphic': {
			'a:graphicData': {
				'@_uri': 'http://schemas.openxmlformats.org/presentationml/2006/ole',
				'p:oleObj': oleObj,
			},
		},
	};
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

	it('treats a p:oleObj with a <p:embed> child as embedded (isLinked=false)', () => {
		const slidePath = 'ppt/slides/slide1.xml';
		const slideRelsMap = new Map<string, Map<string, string>>([
			[slidePath, new Map([['rId2', '../embeddings/oleObject1.xlsx']])],
		]);
		const parser = makeParser({ slideRelsMap });
		const frame = makeOleFrame({
			'@_progId': 'Excel.Sheet.12',
			'@_showAsIcon': '0',
			'@_imgW': '2286000',
			'@_imgH': '1714500',
			'@_r:id': 'rId2',
			'p:embed': {},
		});
		const result = parser.parseGraphicFrame(frame, 'ole-1', slidePath) as OlePptxElement | null;
		expect(result).not.toBeNull();
		expect(result!.type).toBe('ole');
		expect(result!.isLinked).toBeFalsy();
		expect(result!.externalPath).toBeUndefined();
		expect(result!.oleTarget).toBe('../embeddings/oleObject1.xlsx');
	});

	it('treats a p:oleObj with a <p:link> child + External rel as linked (isLinked=true)', () => {
		const slidePath = 'ppt/slides/slide1.xml';
		const slideRelsMap = new Map<string, Map<string, string>>([
			[slidePath, new Map([['rId4', 'file:///C:/data/budget.xlsx']])],
		]);
		const externalRelsMap = new Map<string, Set<string>>([[slidePath, new Set(['rId4'])]]);
		const parser = makeParser({ slideRelsMap, externalRelsMap });
		const frame = makeOleFrame({
			'@_progId': 'Excel.Sheet.12',
			'@_showAsIcon': '1',
			'p:link': { '@_r:id': 'rId4', '@_updateAutomatic': '1' },
		});
		const result = parser.parseGraphicFrame(frame, 'ole-2', slidePath) as OlePptxElement | null;
		expect(result).not.toBeNull();
		expect(result!.isLinked).toBeTruthy();
		expect(result!.externalPath).toBe('file:///C:/data/budget.xlsx');
		expect(result!.oleShowAsIcon).toBeTruthy();
	});

	it('captures showAsIcon, imgW, and imgH typed fields from p:oleObj attributes', () => {
		const slidePath = 'ppt/slides/slide1.xml';
		const slideRelsMap = new Map<string, Map<string, string>>([
			[slidePath, new Map([['rId2', '../embeddings/oleObject1.xlsx']])],
		]);
		const parser = makeParser({ slideRelsMap });
		const frame = makeOleFrame({
			'@_progId': 'Excel.Sheet.12',
			'@_showAsIcon': '1',
			'@_imgW': '3048000',
			'@_imgH': '2286000',
			'@_r:id': 'rId2',
			'p:embed': {},
		});
		const result = parser.parseGraphicFrame(frame, 'ole-3', slidePath) as OlePptxElement | null;
		expect(result).not.toBeNull();
		expect(result!.oleShowAsIcon).toBeTruthy();
		expect(result!.oleImgW).toBe(3048000);
		expect(result!.oleImgH).toBe(2286000);
	});

	it('does not falsely report embed-only OLE objects as linked when no @_link attr is present', () => {
		const slidePath = 'ppt/slides/slide1.xml';
		const slideRelsMap = new Map<string, Map<string, string>>([
			[slidePath, new Map([['rId2', '../embeddings/oleObject1.xlsx']])],
		]);
		const parser = makeParser({ slideRelsMap });
		const frame = makeOleFrame({
			'@_progId': 'Excel.Sheet.12',
			'@_r:id': 'rId2',
			'p:embed': {},
		});
		const result = parser.parseGraphicFrame(frame, 'ole-4', slidePath) as OlePptxElement | null;
		// Pre-fix bug: `isLinked` was always true because `@_link !== null` is
		// trivially true for absent attributes (which are `undefined`).
		expect(result!.isLinked).toBeFalsy();
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

describe('pptxGraphicFrameParser table dimensions', () => {
	it('uses table grid and row extents when the graphic frame extent is stale', () => {
		const parser = makeParser({ parseTableData: () => ({ rows: [], columnWidths: [] }) });
		const frame: XmlObject = {
			'p:xfrm': {
				'a:off': { '@_x': '720000', '@_y': '1164325' },
				'a:ext': { '@_cx': '3000000', '@_cy': '3000000' },
			},
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblGrid': {
							'a:gridCol': [{ '@_w': '1587775' }, { '@_w': '2380350' }],
						},
						'a:tr': [{ '@_h': '451725' }, { '@_h': '729375' }],
					},
				},
			},
		};

		const result = parser.parseGraphicFrame(frame, 'table-1') as TablePptxElement;
		expect(result.width).toBe(Math.round((1587775 + 2380350) / 9525));
		expect(result.height).toBe(Math.round((451725 + 729375) / 9525));
	});

	it('keeps the frame extent when table grid dimensions are unavailable', () => {
		const parser = makeParser({ parseTableData: () => ({ rows: [], columnWidths: [] }) });
		const frame: XmlObject = {
			'p:xfrm': {
				'a:off': { '@_x': '0', '@_y': '0' },
				'a:ext': { '@_cx': '2286000', '@_cy': '1714500' },
			},
			'a:graphic': { 'a:graphicData': { 'a:tbl': {} } },
		};

		const result = parser.parseGraphicFrame(frame, 'table-2') as TablePptxElement;
		expect(result.width).toBe(240);
		expect(result.height).toBe(180);
	});
});
