import { describe, it, expect } from 'vitest';

import type {
	GroupPptxElement,
	PptxElement,
	PptxSlide,
	TextStyle,
	ShapeStyle,
	XmlObject,
} from '../types';
import {
	cloneTextStyle,
	cloneShapeStyle,
	cloneElement,
	cloneSlide,
	cloneXmlObject,
} from './clone-utils';

// ---------------------------------------------------------------------------
// cloneTextStyle
// ---------------------------------------------------------------------------

describe('cloneTextStyle', () => {
	it('returns undefined for undefined input', () => {
		expect(cloneTextStyle(undefined)).toBeUndefined();
	});

	it('returns undefined for falsy input', () => {
		expect(cloneTextStyle(undefined)).toBeUndefined();
	});

	it('returns a shallow copy of the style', () => {
		const style: TextStyle = { bold: true, fontSize: 18, color: '#FF0000' };
		const cloned = cloneTextStyle(style);
		expect(cloned).toStrictEqual(style);
		expect(cloned).not.toBe(style);
	});

	it('mutations on the clone do not affect the original', () => {
		const style: TextStyle = { bold: true, fontSize: 18 };
		const cloned = cloneTextStyle(style)!;
		cloned.bold = false;
		expect(style.bold).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// cloneShapeStyle
// ---------------------------------------------------------------------------

describe('cloneShapeStyle', () => {
	it('returns undefined for undefined input', () => {
		expect(cloneShapeStyle(undefined)).toBeUndefined();
	});

	it('returns a shallow copy of the shape style', () => {
		const style: ShapeStyle = { fillColor: '#FF0000', strokeWidth: 2 };
		const cloned = cloneShapeStyle(style);
		expect(cloned).toStrictEqual(style);
		expect(cloned).not.toBe(style);
	});

	it('deep-clones gradient stops', () => {
		const style: ShapeStyle = {
			fillColor: '#000',
			fillGradientStops: [
				{ position: 0, color: '#FF0000' },
				{ position: 1, color: '#0000FF' },
			],
		};
		const cloned = cloneShapeStyle(style)!;
		expect(cloned.fillGradientStops).toStrictEqual(style.fillGradientStops);
		expect(cloned.fillGradientStops).not.toBe(style.fillGradientStops);
		// Mutate cloned gradient stop
		cloned.fillGradientStops![0].color = '#00FF00';
		expect(style.fillGradientStops![0].color).toBe('#FF0000');
	});

	it('handles styles without gradient stops', () => {
		const style: ShapeStyle = { fillColor: '#AABB00' };
		const cloned = cloneShapeStyle(style)!;
		expect(cloned.fillGradientStops).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// cloneElement
// ---------------------------------------------------------------------------

describe('cloneElement', () => {
	it('clones a text element with text segments', () => {
		const el: PptxElement = {
			type: 'text',
			id: 't1',
			x: 10,
			y: 20,
			width: 300,
			height: 100,
			text: 'Hello',
			textStyle: { bold: true },
			textSegments: [{ text: 'Hello', style: { bold: true } }],
		};
		const cloned = cloneElement(el);
		expect(cloned).toStrictEqual(el);
		expect(cloned).not.toBe(el);
		// Verify deep independence of textSegments
		if (cloned.type === 'text' && cloned.textSegments) {
			cloned.textSegments[0].text = 'Changed';
			expect((el as { textSegments: Array<{ text: string }> }).textSegments[0].text).toBe('Hello');
		}
	});

	it('clones a shape element with adjustments', () => {
		const el: PptxElement = {
			type: 'shape',
			id: 's1',
			x: 0,
			y: 0,
			width: 200,
			height: 150,
			shapeType: 'roundRect',
			shapeAdjustments: { adj1: 50000, adj2: 25000 },
			shapeStyle: { fillColor: '#FF0000' },
		};
		const cloned = cloneElement(el);
		expect(cloned).toStrictEqual(el);
		// Mutating the clone's adjustments should not affect original
		if (cloned.type === 'shape' && cloned.shapeAdjustments) {
			cloned.shapeAdjustments.adj1 = 0;
			expect((el as { shapeAdjustments: Record<string, number> }).shapeAdjustments.adj1).toBe(
				50000,
			);
		}
	});

	it('clones a connector element', () => {
		const el: PptxElement = {
			type: 'connector',
			id: 'c1',
			x: 50,
			y: 50,
			width: 200,
			height: 0,
			shapeStyle: { strokeColor: '#333', strokeWidth: 2 },
		};
		const cloned = cloneElement(el);
		expect(cloned).toStrictEqual(el);
		expect(cloned).not.toBe(el);
	});

	it('clones an image element', () => {
		const el: PptxElement = {
			type: 'image',
			id: 'img1',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
		};
		const cloned = cloneElement(el);
		expect(cloned).toStrictEqual(el);
		expect(cloned).not.toBe(el);
	});

	it('clones an empty chart element', () => {
		const el: PptxElement = {
			type: 'chart',
			id: 'ch1',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
		};
		const cloned = cloneElement(el);
		expect(cloned).toStrictEqual(el);
		expect(cloned).not.toBe(el);
	});

	// A group was copied with `{ ...element }`, sharing the children ARRAY (and
	// every element in it) with the original: mutating a shape inside the copy
	// mutated the source, defeating the undo/redo and clipboard isolation this
	// helper exists for. Nested groups multiply that aliased surface.
	it('deep-clones a nested group instead of aliasing its children', () => {
		const leaf: PptxElement = {
			type: 'shape',
			id: 'leaf',
			x: 1,
			y: 2,
			width: 10,
			height: 10,
		};
		const inner: GroupPptxElement = {
			type: 'group',
			id: 'inner',
			x: 0,
			y: 0,
			width: 20,
			height: 20,
			children: [leaf],
		};
		const outer: GroupPptxElement = {
			type: 'group',
			id: 'outer',
			x: 0,
			y: 0,
			width: 40,
			height: 40,
			children: [inner],
		};

		const cloned = cloneElement(outer);
		expect(cloned).toStrictEqual(outer);
		if (cloned.type !== 'group') {
			throw new Error('expected a group clone');
		}
		const clonedInner = cloned.children[0];
		expect(cloned.children).not.toBe(outer.children);
		expect(clonedInner).not.toBe(inner);
		if (clonedInner.type !== 'group') {
			throw new Error('expected a nested group clone');
		}
		expect(clonedInner.children[0]).not.toBe(leaf);

		clonedInner.children[0].x = 999;
		expect(leaf.x).toBe(1);
	});

	it('clones an unknown element type', () => {
		const el: PptxElement = {
			type: 'unknown',
			id: 'u1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		const cloned = cloneElement(el);
		expect(cloned).toStrictEqual(el);
		expect(cloned).not.toBe(el);
	});
});

// ---------------------------------------------------------------------------
// cloneElement: every variant of the union that owns nested mutable structure
// ---------------------------------------------------------------------------

/**
 * The clone used to `switch` on the `type` discriminant and deep-copy one or
 * two hand-picked fields per branch, so every field nobody remembered stayed
 * SHARED with the source. The `group` branch was fixed on its own, which left
 * the identical defect everywhere else: measured on real fixtures, `table`
 * shared its rows, cells and column widths, `ink` shared its stroke paths,
 * `chart` shared its series and text shared its paragraph indents.
 *
 * This is deliberately one case per variant that owns nested structure, not per
 * bug found, so a variant that grows a new nested field is covered by the shape
 * of the test rather than by anyone remembering to extend it.
 */
interface AliasCase {
	label: string;
	element: PptxElement;
	mutate: (clone: PptxElement) => void;
	read: () => unknown;
}

/** Build a case, narrowing the clone to the same variant as the source. */
function aliasCase<T extends PptxElement>(
	label: string,
	element: T,
	mutate: (clone: T) => void,
	read: (source: T) => unknown,
): AliasCase {
	return {
		label,
		element,
		// `cloneElement` returns the same variant it was handed; the union cannot
		// express that, and the alternative is a `type` re-narrow in every case.
		mutate: (clone) => mutate(clone as unknown as T),
		read: () => read(element),
	};
}

const box = { x: 0, y: 0, width: 10, height: 10 };

const aliasCases: AliasCase[] = [
	aliasCase(
		'text: paragraph indents',
		{ type: 'text', id: 'text', ...box, paragraphIndents: [{ marginLeft: 12, indent: 4 }] },
		(clone) => {
			clone.paragraphIndents![0].marginLeft = 999;
		},
		(source) => source.paragraphIndents,
	),
	aliasCase(
		'shape: adjustment handles and gradient stops',
		{
			type: 'shape',
			id: 'shape',
			...box,
			shapeStyle: { fillGradientStops: [{ position: 0, color: '#FFF' }] },
			adjustmentHandles: [{ name: 'adj', type: 'xy', x: 1, y: 2 }],
		},
		(clone) => {
			clone.shapeStyle!.fillGradientStops![0].color = '#000';
			clone.adjustmentHandles![0].x = 999;
		},
		(source) => [source.shapeStyle, source.adjustmentHandles],
	),
	// A connector carries text properties too, and the old switch grouped it
	// with image/picture, which cloned neither its style nor its segments.
	aliasCase(
		'connector: text segments',
		{
			type: 'connector',
			id: 'connector',
			...box,
			textSegments: [{ text: 'a', style: { bold: true } }],
		},
		(clone) => {
			clone.textSegments![0].style.bold = false;
		},
		(source) => source.textSegments,
	),
	aliasCase(
		'image: shape style',
		{ type: 'image', id: 'image', ...box, shapeStyle: { fillColor: '#123456' } },
		(clone) => {
			clone.shapeStyle!.fillColor = '#000000';
		},
		(source) => source.shapeStyle,
	),
	aliasCase(
		'picture: shape adjustments',
		{ type: 'picture', id: 'picture', ...box, shapeAdjustments: { adj: 1 } },
		(clone) => {
			clone.shapeAdjustments!['adj'] = 999;
		},
		(source) => source.shapeAdjustments,
	),
	aliasCase(
		'table: rows, cells and column widths',
		{
			type: 'table',
			id: 'table',
			...box,
			tableData: {
				rows: [{ cells: [{ text: 'a', style: { bold: true } }] }],
				columnWidths: [1],
			},
		},
		(clone) => {
			clone.tableData!.rows[0].cells[0].text = 'edited';
			clone.tableData!.rows[0].cells[0].style!.bold = false;
			clone.tableData!.columnWidths[0] = 999;
		},
		(source) => source.tableData,
	),
	aliasCase(
		'chart: categories and series values',
		{
			type: 'chart',
			id: 'chart',
			...box,
			chartData: { type: 'bar', categories: ['a'], series: [{ name: 's', values: [1] }] },
		},
		(clone) => {
			clone.chartData!.categories[0] = 'edited';
			clone.chartData!.series[0].values[0] = 999;
		},
		(source) => source.chartData,
	),
	aliasCase(
		'smartArt: nodes',
		{
			type: 'smartArt',
			id: 'smartArt',
			...box,
			smartArtData: { layoutType: 'list', nodes: [{ id: 'n1', text: 'a', level: 0 }] },
		},
		(clone) => {
			clone.smartArtData!.nodes[0].text = 'edited';
		},
		(source) => source.smartArtData,
	),
	aliasCase(
		'ole: preserved graphicFrame extensions',
		{
			type: 'ole',
			id: 'ole',
			...box,
			extensionXml: [{ uri: '{A}', xml: { 'a:ext': { '@_val': '1' } } }],
		},
		(clone) => {
			clone.extensionXml![0].uri = 'edited';
		},
		(source) => source.extensionXml,
	),
	aliasCase(
		'media: bookmarks and caption tracks',
		{
			type: 'media',
			id: 'media',
			...box,
			bookmarks: [{ name: 'b', timeMs: 0 }],
			captionTracks: [{ path: 'c.vtt', language: 'en' }],
		},
		(clone) => {
			clone.bookmarks![0].timeMs = 999;
			clone.captionTracks![0].language = 'de';
		},
		(source) => [source.bookmarks, source.captionTracks],
	),
	aliasCase(
		'group: children and the group fill',
		{
			type: 'group',
			id: 'group',
			...box,
			children: [{ type: 'shape', id: 'child', ...box }],
			groupFill: { fillColor: '#FF0000' },
		},
		(clone) => {
			clone.children[0].x = 999;
			clone.groupFill!.fillColor = '#000000';
		},
		(source) => [source.children, source.groupFill],
	),
	aliasCase(
		'ink: stroke paths and per-point pressures',
		{
			type: 'ink',
			id: 'ink',
			...box,
			inkPaths: ['M0 0 L1 1'],
			inkColors: ['#000'],
			inkPointPressures: [[0.5]],
		},
		(clone) => {
			clone.inkPaths[0] = 'edited';
			clone.inkColors![0] = '#FFF';
			clone.inkPointPressures![0][0] = 1;
		},
		(source) => [source.inkPaths, source.inkColors, source.inkPointPressures],
	),
	aliasCase(
		'contentPart: ink strokes',
		{
			type: 'contentPart',
			id: 'contentPart',
			...box,
			inkStrokes: [{ path: 'M0 0', color: '#000', width: 1, opacity: 1, pressures: [0.5] }],
		},
		(clone) => {
			clone.inkStrokes![0].pressures![0] = 1;
		},
		(source) => source.inkStrokes,
	),
	aliasCase(
		'zoom: summary targets',
		{
			type: 'zoom',
			id: 'zoom',
			...box,
			zoomType: 'summary',
			targetSlideIndex: 0,
			summaryTargets: [
				{ sectionId: 's', targetSlideIndex: 1, x: 0, y: 0, width: 1, height: 1, title: 'a' },
			],
		},
		(clone) => {
			clone.summaryTargets![0].title = 'edited';
		},
		(source) => source.summaryTargets,
	),
	aliasCase(
		'model3d: preserved graphicFrame extensions',
		{ type: 'model3d', id: 'model3d', ...box, extensionXml: [{ uri: '{B}', xml: {} }] },
		(clone) => {
			clone.extensionXml![0].uri = 'edited';
		},
		(source) => source.extensionXml,
	),
	aliasCase(
		'unknown: shape locks and opaque extLst nodes',
		{
			type: 'unknown',
			id: 'unknown',
			...box,
			locks: { noMove: true },
			extLstXml: [{ '@_uri': '{C}' }],
		},
		(clone) => {
			clone.locks!.noMove = false;
			clone.extLstXml![0]['@_uri'] = 'edited';
		},
		(source) => [source.locks, source.extLstXml],
	),
];

describe('cloneElement: nested structure per element variant', () => {
	it.each(aliasCases)('$label is not aliased to the source', ({ element, mutate, read }) => {
		const before = JSON.stringify(read());
		mutate(cloneElement(element));
		expect(JSON.stringify(read())).toBe(before);
	});

	// The one deliberate exception: `rawXml` is the verbatim `<p:sp>` tree kept
	// so save can re-emit markup the typed model does not cover. Nothing edits
	// it in place, and it is by far the largest object on an element, so it is
	// shared rather than rebuilt on every undo snapshot. Any OTHER preserved
	// XML field is small and IS copied (see the `ole` case above).
	it('shares the preserved rawXml tree by reference, on purpose', () => {
		const rawXml: XmlObject = { 'p:sp': { '@_id': '7' } };
		const el: PptxElement = { type: 'shape', id: 'raw', ...box, rawXml };
		expect(cloneElement(el).rawXml).toBe(rawXml);
	});
});

// ---------------------------------------------------------------------------
// cloneSlide
// ---------------------------------------------------------------------------

describe('cloneSlide', () => {
	it('clones a slide with elements, comments, and warnings', () => {
		const slide: PptxSlide = {
			id: 'slide1',
			index: 0,
			elements: [{ type: 'text', id: 't1', x: 0, y: 0, width: 100, height: 50, text: 'Hi' }],
			comments: [{ id: 'c1', author: 'user', text: 'Comment' }],
			warnings: [{ message: 'Warning 1' }],
		} as PptxSlide;
		const cloned = cloneSlide(slide);
		expect(cloned.id).toBe('slide1');
		expect(cloned.elements).toHaveLength(1);
		expect(cloned.elements).not.toBe(slide.elements);
		expect(cloned.comments).not.toBe(slide.comments);
		expect(cloned.warnings).not.toBe(slide.warnings);
	});

	it('handles slides without comments or warnings', () => {
		const slide: PptxSlide = {
			id: 'slide2',
			index: 1,
			elements: [],
		} as PptxSlide;
		const cloned = cloneSlide(slide);
		expect(cloned.comments).toBeUndefined();
		expect(cloned.warnings).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// cloneXmlObject
// ---------------------------------------------------------------------------

describe('cloneXmlObject', () => {
	it('returns undefined for undefined input', () => {
		expect(cloneXmlObject(undefined)).toBeUndefined();
	});

	it('deep-clones a simple XML object', () => {
		const obj: XmlObject = { '@_id': '1', child: { '@_name': 'test' } };
		const cloned = cloneXmlObject(obj);
		expect(cloned).toStrictEqual(obj);
		expect(cloned).not.toBe(obj);
	});

	it('deep-clones nested arrays', () => {
		const obj: XmlObject = {
			items: [{ '@_val': 'a' }, { '@_val': 'b' }],
		};
		const cloned = cloneXmlObject(obj)!;
		expect(cloned).toStrictEqual(obj);
		expect(cloned['items']).not.toBe(obj['items']);
	});

	it('mutations on clone do not affect original', () => {
		const obj: XmlObject = { 'a:sp': { '@_id': '42' } };
		const cloned = cloneXmlObject(obj)!;
		(cloned['a:sp'] as XmlObject)['@_id'] = '99';
		expect((obj['a:sp'] as XmlObject)['@_id']).toBe('42');
	});
});
