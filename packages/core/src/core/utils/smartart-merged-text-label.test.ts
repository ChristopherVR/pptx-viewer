/**
 * Label colour of a cached SmartArt shape whose text PowerPoint draws from a
 * separate `tx`-algorithm presentation point (Basic Pyramid's `levelTx`,
 * Basic Venn's `circNTx`, both `revTx`), against the 3D parity ground-truth
 * deck `e2e/fixtures/three-d-parity/three-d-smartart.pptx` (slide n = layout
 * floor((n-1)/14), quick style ((n-1)%14)+1; PowerPoint's own export in
 * `gt/sa-NNN.webp`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../PptxHandler';
import type {
	PptxData,
	PptxSmartArtConnection,
	PptxSmartArtData,
	PptxSmartArtLayoutDefinition,
	SmartArtPptxElement,
	XmlObject,
} from '../types';
import {
	resolveSmartArtMergedTextColors,
	resolveSmartArtMergedTextLabels,
} from './smartart-merged-text-label';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

let deck: Promise<PptxData> | undefined;

function loadDeck(): Promise<PptxData> {
	deck ??= (async () => {
		const bytes = readFileSync(fixture);
		return new PptxHandler().load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
	})();
	return deck;
}

async function smartArtOn(slideNumber: number): Promise<PptxSmartArtData> {
	const data = await loadDeck();
	const element = data.slides[slideNumber - 1].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element?.smartArtData) {
		throw new Error(`slide ${slideNumber} has no smartArt element`);
	}
	return element.smartArtData;
}

const localName = (key: string) => key.replace(/^.*:/u, '');

function pres(id: string, presName: string, presAssocID: string, presStyleLbl?: string): XmlObject {
	return {
		'@_modelId': id,
		'@_type': 'pres',
		'dgm:prSet': {
			'@_presName': presName,
			'@_presAssocID': presAssocID,
			...(presStyleLbl ? { '@_presStyleLbl': presStyleLbl } : {}),
		},
	};
}

function cxn(type: string, sourceId: string, destId: string): PptxSmartArtConnection {
	return { type, sourceId, destId };
}

/** A pyramid-shaped layout: composite `item` holding shape `level` + text `levelTx`. */
const layout: PptxSmartArtLayoutDefinition = {
	rootNode: {
		name: 'root',
		algorithm: { type: 'pyra' },
		children: [
			{
				name: 'item',
				algorithm: { type: 'composite' },
				children: [
					{ name: 'level', algorithm: { type: 'sp' } },
					{ name: 'levelTx', styleLabel: 'revTx', algorithm: { type: 'tx' } },
					{ name: 'connector', algorithm: { type: 'sp' } },
				],
			},
		],
	},
};

const points = [
	pres('p-item', 'item', 'n1'),
	pres('p-level', 'level', 'n1', 'node1'),
	pres('p-text', 'levelTx', 'n1', 'revTx'),
	pres('p-conn', 'connector', 'n1', 'node2'),
];

const connections = [
	cxn('presParOf', 'p-item', 'p-level'),
	cxn('presParOf', 'p-item', 'p-text'),
	cxn('presParOf', 'p-item', 'p-conn'),
	cxn('presOf', 'n1', 'p-level'),
	cxn('presOf', 'n1', 'p-text'),
	cxn('presOf', 'n1', 'p-conn'),
];

describe('resolveSmartArtMergedTextLabels', () => {
	it("maps a shape point to its tx-algorithm sibling's style label", () => {
		const labels = resolveSmartArtMergedTextLabels(points, connections, layout, localName);
		expect(labels.get('p-level')).toStrictEqual({
			styleLabel: 'revTx',
			styleIndex: 0,
			textPointId: 'p-text',
		});
		// A decorative `sp` sibling is also a shape point, so it maps too; the
		// text point itself never does.
		expect(labels.has('p-text')).toBeFalsy();
	});

	it('ignores a text sibling that shares the shape label or presents another node', () => {
		const sameLabel = points.map((pt) =>
			pt['@_modelId'] === 'p-text' ? pres('p-text', 'levelTx', 'n1', 'node1') : pt,
		);
		const ownLabels = resolveSmartArtMergedTextLabels(sameLabel, connections, layout, localName);
		expect(ownLabels.has('p-level')).toBeFalsy();
		const otherNode = points.map((pt) =>
			pt['@_modelId'] === 'p-text' ? pres('p-text', 'levelTx', 'n2', 'revTx') : pt,
		);
		const otherLabels = resolveSmartArtMergedTextLabels(otherNode, connections, layout, localName);
		expect(otherLabels.has('p-level')).toBeFalsy();
	});

	it('needs the layout definition to tell a text node from a shape node', () => {
		expect(resolveSmartArtMergedTextLabels(points, connections, undefined, localName).size).toBe(0);
	});

	it("colours the shape from the text label's txFillClrLst, indexed by presStyleIdx", () => {
		const colors = resolveSmartArtMergedTextColors(
			points,
			connections,
			layout,
			{ revTx: { textFill: ['#000000'] }, node1: {} },
			localName,
		);
		expect(colors.get('p-level')).toBe('#000000');
		// No txFillClrLst for the label: the cached fontRef stands.
		expect(
			resolveSmartArtMergedTextColors(points, connections, layout, { revTx: {} }, localName).size,
		).toBe(0);
	});
});

describe('merged text label colour on the ground-truth deck', () => {
	it('draws every Basic Pyramid tier label in revTx tx1 (black), whatever the quick style', async () => {
		for (let slide = 57; slide <= 70; slide++) {
			const data = await smartArtOn(slide);
			expect(data.colorTransform?.roleColors?.revTx?.textFill).toStrictEqual(['#000000']);
			const colors = (data.drawingShapes ?? []).map((shape) => shape.fontColor?.toUpperCase());
			expect(colors, `slide ${slide}`).toStrictEqual(['#000000', '#000000', '#000000', '#000000']);
		}
	}, 60000);

	it('leaves every other layout on its cached fontRef colour', async () => {
		// Basic Venn already caches tx1; Block List lt1; Metallic Scene dk1.
		const venn = await smartArtOn(71);
		expect(venn.drawingShapes?.every((s) => s.fontColor?.toUpperCase() === '#000000')).toBeTruthy();
		const blockList = await smartArtOn(1);
		expect(blockList.drawingShapes?.[0]?.fontColor?.toUpperCase()).toBe('#FFFFFF');
		const metallic = await smartArtOn(12);
		expect(metallic.drawingShapes?.[0]?.fontColor?.toUpperCase()).toBe('#000000');
		// Organization Chart's hidden `rootConnector` runs `sp`, not `tx`.
		const orgChart = await smartArtOn(43);
		const labelled = (orgChart.drawingShapes ?? []).filter((s) => s.text);
		expect(labelled.every((s) => s.fontColor?.toUpperCase() === '#FFFFFF')).toBeTruthy();
	}, 60000);
});
