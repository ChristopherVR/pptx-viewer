/**
 * Tests for the element-action / bucket-key / lock writers.
 *
 * These used to be run against private COPIES of the three functions pasted
 * into this file. That is why `getTreeBucketKeyForElementType('group')` was
 * asserted to be `'p:sp'` for as long as it was: the assertion pinned the copy,
 * the copy matched the source, and nothing pinned the source to
 * `CT_GroupShape`. The real methods are protected and depend on the whole mixin
 * chain, so they are reached the way `PptxHandlerRuntimeSaveViewProperties.test`
 * reaches its own: by instantiating the concrete runtime and casting to a
 * structural view of the members under test.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxAction, PptxElement } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

interface RuntimeWithProtected {
	getTreeBucketKeyForElementType(type: PptxElement['type']): string;
	getCnvPrNode(shape: XmlObject, key: string): XmlObject | undefined;
	serializeShapeLocks(shape: XmlObject, el: PptxElement): void;
	serializeElementActions(
		shape: XmlObject,
		el: PptxElement,
		resolveHyperlinkRelationshipId: (target: string) => string | undefined,
	): void;
	serializeSingleAction(
		cNvPr: XmlObject,
		nodeName: string,
		action: PptxAction | undefined,
		resolveHyperlinkRelationshipId: (target: string) => string | undefined,
	): void;
}

const runtime = new PptxHandlerRuntime() as unknown as RuntimeWithProtected;

const getTreeBucketKeyForElementType = (type: PptxElement['type']) =>
	runtime.getTreeBucketKeyForElementType(type);
const getCnvPrNode = (shape: XmlObject, key: string) => runtime.getCnvPrNode(shape, key);
const serializeSingleAction = (
	cNvPr: XmlObject,
	nodeName: string,
	action: PptxAction | undefined,
	resolve: (target: string) => string | undefined,
) => runtime.serializeSingleAction(cNvPr, nodeName, action, resolve);

/** A minimal element carrying only what the lock writer reads. */
function elementWithLocks(type: PptxElement['type'], locks: PptxElement['locks']): PptxElement {
	return { id: 'e1', type, x: 0, y: 0, width: 10, height: 10, locks } as PptxElement;
}

// ---------------------------------------------------------------------------
// getTreeBucketKeyForElementType
// ---------------------------------------------------------------------------
describe('getTreeBucketKeyForElementType', () => {
	it('should return "p:pic" for "picture"', () => {
		expect(getTreeBucketKeyForElementType('picture' as PptxElement['type'])).toBe('p:pic');
	});

	it('should return "p:pic" for "image"', () => {
		expect(getTreeBucketKeyForElementType('image' as PptxElement['type'])).toBe('p:pic');
	});

	it('should return "p:cxnSp" for "connector"', () => {
		expect(getTreeBucketKeyForElementType('connector')).toBe('p:cxnSp');
	});

	it('should return "p:graphicFrame" for "table"', () => {
		expect(getTreeBucketKeyForElementType('table')).toBe('p:graphicFrame');
	});

	it('should return "p:graphicFrame" for "chart"', () => {
		expect(getTreeBucketKeyForElementType('chart')).toBe('p:graphicFrame');
	});

	it('should return "p:graphicFrame" for "smartArt"', () => {
		expect(getTreeBucketKeyForElementType('smartArt')).toBe('p:graphicFrame');
	});

	it('should return "p:graphicFrame" for "ole"', () => {
		expect(getTreeBucketKeyForElementType('ole')).toBe('p:graphicFrame');
	});

	it('should return "p:graphicFrame" for "media"', () => {
		expect(getTreeBucketKeyForElementType('media')).toBe('p:graphicFrame');
	});

	it('should return "p:sp" for "text"', () => {
		expect(getTreeBucketKeyForElementType('text')).toBe('p:sp');
	});

	it('should return "p:sp" for "shape"', () => {
		expect(getTreeBucketKeyForElementType('shape')).toBe('p:sp');
	});

	// A group is `<p:grpSp>` in `CT_GroupShape`, not `<p:sp>`. This assertion
	// used to read `'p:sp'`, which is what let the template writer look for an
	// inherited group in the wrong bucket and the lock writer look for a
	// `p:nvSpPr` a group does not have.
	it('should return "p:grpSp" for "group"', () => {
		expect(getTreeBucketKeyForElementType('group')).toBe('p:grpSp');
	});
});

// ---------------------------------------------------------------------------
// getCnvPrNode
// ---------------------------------------------------------------------------
describe('getCnvPrNode', () => {
	it('should resolve p:cNvPr from p:nvSpPr for p:sp key', () => {
		const cNvPr: XmlObject = { '@_id': '1', '@_name': 'Shape 1' };
		const shape: XmlObject = {
			'p:nvSpPr': { 'p:cNvPr': cNvPr },
		};
		expect(getCnvPrNode(shape, 'p:sp')).toBe(cNvPr);
	});

	it('should resolve p:cNvPr from p:nvPicPr for p:pic key', () => {
		const cNvPr: XmlObject = { '@_id': '2', '@_name': 'Picture 1' };
		const shape: XmlObject = {
			'p:nvPicPr': { 'p:cNvPr': cNvPr },
		};
		expect(getCnvPrNode(shape, 'p:pic')).toBe(cNvPr);
	});

	it('should resolve p:cNvPr from p:nvCxnSpPr for p:cxnSp key', () => {
		const cNvPr: XmlObject = { '@_id': '3', '@_name': 'Connector 1' };
		const shape: XmlObject = {
			'p:nvCxnSpPr': { 'p:cNvPr': cNvPr },
		};
		expect(getCnvPrNode(shape, 'p:cxnSp')).toBe(cNvPr);
	});

	it('should resolve p:cNvPr from p:nvGraphicFramePr for p:graphicFrame key', () => {
		const cNvPr: XmlObject = { '@_id': '4', '@_name': 'Table 1' };
		const shape: XmlObject = {
			'p:nvGraphicFramePr': { 'p:cNvPr': cNvPr },
		};
		expect(getCnvPrNode(shape, 'p:graphicFrame')).toBe(cNvPr);
	});

	it('should resolve p:cNvPr from p:nvGrpSpPr for p:grpSp key', () => {
		const cNvPr: XmlObject = { '@_id': '5', '@_name': 'Group 1' };
		const shape: XmlObject = {
			'p:nvGrpSpPr': { 'p:cNvPr': cNvPr },
		};
		expect(getCnvPrNode(shape, 'p:grpSp')).toBe(cNvPr);
	});

	it('should return undefined when the nv wrapper is missing', () => {
		expect(getCnvPrNode({}, 'p:sp')).toBeUndefined();
		expect(getCnvPrNode({}, 'p:pic')).toBeUndefined();
		expect(getCnvPrNode({}, 'p:cxnSp')).toBeUndefined();
		expect(getCnvPrNode({}, 'p:graphicFrame')).toBeUndefined();
		expect(getCnvPrNode({}, 'p:grpSp')).toBeUndefined();
	});

	// The bucket key comes from `el.type`, and the two disagree in real files.
	// Trusting the key alone found nothing on these nodes, `serializeElementActions`
	// returned early, and a hyperlink or action set on a video, an audio clip or
	// an ink stroke was accepted by the editor and then never written to the file.
	// This is the same markup-over-type rule the lock writer already follows.
	it('resolves a media element written as a p:pic, not as its p:graphicFrame bucket', () => {
		const cNvPr: XmlObject = { '@_id': '6', '@_name': 'Video 1' };
		const shape: XmlObject = {
			'p:nvPicPr': { 'p:cNvPr': cNvPr, 'p:cNvPicPr': '', 'p:nvPr': { 'a:videoFile': '' } },
		};
		expect(getTreeBucketKeyForElementType('media')).toBe('p:graphicFrame');
		expect(getCnvPrNode(shape, 'p:graphicFrame')).toBe(cNvPr);
	});

	it('resolves loaded ink written as a graphic frame, not as its p:sp bucket', () => {
		const cNvPr: XmlObject = { '@_id': '7', '@_name': 'Ink 1' };
		const shape: XmlObject = { 'p:nvGraphicFramePr': { 'p:cNvPr': cNvPr } };
		expect(getTreeBucketKeyForElementType('ink')).toBe('p:sp');
		expect(getCnvPrNode(shape, 'p:sp')).toBe(cNvPr);
	});

	it('resolves ink written as a p:contentPart', () => {
		const cNvPr: XmlObject = { '@_id': '8', '@_name': 'Ink 2' };
		const shape: XmlObject = {
			'p:nvContentPartPr': { 'p:cNvPr': cNvPr, 'p:cNvContentPartPr': '', 'p:nvPr': '' },
		};
		expect(getCnvPrNode(shape, 'p:sp')).toBe(cNvPr);
	});

	it('writes the hyperlink onto a media p:pic that the bucket key would have missed', () => {
		const cNvPr: XmlObject = { '@_id': '9', '@_name': 'Video 2' };
		const shape: XmlObject = { 'p:nvPicPr': { 'p:cNvPr': cNvPr } };
		const media = {
			id: 'm1',
			type: 'media',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			actionClick: { url: 'https://example.com' },
		} as unknown as PptxElement;
		runtime.serializeElementActions(shape, media, () => 'rId9');
		expect(cNvPr['a:hlinkClick']).toStrictEqual({ '@_r:id': 'rId9' });
	});
});

// ---------------------------------------------------------------------------
// serializeShapeLocks
// ---------------------------------------------------------------------------
describe('serializeShapeLocks', () => {
	it('writes a:spLocks onto p:cNvSpPr for a shape', () => {
		const cNvSpPr: XmlObject = {};
		const shape: XmlObject = { 'p:nvSpPr': { 'p:cNvSpPr': cNvSpPr } };
		runtime.serializeShapeLocks(
			shape,
			elementWithLocks('shape', { noMove: true, noResize: false }),
		);
		expect(cNvSpPr['a:spLocks']).toStrictEqual({ '@_noMove': '1', '@_noResize': '0' });
	});

	it('writes a:grpSpLocks onto p:cNvGrpSpPr for a group', () => {
		const cNvGrpSpPr: XmlObject = {};
		const shape: XmlObject = { 'p:nvGrpSpPr': { 'p:cNvGrpSpPr': cNvGrpSpPr } };
		runtime.serializeShapeLocks(shape, elementWithLocks('group', { noMove: true, noSelect: true }));
		expect(cNvGrpSpPr['a:grpSpLocks']).toStrictEqual({ '@_noMove': '1', '@_noSelect': '1' });
	});

	it('keeps a:grpSpLocks/@noUngrp, which CT_GroupLocking has and the model does not', () => {
		const cNvGrpSpPr: XmlObject = { 'a:grpSpLocks': { '@_noUngrp': '1', '@_noMove': '1' } };
		const shape: XmlObject = { 'p:nvGrpSpPr': { 'p:cNvGrpSpPr': cNvGrpSpPr } };
		runtime.serializeShapeLocks(shape, elementWithLocks('group', { noMove: false }));
		expect(cNvGrpSpPr['a:grpSpLocks']).toStrictEqual({ '@_noUngrp': '1', '@_noMove': '0' });
	});

	it('does not write noTextEdit onto a:grpSpLocks (not in CT_GroupLocking)', () => {
		const cNvGrpSpPr: XmlObject = {};
		const shape: XmlObject = { 'p:nvGrpSpPr': { 'p:cNvGrpSpPr': cNvGrpSpPr } };
		runtime.serializeShapeLocks(
			shape,
			elementWithLocks('group', { noTextEdit: true, noEditPoints: true, noMove: true }),
		);
		expect(cNvGrpSpPr['a:grpSpLocks']).toStrictEqual({ '@_noMove': '1' });
	});

	it('does not write noTextEdit onto a:picLocks (not in CT_PictureLocking)', () => {
		const cNvPicPr: XmlObject = {};
		const shape: XmlObject = { 'p:nvPicPr': { 'p:cNvPicPr': cNvPicPr } };
		runtime.serializeShapeLocks(
			shape,
			elementWithLocks('image', { noTextEdit: true, noChangeAspect: true }),
		);
		expect(cNvPicPr['a:picLocks']).toStrictEqual({ '@_noChangeAspect': '1' });
	});

	it('does not write noTextEdit onto a:cxnSpLocks (not in CT_ConnectorLocking)', () => {
		const cNvCxnSpPr: XmlObject = {};
		const shape: XmlObject = { 'p:nvCxnSpPr': { 'p:cNvCxnSpPr': cNvCxnSpPr } };
		runtime.serializeShapeLocks(shape, elementWithLocks('connector', { noTextEdit: true }));
		expect(cNvCxnSpPr['a:cxnSpLocks']).toBeUndefined();
	});

	it('keeps a:picLocks/@noCrop when another lock on the same node is edited', () => {
		const cNvPicPr: XmlObject = { 'a:picLocks': { '@_noCrop': '1' } };
		const shape: XmlObject = { 'p:nvPicPr': { 'p:cNvPicPr': cNvPicPr } };
		runtime.serializeShapeLocks(shape, elementWithLocks('image', { noMove: true }));
		expect(cNvPicPr['a:picLocks']).toStrictEqual({ '@_noCrop': '1', '@_noMove': '1' });
	});

	it('removes the lock node when nothing is left on it', () => {
		const cNvSpPr: XmlObject = { 'a:spLocks': { '@_noMove': '1' } };
		const shape: XmlObject = { 'p:nvSpPr': { 'p:cNvSpPr': cNvSpPr } };
		runtime.serializeShapeLocks(shape, elementWithLocks('shape', undefined));
		expect(cNvSpPr['a:spLocks']).toBeUndefined();
	});

	it('writes a:graphicFrameLocks onto p:cNvGraphicFramePr for a table', () => {
		const cNvFramePr: XmlObject = { 'a:graphicFrameLocks': { '@_noGrp': '1' } };
		const shape: XmlObject = { 'p:nvGraphicFramePr': { 'p:cNvGraphicFramePr': cNvFramePr } };
		runtime.serializeShapeLocks(
			shape,
			elementWithLocks('table', { noGrouping: true, noMove: true, noDrilldown: true }),
		);
		expect(cNvFramePr['a:graphicFrameLocks']).toStrictEqual({
			'@_noGrp': '1',
			'@_noDrilldown': '1',
			'@_noMove': '1',
		});
	});

	it('does not write CT_ShapeLocking-only attributes onto a:graphicFrameLocks', () => {
		const cNvFramePr: XmlObject = {};
		const shape: XmlObject = { 'p:nvGraphicFramePr': { 'p:cNvGraphicFramePr': cNvFramePr } };
		runtime.serializeShapeLocks(
			shape,
			elementWithLocks('chart', {
				noTextEdit: true,
				noRotation: true,
				noEditPoints: true,
				noAdjustHandles: true,
				noChangeArrowheads: true,
				noChangeShapeType: true,
				noSelect: true,
			}),
		);
		expect(cNvFramePr['a:graphicFrameLocks']).toStrictEqual({ '@_noSelect': '1' });
	});

	it('does not write noDrilldown onto a:spLocks (CT_GraphicalObjectFrameLocking only)', () => {
		const cNvSpPr: XmlObject = {};
		const shape: XmlObject = { 'p:nvSpPr': { 'p:cNvSpPr': cNvSpPr } };
		runtime.serializeShapeLocks(
			shape,
			elementWithLocks('shape', { noDrilldown: true, noMove: true }),
		);
		expect(cNvSpPr['a:spLocks']).toStrictEqual({ '@_noMove': '1' });
	});

	it('writes a:spLocks when p:cNvSpPr arrived as a self-closing element', () => {
		// `<p:cNvSpPr/>` parses to the STRING '' (fast-xml-parser collapses an
		// empty element), and it is the commonest spelling in any real deck
		// because it is what a shape with no locks yet looks like. Walking
		// through it returned undefined, so the writer concluded there was
		// nowhere to put the lock: locking a not-already-locked shape never
		// reached the file, for every family at once.
		const nv: XmlObject = { 'p:cNvPr': { '@_id': '2' }, 'p:cNvSpPr': '', 'p:nvPr': {} };
		runtime.serializeShapeLocks({ 'p:nvSpPr': nv }, elementWithLocks('shape', { noMove: true }));
		expect(nv['p:cNvSpPr']).toStrictEqual({ 'a:spLocks': { '@_noMove': '1' } });
	});

	it('creates a missing p:cNvSpPr in CT_NonVisualShapeProperties sequence order', () => {
		// The sequence is cNvPr, cNvSpPr, nvPr. Appending the new child would
		// place it after p:nvPr and emit an out-of-order package.
		const nv: XmlObject = { 'p:cNvPr': { '@_id': '2' }, 'p:nvPr': {} };
		runtime.serializeShapeLocks({ 'p:nvSpPr': nv }, elementWithLocks('shape', { noResize: true }));
		expect(Object.keys(nv)).toStrictEqual(['p:cNvPr', 'p:cNvSpPr', 'p:nvPr']);
	});

	it('does not materialise a container for an element that has no locks', () => {
		const nv: XmlObject = { 'p:cNvPr': { '@_id': '2' }, 'p:nvPr': {} };
		runtime.serializeShapeLocks({ 'p:nvSpPr': nv }, elementWithLocks('shape', undefined));
		expect(nv['p:cNvSpPr']).toBeUndefined();
	});

	it('follows the markup, not the type: media authored as a p:pic gets a:picLocks', () => {
		// PowerPoint writes a video as a `p:pic` (poster blip + `a:videoFile`),
		// but `media` buckets as `p:graphicFrame`. Trusting the type here would
		// build `a:graphicFrameLocks` on a node that has none and leave the real
		// `a:picLocks` behind untouched.
		const cNvPicPr: XmlObject = { 'a:picLocks': { '@_noCrop': '1' } };
		const shape: XmlObject = { 'p:nvPicPr': { 'p:cNvPicPr': cNvPicPr } };
		runtime.serializeShapeLocks(shape, elementWithLocks('media', { noMove: true }));
		expect(cNvPicPr['a:picLocks']).toStrictEqual({ '@_noCrop': '1', '@_noMove': '1' });
		expect(cNvPicPr['a:graphicFrameLocks']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// serializeSingleAction
// ---------------------------------------------------------------------------
describe('serializeSingleAction', () => {
	const noopResolver = (_target: string): string | undefined => undefined;

	it('should delete the node when action is undefined', () => {
		const cNvPr: XmlObject = { 'a:hlinkClick': { '@_r:id': 'rId1' } };
		serializeSingleAction(cNvPr, 'a:hlinkClick', undefined, noopResolver);
		expect(cNvPr['a:hlinkClick']).toBeUndefined();
	});

	it('should write rId directly when provided', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { rId: 'rId5' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_r:id']).toBe('rId5');
	});

	it('should resolve rId from url when rId is not provided', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { url: 'https://example.com' };
		const resolver = (target: string) => (target === 'https://example.com' ? 'rId10' : undefined);
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, resolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_r:id']).toBe('rId10');
	});

	it('should not set @_r:id when both rId is undefined and resolver returns undefined', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { url: 'https://example.com' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_r:id']).toBeUndefined();
	});

	it('should write action attribute', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { action: 'ppaction://hlinksldjump' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_action']).toBe('ppaction://hlinksldjump');
	});

	it('should write tooltip attribute', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { tooltip: 'Click here' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_tooltip']).toBe('Click here');
	});

	it("should write highlightClick as '1' when true", () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { highlightClick: true };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_highlightClick']).toBe('1');
	});

	it('should not write highlightClick when false', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { highlightClick: false };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_highlightClick']).toBeUndefined();
	});

	it('should write sound element when soundRId is provided', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { soundRId: 'rId20' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['a:snd']).toStrictEqual({ '@_r:embed': 'rId20' });
	});

	it('should not write sound element when soundRId is not provided', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { tooltip: 'Test' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['a:snd']).toBeUndefined();
	});

	it('should handle hlinkHover nodeName', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { rId: 'rId3', tooltip: 'Hover me' };
		serializeSingleAction(cNvPr, 'a:hlinkHover', action, noopResolver);
		const node = cNvPr['a:hlinkHover'] as XmlObject;
		expect(node['@_r:id']).toBe('rId3');
		expect(node['@_tooltip']).toBe('Hover me');
	});

	it('should handle fully populated action', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = {
			rId: 'rId1',
			action: 'ppaction://hlinkshowjump?jump=nextslide',
			tooltip: 'Next slide',
			highlightClick: true,
			soundRId: 'rId30',
		};
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_r:id']).toBe('rId1');
		expect(node['@_action']).toBe('ppaction://hlinkshowjump?jump=nextslide');
		expect(node['@_tooltip']).toBe('Next slide');
		expect(node['@_highlightClick']).toBe('1');
		expect(node['a:snd']).toStrictEqual({ '@_r:embed': 'rId30' });
	});

	it('writes an extended-verb action string byte-for-byte (customshow)', () => {
		const cNvPr: XmlObject = {};
		const action: PptxAction = { action: 'ppaction://customshow?id=3&return=true' };
		serializeSingleAction(cNvPr, 'a:hlinkClick', action, noopResolver);
		const node = cNvPr['a:hlinkClick'] as XmlObject;
		expect(node['@_action']).toBe('ppaction://customshow?id=3&return=true');
	});
});
