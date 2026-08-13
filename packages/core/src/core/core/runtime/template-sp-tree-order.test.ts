/**
 * Regression guard: a slide LAYOUT or MASTER must come back out of a save with
 * its shape tree in the order it was authored in.
 *
 * `CT_GroupShape` (S19.3.1.45) is a painter's-algorithm list, so document
 * order IS paint order. The wave-1 z-order fix restored that for slide parts
 * only. Layouts and masters take a different route to the ZIP - they are
 * re-serialized straight out of the loader's parsed object - and
 * fast-xml-parser stores same-tag siblings in one array per tag, so the
 * authored interleaving was gone by the time anything could write it back. On
 * a no-edit open-and-save that restacked 31 template parts across seven corpus
 * decks: `sp,cxnSp,sp` came back `sp,sp,cxnSp`, putting a divider line
 * authored behind a layout's text in front of it on every slide using that
 * layout.
 *
 * Two levels are asserted, because a group is the same ordered sequence one
 * step down and restacks the same way.
 *
 * The package scaffolding is a real deck (`template-editing.pptx`); only
 * `slideLayout1.xml` is authored, because no fixture small enough to load in a
 * unit test has a layout whose shape tree interleaves element kinds - which is
 * precisely why the defect went unnoticed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { XmlObject } from '../../types';
import { orderedTemplatePartXml } from './template-sp-tree-order';

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/template-editing.pptx', import.meta.url),
);

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const XFRM = '<a:xfrm><a:off x="100000" y="100000"/><a:ext cx="900000" cy="900000"/></a:xfrm>';

function sp(id: number, name: string): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr>${XFRM}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
		'<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>'
	);
}

function cxnSp(id: number, name: string): string {
	return (
		`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
		`<p:spPr>${XFRM}<a:prstGeom prst="line"><a:avLst/></a:prstGeom></p:spPr>` +
		'<p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></p:style></p:cxnSp>'
	);
}

/** A group whose own children interleave the same two kinds. */
const GROUP =
	'<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20" name="Decoration"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
	'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2000000" cy="2000000"/>' +
	'<a:chOff x="0" y="0"/><a:chExt cx="2000000" cy="2000000"/></a:xfrm></p:grpSpPr>' +
	`${sp(21, 'InGroupShapeA')}${cxnSp(22, 'InGroupLine')}${sp(23, 'InGroupShapeB')}</p:grpSp>`;

/** `sp, cxnSp, sp, grpSp, sp` at the top level; `sp, cxnSp, sp` inside the group. */
const LAYOUT_XML =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	`<p:sldLayout ${NS} type="title" preserve="1"><p:cSld name="Title Slide"><p:spTree>` +
	'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
	'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
	'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
	`${sp(2, 'Alpha')}${cxnSp(3, 'Divider')}${sp(4, 'Beta')}${GROUP}${sp(5, 'Gamma')}` +
	'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

const LAYOUT_PART = 'ppt/slideLayouts/slideLayout1.xml';

/** Tag sequence of the direct children of the `index`-th container in a part. */
function childTags(xml: string, containerTag: string, index = 0): string[] {
	const pattern = new RegExp(`<${containerTag}[\\s>]`, 'g');
	let start = -1;
	for (let seen = 0; seen <= index; seen++) {
		const match = pattern.exec(xml);
		if (!match) {
			return [];
		}
		start = match.index;
	}
	const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
	tagPattern.lastIndex = xml.indexOf('>', start) + 1;
	const tags: string[] = [];
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(xml))) {
		const [, closing, tag, , selfClosing] = match;
		if (closing) {
			if (depth === 0) {
				break;
			}
			depth--;
			continue;
		}
		if (depth === 0) {
			tags.push(tag);
		}
		if (!selfClosing) {
			depth++;
		}
	}
	return tags;
}

/** Load the scaffold deck with the authored layout, save it, return the layout. */
async function roundTripLayout(): Promise<string> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file(LAYOUT_PART, LAYOUT_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const handler = new PptxHandler();
	const loaded = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	const saved = await handler.save(loaded.slides);
	const after = await JSZip.loadAsync(
		saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
	);
	return after.file(LAYOUT_PART)!.async('string');
}

describe('a saved slide layout keeps its authored shape-tree order', () => {
	it('preserves the spTree child sequence through a no-edit save', async () => {
		const saved = await roundTripLayout();

		expect(childTags(LAYOUT_XML, 'p:spTree')).toStrictEqual([
			'p:nvGrpSpPr',
			'p:grpSpPr',
			'p:sp',
			'p:cxnSp',
			'p:sp',
			'p:grpSp',
			'p:sp',
		]);
		// Bucketed by tag this reads sp,sp,sp,cxnSp,grpSp: the connector jumps
		// in front of two shapes it was authored behind.
		expect(childTags(saved, 'p:spTree')).toStrictEqual(childTags(LAYOUT_XML, 'p:spTree'));
	}, 60_000);

	it('preserves the child sequence inside a layout group', async () => {
		const saved = await roundTripLayout();

		expect(childTags(saved, 'p:grpSp')).toStrictEqual(childTags(LAYOUT_XML, 'p:grpSp'));
		expect(childTags(saved, 'p:grpSp')).toContain('p:cxnSp');
		expect(childTags(saved, 'p:grpSp').indexOf('p:cxnSp')).toBe(3);
	}, 60_000);
});

describe('orderedTemplatePartXml', () => {
	/** A parsed part the way fast-xml-parser produces it: one array per tag. */
	function bucketedPart(): XmlObject {
		return {
			'p:sldLayout': {
				'p:cSld': {
					'p:spTree': {
						'p:nvGrpSpPr': {},
						'p:grpSpPr': {},
						'p:sp': [{ '@_n': 'a' }, { '@_n': 'b' }],
						'p:cxnSp': { '@_n': 'line' },
					},
				},
			},
		} as unknown as XmlObject;
	}

	const SOURCE =
		'<p:sldLayout><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/>' +
		'<p:sp n="a"/><p:cxnSp n="line"/><p:sp n="b"/>' +
		'</p:spTree></p:cSld></p:sldLayout>';

	function order(part: XmlObject, sourceXml: string | undefined): string[] {
		const ordered = orderedTemplatePartXml({
			runtime: {},
			partPath: LAYOUT_PART,
			xmlObj: part,
			rootTag: 'p:sldLayout',
			sourceXml,
			getLocalName: (key) => key.split(':').pop() ?? key,
		});
		const root = ordered['p:sldLayout'] as XmlObject;
		const spTree = (root['p:cSld'] as XmlObject)['p:spTree'] as XmlObject;
		return Object.keys(spTree);
	}

	it('re-keys the tree so key order carries document order', () => {
		// `p:sp` reappears after `p:cxnSp`, so the second run needs a marker key
		// for plain object key-insertion order to carry the true sequence.
		expect(order(bucketedPart(), SOURCE)).toStrictEqual([
			'p:nvGrpSpPr',
			'p:grpSpPr',
			'p:sp',
			'p:cxnSp',
			'p:sp#pptx-order-2',
		]);
	});

	it('leaves the cached part object untouched so markers cannot leak', () => {
		const part = bucketedPart();
		const before = JSON.stringify(part);
		orderedTemplatePartXml({
			runtime: {},
			partPath: LAYOUT_PART,
			xmlObj: part,
			rootTag: 'p:sldLayout',
			sourceXml: SOURCE,
			getLocalName: (key) => key.split(':').pop() ?? key,
		});
		expect(JSON.stringify(part)).toBe(before);
	});

	it('returns the part unchanged when the source order is unavailable', () => {
		const part = bucketedPart();
		expect(
			orderedTemplatePartXml({
				runtime: {},
				partPath: LAYOUT_PART,
				xmlObj: part,
				rootTag: 'p:sldLayout',
				sourceXml: undefined,
				getLocalName: (key) => key.split(':').pop() ?? key,
			}),
		).toBe(part);
	});
});
