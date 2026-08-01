/**
 * issue #132 - a themed connector drew in the default grey instead of accent1.
 *
 * `p:cxnSp` carries `<p:style>` exactly as `p:sp` does, and for a connector that
 * is normally the ONLY place the colour lives. PowerPoint writes
 *
 *   <p:spPr>…<a:ln><a:headEnd type="oval"/></a:ln></p:spPr>
 *   <p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>…</p:style>
 *
 * so `spPr/a:ln` holds nothing but the arrow ends. Two things went wrong:
 * `PptxConnectorParser` never handed the style node to the style extractor, and
 * the extractor treated `a:ln` and `a:lnRef` as mutually exclusive rather than
 * override-over-base. Slide 3 of the reporter's deck stroked black.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxConnectorParser } from './PptxConnectorParser';
import type { PptxConnectorParserContext } from './PptxConnectorParser';

const EMU_PER_PX = 9525;

/** A `p:cxnSp` whose colour lives only in `p:style`, as PowerPoint writes it. */
const THEMED_CONNECTOR: XmlObject = {
	'p:nvCxnSpPr': { 'p:cNvPr': { '@_id': '13', '@_name': '直接连接符 12' }, 'p:cNvCxnSpPr': {} },
	'p:spPr': {
		'a:xfrm': {
			'@_flipV': '1',
			'a:off': { '@_x': '2417357', '@_y': '0' },
			'a:ext': { '@_cx': '0', '@_cy': '1978702' },
		},
		'a:prstGeom': { '@_prst': 'line', 'a:avLst': '' },
		'a:ln': { 'a:headEnd': { '@_type': 'oval' } },
	},
	'p:style': {
		'a:lnRef': { '@_idx': '1', 'a:schemeClr': { '@_val': 'accent1' } },
		'a:fillRef': { '@_idx': '0', 'a:schemeClr': { '@_val': 'accent1' } },
	},
};

describe('connector style reference', () => {
	it('passes p:style through to the shape-style extractor', () => {
		let seenStyleNode: XmlObject | undefined;
		const context = {
			emuPerPx: EMU_PER_PX,
			getOrderedSlidePaths: () => ['ppt/slides/slide3.xml'],
			slideRelsMap: new Map(),
			parseGeometryAdjustments: () => undefined,
			readFlipState: () => ({ flipVertical: true }),
			extractShapeStyle: (_spPr: XmlObject | undefined, styleNode?: XmlObject) => {
				seenStyleNode = styleNode;
				return {};
			},
			parseShapeLocks: () => undefined,
			parseElementActions: () => ({}),
		} as unknown as PptxConnectorParserContext;

		const parser = new PptxConnectorParser(context);
		const element = parser.parseConnector(THEMED_CONNECTOR, 'ppt/slides/slide3.xml-conn-0');

		expect(element).not.toBeNull();
		expect(seenStyleNode, 'the p:style node reaches the extractor').toBeDefined();
		expect(seenStyleNode?.['a:lnRef']).toStrictEqual({
			'@_idx': '1',
			'a:schemeClr': { '@_val': 'accent1' },
		});
	});

	it('still parses a connector that has no p:style', () => {
		let seenStyleNode: XmlObject | undefined = {} as XmlObject;
		const context = {
			emuPerPx: EMU_PER_PX,
			getOrderedSlidePaths: () => [],
			slideRelsMap: new Map(),
			parseGeometryAdjustments: () => undefined,
			readFlipState: () => ({}),
			extractShapeStyle: (_spPr: XmlObject | undefined, styleNode?: XmlObject) => {
				seenStyleNode = styleNode;
				return {};
			},
			parseShapeLocks: () => undefined,
			parseElementActions: () => ({}),
		} as unknown as PptxConnectorParserContext;

		const bare = { ...THEMED_CONNECTOR };
		delete (bare as Record<string, unknown>)['p:style'];

		const element = new PptxConnectorParser(context).parseConnector(bare, 'conn-0');
		expect(element).not.toBeNull();
		expect(seenStyleNode).toBeUndefined();
	});
});
