/**
 * Fidelity corpus - representative DiagramML layout definitions + data nodes.
 *
 * Each builder authors a faithful `dgm:layoutDef` fragment as an `XmlObject`
 * (the same shape fast-xml-parser emits for a real Office built-in) and runs it
 * through the production `parseSmartArtLayoutDefinition` parser, so the fidelity
 * tests exercise the interpreter against the *real parse path* rather than
 * hand-built typed objects. Attribute values are strings, exactly as they arrive
 * from XML. Pure data; no framework code, no DOM.
 */

import type { PptxSmartArtLayoutDefinition, PptxSmartArtNode, XmlObject } from 'pptx-viewer-core';
import { parseSmartArtLayoutDefinition } from 'pptx-viewer-core';

import type {
	RenderedCircleNode,
	RenderedNode,
	RenderedPolygonNode,
	RenderedRectNode,
} from './smartart-layout-types';

export const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'];
export const BOX = { width: 400, height: 300 } as const;
export const STYLE = 'flat' as const;
export const ID = 'fx1';

const localName = (key: string): string => key.split(':').pop() ?? key;

/** Parse a DiagramML CT_DiagramDefinition XmlObject into the typed model. */
export function parseDef(xml: XmlObject): PptxSmartArtLayoutDefinition {
	const def = parseSmartArtLayoutDefinition(xml, localName);
	if (!def) {
		throw new Error('fidelity fixture layoutDef failed to parse');
	}
	return def;
}

/** A `dgm:constr` with a `fact` of a referenced dimension. */
function factConstr(type: string, refType: string, fact: number): XmlObject {
	return { '@_type': type, '@_refType': refType, '@_fact': String(fact) };
}

/** A `dgm:alg` element with typed `dgm:param`s. */
function alg(type: string, params: ReadonlyArray<[string, string]> = []): XmlObject {
	const base: XmlObject = { '@_type': type };
	if (params.length > 0) {
		base['dgm:param'] = params.map(([t, v]) => ({ '@_type': t, '@_val': v }));
	}
	return base;
}

/** Wrap the per-point item `layoutNode` in a `dgm:forEach`, as built-ins do. */
function forEachItem(item: XmlObject): XmlObject {
	return { '@_name': 'items', '@_axis': 'ch', '@_ptType': 'node', 'dgm:layoutNode': item };
}

/** Assemble a CT_DiagramDefinition around a single root `layoutNode`. */
function layoutDef(uniqueId: string, title: string, root: XmlObject): XmlObject {
	return {
		'@_uniqueId': uniqueId,
		'dgm:title': { '@_lang': 'en-US', '@_val': title },
		'dgm:layoutNode': root,
	};
}

/** Basic Process (`lin`, left-to-right) with a sibSp gap + item aspect. */
export function linearDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:basicProcess', 'Basic Process', {
			'@_name': 'Name0',
			'dgm:alg': alg('lin', [['linDir', 'fromL']]),
			'dgm:constrLst': { 'dgm:constr': [factConstr('sibSp', 'w', 0.15)] },
			'dgm:forEach': forEachItem({
				'@_name': 'node',
				'dgm:alg': alg('tx'),
				'dgm:constrLst': { 'dgm:constr': [factConstr('h', 'w', 0.6)] },
			}),
		}),
	);
}

/** Vertical list (`lin`, top-to-bottom) - stacks the points in a column. */
export function verticalListDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:verticalList', 'Vertical List', {
			'@_name': 'Name0',
			'dgm:alg': alg('lin', [['linDir', 'fromT']]),
			'dgm:constrLst': { 'dgm:constr': [factConstr('sibSp', 'h', 0.2)] },
			'dgm:forEach': forEachItem({ '@_name': 'node', 'dgm:alg': alg('tx') }),
		}),
	);
}

/** Basic Cycle (`cycle`, full 360 span from the top). */
export function cycleDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:basicCycle', 'Basic Cycle', {
			'@_name': 'Name0',
			'dgm:alg': alg('cycle', [
				['stAng', '0'],
				['spanAng', '360'],
			]),
			'dgm:forEach': forEachItem({ '@_name': 'node', 'dgm:alg': alg('tx') }),
		}),
	);
}

/** Half-cycle (`cycle`, 180 span) - an open arc. */
export function halfCycleDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:halfCycle', 'Half Cycle', {
			'@_name': 'Name0',
			'dgm:alg': alg('cycle', [['spanAng', '180']]),
			'dgm:forEach': forEachItem({ '@_name': 'node', 'dgm:alg': alg('tx') }),
		}),
	);
}

/** Basic Pyramid (`pyra`) with a small band gap. */
export function pyramidDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:basicPyramid', 'Basic Pyramid', {
			'@_name': 'Name0',
			'dgm:alg': alg('pyra'),
			'dgm:constrLst': { 'dgm:constr': [factConstr('sibSp', 'h', 0.05)] },
			'dgm:forEach': forEachItem({ '@_name': 'node', 'dgm:alg': alg('tx') }),
		}),
	);
}

/** Snake / basic-block-list (`snake`) - wraps points into a grid. */
export function snakeDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:snake', 'Snake Process', {
			'@_name': 'Name0',
			'dgm:alg': alg('snake'),
			'dgm:constrLst': { 'dgm:constr': [factConstr('sibSp', 'w', 0.1)] },
			'dgm:forEach': forEachItem({ '@_name': 'node', 'dgm:alg': alg('tx') }),
		}),
	);
}

/** Organisation Chart (`hierRoot` + `hierChild`). */
export function hierarchyDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:orgChart', 'Organization Chart', {
			'@_name': 'hierRoot',
			'dgm:alg': alg('hierRoot'),
			'dgm:forEach': forEachItem({
				'@_name': 'hierChild',
				'dgm:alg': alg('hierChild'),
			}),
		}),
	);
}

/** Composite (`composite`) - two side-by-side half-width slots. */
export function compositeDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:composite', 'Composite Pair', {
			'@_name': 'Name0',
			'dgm:alg': alg('composite'),
			'dgm:layoutNode': [
				{
					'@_name': 'left',
					'dgm:alg': alg('sp'),
					'dgm:constrLst': {
						'dgm:constr': [
							factConstr('l', 'w', 0),
							factConstr('t', 'h', 0),
							factConstr('w', 'w', 0.5),
							factConstr('h', 'h', 1),
						],
					},
				},
				{
					'@_name': 'right',
					'dgm:alg': alg('tx'),
					'dgm:constrLst': {
						'dgm:constr': [
							factConstr('l', 'w', 0.5),
							factConstr('t', 'h', 0),
							factConstr('w', 'w', 0.5),
							factConstr('h', 'h', 1),
						],
					},
				},
			],
		}),
	);
}

/**
 * Connector process (`conn`) - flow points joined by drawn connectors.
 *
 * The root arranger is `conn` so the interpreter declines (returns `undefined`)
 * until a sibling agent teaches `discoverArrangement` the `conn` family; at that
 * point the gated fidelity assertions in the integration suite activate.
 */
export function connDef(): PptxSmartArtLayoutDefinition {
	return parseDef(
		layoutDef('urn:fidelity:conn', 'Connected Process', {
			'@_name': 'Name0',
			'dgm:alg': alg('conn', [['linDir', 'fromL']]),
			'dgm:forEach': forEachItem({ '@_name': 'node', 'dgm:alg': alg('tx') }),
		}),
	);
}

/** `count` flat content nodes with ids "1".."count". */
export function contentNodes(count: number): PptxSmartArtNode[] {
	return Array.from({ length: count }, (_, i) => ({ id: String(i + 1), text: `Node ${i + 1}` }));
}

/** One root with `count - 1` children (a single-level org tree of `count` nodes). */
export function oneLevelTree(count: number): PptxSmartArtNode[] {
	const children = Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({
		id: String(i + 2),
		text: `Child ${i + 1}`,
		parentId: '1',
	}));
	return [{ id: '1', text: 'Root', children }];
}

export const rectsOf = (nodes: readonly RenderedNode[]): RenderedRectNode[] =>
	nodes.filter((node): node is RenderedRectNode => node.kind === 'rect');
export const circlesOf = (nodes: readonly RenderedNode[]): RenderedCircleNode[] =>
	nodes.filter((node): node is RenderedCircleNode => node.kind === 'circle');
export const polygonsOf = (nodes: readonly RenderedNode[]): RenderedPolygonNode[] =>
	nodes.filter((node): node is RenderedPolygonNode => node.kind === 'polygon');
