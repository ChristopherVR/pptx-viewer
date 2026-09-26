/**
 * The style label of the text a cached SmartArt drawing shape shows when that
 * text comes from a separate, geometry-less presentation point.
 *
 * Some layouts split one data node into a shape node and a text node: Basic
 * Pyramid presents each tier as `level` (a `trapezoid`, style label `node1`)
 * plus `levelTx` (a hidden-geometry `rect` with a `tx` algorithm, style label
 * `revTx`); Basic Venn pairs `circN` (`vennNode1`) with `circNTx` (`revTx`).
 * PowerPoint caches ONE drawing shape for the pair (the shape node's
 * `modelId`, carrying the text node's `txXfrm`), and its `dsp:style/a:fontRef`
 * is the shape label's (`lt1` for the pyramid). What PowerPoint actually draws
 * is the TEXT node's colour: the colour transform's `txFillClrLst` for
 * `revTx` (`tx1`), so the pyramid's labels are black.
 *
 * This resolves, for every shape presentation point with such a text sibling,
 * that sibling's style label. A sibling is a presentation point under the same
 * `presParOf` parent, presenting the same data node (`presAssocID`), whose
 * layout node runs the `tx` algorithm, with a label different from the
 * shape's. Anything else (org chart's hidden `rootConnector` points run `sp`,
 * a connector's own `connectorText` shares its label) is left alone.
 *
 * @module smartart-merged-text-label
 */

import type {
	PptxSmartArtConnection,
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	XmlObject,
} from '../types';

type LocalName = (key: string) => string;

/** A text node's style label and its position in that label's colour list. */
export interface SmartArtMergedTextLabel {
	/** The text presentation point's `presStyleLbl` (e.g. `revTx`). */
	styleLabel: string;
	/** Its `presStyleIdx` (0 when absent), which indexes the label's colour list. */
	styleIndex: number;
	/** The text presentation point's `modelId`. */
	textPointId: string;
}

interface PresPoint {
	id: string;
	name: string;
	styleLabel: string;
	styleIndex: number;
	assocId: string;
}

function prSetOf(pt: XmlObject, localName: LocalName): XmlObject | undefined {
	const key = Object.keys(pt).find((candidate) => localName(candidate) === 'prSet');
	const value = key ? pt[key] : undefined;
	return (Array.isArray(value) ? value[0] : value) as XmlObject | undefined;
}

function readPresPoints(points: XmlObject[], localName: LocalName): Map<string, PresPoint> {
	const byId = new Map<string, PresPoint>();
	for (const pt of points) {
		if (!pt || typeof pt !== 'object' || String(pt['@_type'] ?? '').trim() !== 'pres') {
			continue;
		}
		const id = String(pt['@_modelId'] ?? '').trim();
		const prSet = prSetOf(pt, localName);
		if (!id || !prSet) {
			continue;
		}
		const styleIndex = Number(prSet['@_presStyleIdx'] ?? 0);
		byId.set(id, {
			id,
			name: String(prSet['@_presName'] ?? '').trim(),
			styleLabel: String(prSet['@_presStyleLbl'] ?? '').trim(),
			styleIndex: Number.isFinite(styleIndex) && styleIndex > 0 ? Math.floor(styleIndex) : 0,
			assocId: String(prSet['@_presAssocID'] ?? '').trim(),
		});
	}
	return byId;
}

/** `layoutNode/@name -> alg/@type` over the whole (flattened) layout tree. */
function algorithmByLayoutNodeName(root: PptxSmartArtLayoutNode | undefined): Map<string, string> {
	const byName = new Map<string, string>();
	const stack = root ? [root] : [];
	while (stack.length > 0) {
		const node = stack.pop() as PptxSmartArtLayoutNode;
		if (node.name && node.algorithm?.type && !byName.has(node.name)) {
			byName.set(node.name, node.algorithm.type);
		}
		stack.push(...(node.children ?? []));
	}
	return byName;
}

/**
 * Resolve `shape presentation point id -> merged text label` for every shape
 * point whose text PowerPoint draws from a separate `tx`-algorithm sibling.
 *
 * @param points      Every parsed `dgm:pt` (pres points included).
 * @param connections Parsed `dgm:cxn` list (`presOf` / `presParOf` used).
 * @param layout      The parsed layout definition (for each node's algorithm).
 * @param localName   Local-name resolver for prefixed XML keys.
 */
export function resolveSmartArtMergedTextLabels(
	points: XmlObject[],
	connections: PptxSmartArtConnection[],
	layout: PptxSmartArtLayoutDefinition | undefined,
	localName: LocalName,
): Map<string, SmartArtMergedTextLabel> {
	const result = new Map<string, SmartArtMergedTextLabel>();
	const algorithms = algorithmByLayoutNodeName(layout?.rootNode);
	const presPoints = readPresPoints(points, localName);
	if (algorithms.size === 0 || presPoints.size === 0) {
		return result;
	}
	const presented = new Set<string>();
	const childrenByParent = new Map<string, string[]>();
	for (const connection of connections) {
		if (connection.type === 'presOf') {
			presented.add(connection.destId);
		} else if (connection.type === 'presParOf') {
			const siblings = childrenByParent.get(connection.sourceId) ?? [];
			siblings.push(connection.destId);
			childrenByParent.set(connection.sourceId, siblings);
		}
	}
	for (const siblingIds of childrenByParent.values()) {
		const siblings = siblingIds
			.map((id) => presPoints.get(id))
			.filter((pt): pt is PresPoint => Boolean(pt?.styleLabel && presented.has(pt.id)));
		const texts = siblings.filter((pt) => algorithms.get(pt.name) === 'tx');
		for (const shape of siblings) {
			if (algorithms.get(shape.name) === 'tx' || result.has(shape.id)) {
				continue;
			}
			const text = texts.find(
				(pt) => pt.assocId === shape.assocId && pt.styleLabel !== shape.styleLabel,
			);
			if (text) {
				result.set(shape.id, {
					styleLabel: text.styleLabel,
					styleIndex: text.styleIndex,
					textPointId: text.id,
				});
			}
		}
	}
	return result;
}

/**
 * The colour a merged text label draws in: its colour-transform label's
 * `txFillClrLst` entry at the text point's style index (lists repeat), or
 * `undefined` when that list is empty (the cached `fontRef` then stands).
 */
export function smartArtMergedTextColor(
	label: SmartArtMergedTextLabel,
	textFillByLabel: Record<string, { textFill?: string[] }> | undefined,
): string | undefined {
	const list = textFillByLabel?.[label.styleLabel]?.textFill;
	if (!list || list.length === 0) {
		return undefined;
	}
	return list[label.styleIndex % list.length];
}

/**
 * `shape presentation point id -> label colour` for every cached shape whose
 * text PowerPoint draws in a merged text node's colour. Empty when the colour
 * transform gives none of those labels a `txFillClrLst`.
 */
export function resolveSmartArtMergedTextColors(
	points: XmlObject[],
	connections: PptxSmartArtConnection[],
	layout: PptxSmartArtLayoutDefinition | undefined,
	textFillByLabel: Record<string, { textFill?: string[] }> | undefined,
	localName: LocalName,
): Map<string, string> {
	const colors = new Map<string, string>();
	if (!textFillByLabel) {
		return colors;
	}
	for (const [shapeId, label] of resolveSmartArtMergedTextLabels(
		points,
		connections,
		layout,
		localName,
	)) {
		const color = smartArtMergedTextColor(label, textFillByLabel);
		if (color) {
			colors.set(shapeId, color);
		}
	}
	return colors;
}
