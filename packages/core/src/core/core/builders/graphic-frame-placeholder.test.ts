/**
 * `p:nvGraphicFramePr/p:nvPr/p:ph` on a table / chart / SmartArt / OLE /
 * media frame was dropped by the frame parser, so those elements never
 * carried `placeholderType` and a frame with no transform of its own had
 * nothing to inherit position and size from.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import {
	hasUsableTransform,
	readGraphicFramePlaceholder,
	readInheritedTransform,
} from './graphic-frame-placeholder';
import { PptxGraphicFrameParser } from './PptxGraphicFrameParser';
import type { PptxGraphicFrameParserContext } from './PptxGraphicFrameParser';

const SLIDE = 'ppt/slides/slide1.xml';

function makeParser(overrides: Partial<PptxGraphicFrameParserContext> = {}) {
	return new PptxGraphicFrameParser({
		emuPerPx: 9525,
		getOrderedSlidePaths: () => [SLIDE],
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

function tableFrame(ph: unknown, xfrm?: XmlObject): XmlObject {
	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '5', '@_name': 'Content Placeholder 4' },
			'p:cNvGraphicFramePr': { 'a:graphicFrameLocks': { '@_noGrp': '1' } },
			'p:nvPr': ph === undefined ? '' : { 'p:ph': ph },
		},
		...(xfrm ? { 'p:xfrm': xfrm } : {}),
		'a:graphic': {
			'a:graphicData': {
				'@_uri': 'http://schemas.openxmlformats.org/drawingml/2006/table',
				'a:tbl': {},
			},
		},
	};
}

describe('readGraphicFramePlaceholder', () => {
	it('returns undefined for a frame that is not a placeholder', () => {
		expect(readGraphicFramePlaceholder(tableFrame(undefined))).toBeUndefined();
		expect(readGraphicFramePlaceholder(undefined)).toBeUndefined();
	});

	it('treats a bare <p:ph/> as a placeholder with no attributes', () => {
		expect(readGraphicFramePlaceholder(tableFrame(''))).toStrictEqual({});
	});

	it('normalises idx, type, sz and orient', () => {
		expect(
			readGraphicFramePlaceholder(
				tableFrame({ '@_idx': 14, '@_type': 'Tbl', '@_sz': 'Half', '@_orient': 'vert' }),
			),
		).toStrictEqual({ idx: '14', type: 'tbl', sz: 'half', orient: 'vert' });
	});
});

describe('hasUsableTransform / readInheritedTransform', () => {
	const usable = { 'a:off': { '@_x': '1', '@_y': '2' }, 'a:ext': { '@_cx': '3', '@_cy': '4' } };

	it('requires an offset and a sized extent', () => {
		expect(hasUsableTransform(undefined)).toBeFalsy();
		expect(hasUsableTransform({})).toBeFalsy();
		expect(hasUsableTransform({ 'a:off': { '@_x': '0', '@_y': '0' } })).toBeFalsy();
		expect(hasUsableTransform(usable)).toBeTruthy();
	});

	it('accepts both the p:sp and the p:graphicFrame spelling of the counterpart', () => {
		expect(readInheritedTransform({ 'p:spPr': { 'a:xfrm': usable } })).toBe(usable);
		expect(readInheritedTransform({ 'p:xfrm': usable })).toBe(usable);
		expect(readInheritedTransform({ 'p:spPr': {} })).toBeUndefined();
	});
});

describe('parseGraphicFrame on placeholder frames', () => {
	it('surfaces the placeholder on the element and keeps p:ph in rawXml', () => {
		const frame = tableFrame(
			{ '@_idx': '14', '@_type': 'tbl' },
			{
				'a:off': { '@_x': '952500', '@_y': '1905000' },
				'a:ext': { '@_cx': '9525000', '@_cy': '4762500' },
			},
		);
		const element = makeParser().parseGraphicFrame(frame, 'tbl-1', SLIDE)!;
		expect(element.type).toBe('table');
		expect(element.placeholderType).toBe('tbl');
		expect(element.x).toBe(100);
		expect(element.width).toBe(1000);
		const nvPr = (element.rawXml!['p:nvGraphicFramePr'] as XmlObject)['p:nvPr'] as XmlObject;
		expect(nvPr['p:ph']).toStrictEqual({ '@_idx': '14', '@_type': 'tbl' });
	});

	it('inherits the layout placeholder transform when the frame has none', () => {
		const seen: unknown[] = [];
		const parser = makeParser({
			findPlaceholderNode: (slidePath, placeholder) => {
				seen.push([slidePath, placeholder]);
				return {
					'p:spPr': {
						'a:xfrm': {
							'a:off': { '@_x': '1905000', '@_y': '952500' },
							'a:ext': { '@_cx': '4762500', '@_cy': '2857500' },
						},
					},
				};
			},
		});
		const element = parser.parseGraphicFrame(tableFrame({ '@_idx': '14' }), 'tbl-2', SLIDE)!;
		expect(seen).toStrictEqual([
			[SLIDE, { idx: '14', type: undefined, sz: undefined, orient: undefined }],
		]);
		expect([element.x, element.y, element.width, element.height]).toStrictEqual([
			200, 100, 500, 300,
		]);
	});

	it('prefers the frame transform over the inherited one', () => {
		const parser = makeParser({
			findPlaceholderNode: () => {
				throw new Error('must not consult the layout when the frame has a transform');
			},
		});
		const element = parser.parseGraphicFrame(
			tableFrame(
				{ '@_idx': '14' },
				{
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '952500', '@_cy': '952500' },
				},
			),
			'tbl-3',
			SLIDE,
		)!;
		expect(element.width).toBe(100);
	});

	it('does not consult the layout for a non-placeholder frame', () => {
		const parser = makeParser({
			findPlaceholderNode: () => {
				throw new Error('not a placeholder');
			},
		});
		const element = parser.parseGraphicFrame(tableFrame(undefined), 'tbl-4', SLIDE)!;
		expect(element.placeholderType).toBeUndefined();
		expect(element.width).toBe(0);
	});
});
