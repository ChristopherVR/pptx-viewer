/**
 * The layout/master placeholder walk only looked inside `p:sp` and `p:pic`,
 * so a placeholder authored as a `p:graphicFrame` (a table, chart, SmartArt,
 * OLE or media slot) never resolved its counterpart, and neither did a slide
 * frame whose layout counterpart is an ordinary `p:sp` when the lookup went
 * through the frame-aware entry point.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';
import type { PlaceholderNodeContext } from './PptxHandlerRuntimePlaceholderLookup';

const SLIDE = 'ppt/slides/slide1.xml';
const LAYOUT = 'ppt/slideLayouts/slideLayout1.xml';
const MASTER = 'ppt/slideMasters/slideMaster1.xml';

function xfrm(x: number, cx: number): XmlObject {
	return {
		'a:off': { '@_x': String(x), '@_y': '0' },
		'a:ext': { '@_cx': String(cx), '@_cy': '1' },
	};
}

function spPrTransform(node: XmlObject | undefined): unknown {
	const spPr = node?.['p:spPr'];
	return spPr && typeof spPr === 'object' ? (spPr as XmlObject)['a:xfrm'] : undefined;
}

function spPlaceholder(ph: XmlObject, transform: XmlObject): XmlObject {
	return {
		'p:nvSpPr': { 'p:cNvPr': { '@_id': '2' }, 'p:cNvSpPr': '', 'p:nvPr': { 'p:ph': ph } },
		'p:spPr': { 'a:xfrm': transform },
	};
}

function framePlaceholder(ph: XmlObject, transform: XmlObject): XmlObject {
	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '3' },
			'p:cNvGraphicFramePr': '',
			'p:nvPr': { 'p:ph': ph },
		},
		'p:xfrm': transform,
	};
}

class LookupProbe extends PptxHandlerRuntime {
	public constructor(layoutTree: XmlObject, masterTree: XmlObject) {
		super();
		this.slideRelsMap.set(SLIDE, new Map([['rId1', '../slideLayouts/slideLayout1.xml']]));
		this.slideRelsMap.set(LAYOUT, new Map([['rId1', '../slideMasters/slideMaster1.xml']]));
		this.layoutXmlMap.set(LAYOUT, { 'p:sldLayout': { 'p:cSld': { 'p:spTree': layoutTree } } });
		this.masterXmlMap.set(MASTER, { 'p:sldMaster': { 'p:cSld': { 'p:spTree': masterTree } } });
	}

	public context(idx: string, type?: string): PlaceholderNodeContext | undefined {
		return this.findPlaceholderContext(SLIDE, { idx, type });
	}

	public node(idx: string, type?: string): XmlObject | undefined {
		return this.findPlaceholderNode(SLIDE, { idx, type });
	}
}

describe('placeholder lookup across p:graphicFrame', () => {
	it('finds a placeholder the layout authored as a graphic frame', () => {
		const probe = new LookupProbe(
			{ 'p:graphicFrame': framePlaceholder({ '@_idx': '14', '@_type': 'tbl' }, xfrm(10, 20)) },
			{},
		);
		const context = probe.context('14', 'tbl');
		expect(context?.graphicFrame).toBeDefined();
		expect(context?.shape).toBeUndefined();
		expect(probe.node('14', 'tbl')?.['p:xfrm']).toStrictEqual(xfrm(10, 20));
	});

	it('merges a layout frame over a master shape for the same slot', () => {
		const probe = new LookupProbe(
			{ 'p:graphicFrame': framePlaceholder({ '@_idx': '14' }, xfrm(10, 20)) },
			{ 'p:sp': spPlaceholder({ '@_idx': '14', '@_type': 'obj' }, xfrm(30, 40)) },
		);
		const context = probe.context('14');
		expect(context?.graphicFrame?.['p:xfrm']).toStrictEqual(xfrm(10, 20));
		expect(spPrTransform(context?.shape)).toStrictEqual(xfrm(30, 40));
		// The inherited node carries both spellings, layout on top: a consumer
		// preferring `p:xfrm` over `p:spPr/a:xfrm` lands on the layout's.
		const node = probe.node('14');
		expect(node?.['p:xfrm']).toStrictEqual(xfrm(10, 20));
		expect(spPrTransform(node)).toStrictEqual(xfrm(30, 40));
	});

	it('still resolves the ordinary shape counterpart of a slide frame', () => {
		const probe = new LookupProbe(
			{ 'p:sp': spPlaceholder({ '@_idx': '1' }, xfrm(50, 60)) },
			{ 'p:sp': spPlaceholder({ '@_idx': '1', '@_type': 'body' }, xfrm(70, 80)) },
		);
		expect(spPrTransform(probe.node('1'))).toStrictEqual(xfrm(50, 60));
	});

	it('returns nothing when no bucket carries the slot', () => {
		const probe = new LookupProbe({ 'p:sp': spPlaceholder({ '@_idx': '2' }, xfrm(1, 1)) }, {});
		expect(probe.context('14')).toBeUndefined();
		expect(probe.node('14')).toBeUndefined();
	});
});
