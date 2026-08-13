/**
 * Regression guards for `p:spTree` z-order loss on save.
 *
 * `CT_GroupShape` is an ordered sequence and document order IS paint order, but
 * the save writer assigns one array per tag, which collapsed an interleaved
 * tree into tag-grouped order. Proven on `e2e/fixtures/issue-132-hr-deck.pptx`
 * slide 1 with zero edits: `sp,sp,sp,sp,grpSp,pic,sp,...,pic,sp` came back as
 * `sp x43, grpSp, pic, pic`, so the group and both pictures jumped to the front
 * of the z-order and every shape authored above them fell behind.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { XmlObject } from '../../types';
import {
	buildOrderedSlideXml,
	orderShapeTreeChildren,
	orderSlideRootChildren,
} from './slide-save-xml-order';

const localName = (key: string): string => {
	const bare = key.startsWith('@_') ? key.slice(2) : key;
	const index = bare.lastIndexOf(':');
	return index < 0 ? bare : bare.slice(index + 1);
};

/** Depth-0 child tags of the first `p:spTree`, in serialized document order. */
function shapeTreeChildTags(xml: string): string[] {
	const known = new Set([
		'p:sp',
		'p:pic',
		'p:cxnSp',
		'p:graphicFrame',
		'p:grpSp',
		'p:contentPart',
		'mc:AlternateContent',
	]);
	const start = xml.indexOf('<p:spTree');
	if (start < 0) {
		return [];
	}
	const body = xml.slice(start);
	const tags: string[] = [];
	const pattern = /<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|[^>"])*)>/gu;
	let match: RegExpExecArray | null;
	let depth = 0;
	let started = false;
	while ((match = pattern.exec(body)) !== null) {
		const tag = match[2]!;
		if (!started) {
			if (tag === 'p:spTree') {
				started = true;
			}
			continue;
		}
		if (match[1] === '/') {
			if (depth === 0 && tag === 'p:spTree') {
				break;
			}
			depth = Math.max(0, depth - 1);
			continue;
		}
		if (depth === 0 && known.has(tag)) {
			tags.push(tag);
		}
		if (!match[3]!.endsWith('/')) {
			depth += 1;
		}
	}
	return tags;
}

describe('orderShapeTreeChildren', () => {
	it('re-interleaves tag-grouped children back into document order', () => {
		const first: XmlObject = { '@_n': '1' };
		const group: XmlObject = { '@_n': '2' };
		const picture: XmlObject = { '@_n': '3' };
		const last: XmlObject = { '@_n': '4' };
		const spTree: XmlObject = {
			'p:nvGrpSpPr': {},
			'p:grpSpPr': {},
			'p:sp': [first, last],
			'p:grpSp': [group],
			'p:pic': [picture],
		};
		const positions = new Map<XmlObject, number>([
			[first, 0],
			[group, 1],
			[picture, 2],
			[last, 3],
		]);

		const ordered = orderShapeTreeChildren(spTree, (node) => positions.get(node), localName);
		const keys = Object.keys(ordered);

		expect(keys.slice(0, 2)).toStrictEqual(['p:nvGrpSpPr', 'p:grpSpPr']);
		// The second `p:sp` run cannot reuse the plain key, so it gets an order
		// marker that the XML builder strips on the way out.
		expect(keys.slice(2)).toStrictEqual(['p:sp', 'p:grpSp', 'p:pic', 'p:sp#pptx-order-3']);
		expect(ordered['p:sp']).toBe(first);
		expect(ordered['p:sp#pptx-order-3']).toBe(last);
		// The live tree is untouched, so a second save still sees plain arrays.
		expect(spTree['p:sp']).toStrictEqual([first, last]);
	});

	it('keeps a contiguous run under one plain key', () => {
		const a: XmlObject = { '@_n': 'a' };
		const b: XmlObject = { '@_n': 'b' };
		const spTree: XmlObject = { 'p:nvGrpSpPr': {}, 'p:sp': [a, b] };
		const positions = new Map([
			[a, 0],
			[b, 1],
		]);
		const ordered = orderShapeTreeChildren(spTree, (node) => positions.get(node), localName);
		expect(Object.keys(ordered)).toStrictEqual(['p:nvGrpSpPr', 'p:sp']);
		expect(ordered['p:sp']).toStrictEqual([a, b]);
	});

	it('ranks an mc:AlternateContent envelope by the children it wraps', () => {
		const wrapped: XmlObject = { '@_n': 'wrapped' };
		const plain: XmlObject = { '@_n': 'plain' };
		const envelope: XmlObject = { 'mc:Choice': { 'p:pic': wrapped } };
		const spTree: XmlObject = {
			'p:nvGrpSpPr': {},
			'p:sp': [plain],
			'mc:AlternateContent': [envelope],
		};
		const positions = new Map<XmlObject, number>([
			[wrapped, 0],
			[plain, 1],
		]);
		const ordered = orderShapeTreeChildren(spTree, (node) => positions.get(node), localName);
		expect(Object.keys(ordered)).toStrictEqual(['p:nvGrpSpPr', 'mc:AlternateContent', 'p:sp']);
	});

	it('leaves p:extLst last', () => {
		const shape: XmlObject = {};
		const spTree: XmlObject = { 'p:extLst': {}, 'p:sp': [shape], 'p:nvGrpSpPr': {} };
		const ordered = orderShapeTreeChildren(spTree, () => 0, localName);
		expect(Object.keys(ordered).at(-1)).toBe('p:extLst');
	});
});

describe('orderSlideRootChildren', () => {
	it('sorts a late-added transition into CT_Slide sequence', () => {
		const slideNode: XmlObject = {
			'@_xmlns:p': 'ns',
			'p:cSld': {},
			'p:timing': {},
			'p:clrMapOvr': {},
			'p:transition': {},
		};
		expect(Object.keys(orderSlideRootChildren(slideNode, localName))).toStrictEqual([
			'@_xmlns:p',
			'p:cSld',
			'p:clrMapOvr',
			'p:transition',
			'p:timing',
		]);
	});

	it('places a transition-wrapping envelope in the transition slot', () => {
		const slideNode: XmlObject = {
			'p:timing': {},
			'mc:AlternateContent': { 'mc:Choice': { 'p:transition': {} } },
			'p:cSld': {},
		};
		expect(Object.keys(orderSlideRootChildren(slideNode, localName))).toStrictEqual([
			'p:cSld',
			'mc:AlternateContent',
			'p:timing',
		]);
	});
});

describe('buildOrderedSlideXml', () => {
	it('clones the p:sld spine rather than mutating the cached slide map', () => {
		const shape: XmlObject = {};
		const spTree: XmlObject = { 'p:nvGrpSpPr': {}, 'p:sp': [shape] };
		const commonSlideData: XmlObject = { 'p:spTree': spTree };
		const slideNode: XmlObject = { 'p:timing': {}, 'p:cSld': commonSlideData };
		const xmlObj: XmlObject = { 'p:sld': slideNode };

		const ordered = buildOrderedSlideXml({
			xmlObj,
			positionOf: () => 0,
			getLocalName: localName,
		});

		expect(ordered).not.toBe(xmlObj);
		expect(ordered['p:sld']).not.toBe(slideNode);
		expect(xmlObj['p:sld']).toBe(slideNode);
		expect((xmlObj['p:sld'] as XmlObject)['p:cSld']).toBe(commonSlideData);
	});
});

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/issue-132-hr-deck.pptx', import.meta.url),
);

describe('p:spTree z-order round-trip', () => {
	it.skipIf(!existsSync(fixture))(
		'preserves interleaved child order on a no-edit save',
		async () => {
			const bytes = readFileSync(fixture);
			const source = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			const handler = new PptxHandler();
			const data = await handler.load(source);
			const saved = await handler.save(data.slides);

			const before = await JSZip.loadAsync(source);
			const after = await JSZip.loadAsync(saved);

			const originalXml = (await before.file('ppt/slides/slide1.xml')!.async('string')) as string;
			const savedXml = (await after.file('ppt/slides/slide1.xml')!.async('string')) as string;
			const originalTags = shapeTreeChildTags(originalXml);

			// Guard the fixture itself: the bug is only observable on a slide whose
			// children are genuinely interleaved.
			expect(new Set(originalTags).size).toBeGreaterThan(1);
			expect(originalTags.indexOf('p:sp')).toBeLessThan(originalTags.lastIndexOf('p:grpSp'));
			expect(originalTags.lastIndexOf('p:grpSp')).toBeLessThan(originalTags.lastIndexOf('p:sp'));

			expect(shapeTreeChildTags(savedXml)).toStrictEqual(originalTags);
		},
		60_000,
	);
});
