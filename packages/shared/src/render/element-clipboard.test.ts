import JSZip from 'jszip';
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	PptxHandler,
	makeStoreAwareId,
	reassignDescendantIds as coreReassignDescendantIds,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildElementClipboardPayload,
	cloneElementForPaste,
	deserializeElementClipboard,
	ELEMENT_CLIPBOARD_MARKER,
	ELEMENT_CLIPBOARD_MIME_TYPE,
	ELEMENT_CLIPBOARD_VERSION,
	generateElementId,
	makeCloneId,
	PASTE_OFFSET_PX,
	prepareElementsForPaste,
	reassignDescendantIds,
	serializeElementClipboard,
} from './element-clipboard';
import { prepareElementForInsertion } from './element-insertion';

function makeElement(overrides: Partial<PptxElement> & { id: string }): PptxElement {
	return {
		type: 'shape',
		x: 100,
		y: 200,
		width: 50,
		height: 60,
		...overrides,
	} as PptxElement;
}

/** A group holding a nested group, as a real `p:grpSp` inside `p:grpSp` loads. */
function nestedGroup(rootId = 'g-outer'): PptxElement {
	return {
		type: 'group',
		id: rootId,
		x: 10,
		y: 20,
		width: 100,
		height: 100,
		children: [
			{
				type: 'group',
				id: 'g-inner',
				x: 0,
				y: 0,
				width: 50,
				height: 50,
				children: [makeElement({ id: 'leaf' })],
			},
			makeElement({ id: 'sibling' }),
		],
	} as unknown as PptxElement;
}

/** Every id in an element subtree, depth first. */
function collectIds(element: PptxElement): string[] {
	const ids = [element.id];
	if (element.type === 'group') {
		for (const child of element.children) {
			ids.push(...collectIds(child));
		}
	}
	return ids;
}

function connectedGroup(): PptxElement {
	return {
		type: 'group',
		id: 'group',
		shapeId: '10',
		name: 'Connected group',
		x: 60,
		y: 80,
		width: 400,
		height: 100,
		children: [
			{
				type: 'shape',
				id: 'left',
				shapeId: '11',
				name: 'Left',
				shapeType: 'rect',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			},
			{
				type: 'shape',
				id: 'right',
				shapeId: '12',
				name: 'Right',
				shapeType: 'rect',
				x: 300,
				y: 0,
				width: 100,
				height: 100,
			},
			{
				type: 'connector',
				id: 'line',
				shapeId: '13',
				name: 'Connection',
				shapeType: 'straightConnector1',
				x: 100,
				y: 50,
				width: 200,
				height: 0,
				shapeStyle: {
					connectorStartConnection: { shapeId: 'left', connectionSiteIndex: 3 },
					connectorEndConnection: { shapeId: 'right', connectionSiteIndex: 1 },
				},
			},
		],
	};
}

describe('cloned connected groups', () => {
	it('points typed connector references at the cloned children', () => {
		const source = connectedGroup();
		const clone = cloneElementForPaste(source);
		if (clone.type !== 'group') {
			throw new Error('expected cloned group');
		}
		const connector = clone.children.find((element) => element.type === 'connector');
		expect(connector?.shapeStyle?.connectorStartConnection?.shapeId).toBe(clone.children[0].id);
		expect(connector?.shapeStyle?.connectorEndConnection?.shapeId).toBe(clone.children[1].id);
	});

	it('handles connector-before-target nesting, native references, and external references', () => {
		const source = connectedGroup();
		if (source.type !== 'group') {
			throw new Error('expected group');
		}
		const [left, right, connector] = source.children;
		if (connector.type !== 'connector' || !connector.shapeStyle) {
			throw new Error('expected connector');
		}
		connector.shapeStyle.connectorStartConnection = { shapeId: '11', connectionSiteIndex: 3 };
		connector.shapeStyle.connectorEndConnection = { shapeId: 'outside', connectionSiteIndex: 7 };
		source.children = [
			connector,
			{ type: 'group', id: 'nested', x: 0, y: 0, width: 400, height: 100, children: [left, right] },
		];
		const original = structuredClone(source);
		const clone = cloneElementForPaste(source, { intoTemplate: true });
		if (
			clone.type !== 'group' ||
			clone.children[0].type !== 'connector' ||
			clone.children[1].type !== 'group'
		) {
			throw new Error('expected nested connected group');
		}
		expect(clone.children[0].shapeStyle?.connectorStartConnection).toStrictEqual({
			shapeId: clone.children[1].children[0].id,
			connectionSiteIndex: 3,
		});
		expect(clone.children[0].shapeStyle?.connectorEndConnection).toStrictEqual({
			shapeId: 'outside',
			connectionSiteIndex: 7,
		});
		expect(clone.children[1].children[0].shapeId).toBeUndefined();
		expect(collectIds(clone).every((id) => id.startsWith('layout-el-'))).toBeTruthy();
		expect(source).toStrictEqual(original);
	});

	it.each([false, true])(
		'keeps loaded cloned bindings on save with pasted-first=%s',
		async (pastedFirst) => {
			const created = await PptxHandler.create({ initialSlideCount: 1 });
			const source = connectedGroup();
			if (source.type !== 'group') {
				throw new Error('expected group');
			}
			const connector = source.children.find((element) => element.type === 'connector');
			if (!connector?.shapeStyle) {
				throw new Error('expected connector style');
			}
			connector.shapeStyle.connectorStartConnection = { shapeId: '11', connectionSiteIndex: 3 };
			connector.shapeStyle.connectorEndConnection = { shapeId: '12', connectionSiteIndex: 1 };
			created.data.slides[0].elements = [source];
			const original = await created.handler.save(created.data.slides);
			const handler = new PptxHandler();
			const reloader = new PptxHandler();
			try {
				const loaded = await handler.load(
					original.buffer.slice(
						original.byteOffset,
						original.byteOffset + original.byteLength,
					) as ArrayBuffer,
				);
				const originalGroup = loaded.slides[0].elements.find((element) => element.type === 'group');
				if (!originalGroup) {
					throw new Error('expected loaded group');
				}
				const originalConnector = originalGroup.children.find(
					(element) => element.type === 'connector',
				);
				expect(originalConnector?.shapeStyle?.connectorStartConnection?.shapeId).toBe(
					originalGroup.children[0].shapeId,
				);
				const unchanged = await handler.save(loaded.slides);
				await expect(
					(await JSZip.loadAsync(unchanged)).file('ppt/slides/slide1.xml')?.async('string'),
				).resolves.toBe(
					await (await JSZip.loadAsync(original)).file('ppt/slides/slide1.xml')?.async('string'),
				);
				const clone = cloneElementForPaste(originalGroup);
				clone.name = 'Pasted group';
				loaded.slides[0].elements.push({
					type: 'connector',
					id: 'outside',
					name: 'Outside connection',
					x: 0,
					y: 0,
					width: 60,
					height: 80,
					shapeStyle: {
						connectorEndConnection: { shapeId: originalGroup.id, connectionSiteIndex: 0 },
					},
				});
				if (pastedFirst) {
					loaded.slides[0].elements.unshift(clone);
				} else {
					loaded.slides[0].elements.push(clone);
				}
				const saved = await handler.save(loaded.slides);
				const reloaded = await reloader.load(
					saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
				);
				const pasted = reloaded.slides[0].elements.find(
					(element) => element.name === 'Pasted group',
				);
				if (pasted?.type !== 'group') {
					throw new Error('expected saved pasted group');
				}
				const pastedConnector = pasted.children.find((element) => element.type === 'connector');
				expect(pastedConnector?.shapeStyle?.connectorStartConnection?.shapeId).toBe(
					pasted.children[0].shapeId,
				);
				expect(pastedConnector?.shapeStyle?.connectorEndConnection?.shapeId).toBe(
					pasted.children[1].shapeId,
				);
				const kept = reloaded.slides[0].elements.find(
					(element) => element.name === 'Connected group',
				);
				if (kept?.type !== 'group') {
					throw new Error('expected original group');
				}
				expect(kept.children[0].shapeId).toBe(originalGroup.children[0].shapeId);
				expect(kept.shapeId).toBe(originalGroup.shapeId);
				const outside = reloaded.slides[0].elements.find(
					(element) => element.name === 'Outside connection',
				);
				expect(
					outside?.type === 'connector' && outside.shapeStyle?.connectorEndConnection?.shapeId,
				).toBe(kept.shapeId);
				expect(pasted.children[0].shapeId).not.toBe(kept.children[0].shapeId);
				const repeated = await handler.save(loaded.slides);
				await expect(
					(await JSZip.loadAsync(repeated)).file('ppt/slides/slide1.xml')?.async('string'),
				).resolves.toBe(
					await (await JSZip.loadAsync(saved)).file('ppt/slides/slide1.xml')?.async('string'),
				);
			} finally {
				created.handler.dispose();
				handler.dispose();
				reloader.dispose();
			}
		},
	);
});

describe('prepareElementForInsertion', () => {
	const target = {
		canEdit: true,
		mode: 'edit' as const,
		hasActiveSlide: true,
		editTemplateMode: false,
	};

	it.each([
		{ canEdit: false },
		{ mode: 'preview' as const },
		{ mode: 'present' as const },
		{ mode: 'master' as const },
		{ hasActiveSlide: false },
		{ editTemplateMode: true },
	])('does not prepare an element for an unavailable target %j', (overrides) => {
		expect(prepareElementForInsertion(nestedGroup(), { ...target, ...overrides })).toBeUndefined();
	});

	it('preserves geometry and opaque XML while isolating every descendant', () => {
		const source = nestedGroup();
		source.rawXml = { 'p:sp': { '@_relationship': 'rIdForeign' } };
		const original = structuredClone(source);
		const first = prepareElementForInsertion(source, target)!;
		const second = prepareElementForInsertion(source, target)!;
		expect([first.x, first.y, first.width, first.height]).toStrictEqual([10, 20, 100, 100]);
		expect(first.rawXml).toStrictEqual(source.rawXml);
		expect(first.rawXml).not.toBe(source.rawXml);
		const ids = [...collectIds(source), ...collectIds(first), ...collectIds(second)];
		expect(new Set(ids).size).toBe(ids.length);
		if (first.type === 'group') {
			first.children[0].width = 200;
		}
		expect(source).toStrictEqual(original);
	});
});

// The clipboard used to carry its own copies of these two, so a paste and a
// duplicate/ungroup could drift apart in how they mint ids. Core owns them now;
// identity is the only assertion that can prove the copies are really gone.
describe("id minting is core's, not a private copy", () => {
	it('exports core makeStoreAwareId as makeCloneId', () => {
		expect(makeCloneId).toBe(makeStoreAwareId);
	});

	it('exports core reassignDescendantIds verbatim', () => {
		expect(reassignDescendantIds).toBe(coreReassignDescendantIds);
	});
});

describe('generateElementId / makeCloneId', () => {
	it('generates unique el- prefixed ids', () => {
		const a = generateElementId();
		const b = generateElementId();
		expect(a).toMatch(/^el-\d+-[a-z0-9]+$/);
		expect(a).not.toBe(b);
	});

	// Ids minted in one tick share the timestamp, so the random suffix is all
	// that separates them. A four-digit suffix produced ~46 duplicates per 1000,
	// and a duplicate element id becomes a duplicate `p:cNvPr/@id` on save, which
	// makes an animation's `p:spTgt/@spid` name two shapes at once.
	it('stays unique across a burst of ids minted in the same millisecond', () => {
		const ids = new Set<string>();
		for (let index = 0; index < 5000; index++) {
			ids.add(generateElementId());
		}
		expect(ids.size).toBe(5000);
	});

	it('keeps the master- prefix when cloning into the template store', () => {
		expect(makeCloneId(true, 'master-shape-1')).toMatch(/^master-el-/);
	});

	it('uses the layout- prefix for non-master template sources', () => {
		expect(makeCloneId(true, 'layout-shape-1')).toMatch(/^layout-el-/);
		expect(makeCloneId(true, 'el-123')).toMatch(/^layout-el-/);
	});

	it('generates a plain id outside template mode', () => {
		expect(makeCloneId(false, 'master-shape-1')).toMatch(/^el-/);
	});
});

describe('buildElementClipboardPayload', () => {
	it('deep-clones the element so later edits do not mutate the clipboard', () => {
		const element = makeElement({ id: 'a', textStyle: { color: '#112233' } });
		const payload = buildElementClipboardPayload(element, false);
		(element as { textStyle?: { color?: string } }).textStyle!.color = '#ffffff';
		expect((payload.element as { textStyle?: { color?: string } }).textStyle?.color).toBe(
			'#112233',
		);
		expect(payload.isTemplate).toBeFalsy();
	});

	it('records template origin', () => {
		const payload = buildElementClipboardPayload(makeElement({ id: 'layout-a' }), true);
		expect(payload.isTemplate).toBeTruthy();
	});
});

describe('cloneElementForPaste', () => {
	it('assigns a fresh id and applies the default paste offset', () => {
		const source = makeElement({ id: 'a' });
		const clone = cloneElementForPaste(source);
		expect(clone.id).not.toBe('a');
		expect(clone.id).toMatch(/^el-/);
		expect(clone.x).toBe(100 + PASTE_OFFSET_PX);
		expect(clone.y).toBe(200 + PASTE_OFFSET_PX);
		// Source untouched.
		expect(source.x).toBe(100);
		expect(source.id).toBe('a');
	});

	it('honours custom offsets and template routing', () => {
		const clone = cloneElementForPaste(makeElement({ id: 'master-a' }), {
			intoTemplate: true,
			offsetX: 0,
			offsetY: 5,
		});
		expect(clone.id).toMatch(/^master-el-/);
		expect(clone.x).toBe(100);
		expect(clone.y).toBe(205);
	});

	// Only the ROOT used to be re-ided, so pasting a group put a second copy of
	// every id inside it on the slide. Those ids are written out as
	// `p:cNvPr/@id`, and an animation's `p:spTgt/@spid` then names two shapes.
	it('gives every descendant of a pasted group a fresh, unique id', () => {
		const source = nestedGroup();
		const clone = cloneElementForPaste(source);

		const cloneIds = collectIds(clone);
		const sourceIds = collectIds(source);
		expect(new Set(cloneIds).size).toBe(cloneIds.length);
		expect(cloneIds.some((id) => sourceIds.includes(id))).toBeFalsy();
		// Source tree untouched.
		expect(sourceIds).toStrictEqual(['g-outer', 'g-inner', 'leaf', 'sibling']);
	});

	// Every descendant of a wide group is minted inside a single tick, which is
	// the burst that used to collide.
	it('keeps every id unique when a wide group is pasted', () => {
		const wide = {
			type: 'group',
			id: 'g-wide',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			children: Array.from({ length: 500 }, (_unused, index) =>
				makeElement({ id: `child-${index}` }),
			),
		} as unknown as PptxElement;

		const ids = collectIds(cloneElementForPaste(wide));
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('routes a pasted group whole subtree into the template store', () => {
		const clone = cloneElementForPaste(nestedGroup('master-outer'), { intoTemplate: true });
		for (const id of collectIds(clone)) {
			expect(id).toMatch(/^master-el-/);
		}
	});
});

describe('serialize / deserialize round trip', () => {
	it('round-trips elements with fresh structural equality', () => {
		const elements = [
			makeElement({ id: 'a', name: 'Box' }),
			makeElement({ id: 'b', x: 1, y: 2, type: 'text', text: 'hello' } as Partial<PptxElement> & {
				id: string;
			}),
		];
		const text = serializeElementClipboard(elements, true);
		const decoded = deserializeElementClipboard(text);
		expect(decoded).not.toBeNull();
		expect(decoded!.isTemplate).toBeTruthy();
		expect(decoded!.elements).toStrictEqual(elements);
	});

	it('round-trips Uint8Array binary fields (embedded chart workbook)', () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 255]);
		const chart = makeElement({ id: 'c', type: 'chart' }) as ChartPptxElement;
		chart.chartData = {
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S1', values: [1] }],
			externalData: { relId: 'rId2', embeddedWorkbookData: bytes },
		} as ChartPptxElement['chartData'];
		const decoded = deserializeElementClipboard(serializeElementClipboard([chart]));
		expect(decoded).not.toBeNull();
		const decodedChart = decoded!.elements[0] as ChartPptxElement;
		const roundTripped = decodedChart.chartData?.externalData?.embeddedWorkbookData;
		expect(roundTripped).toBeInstanceOf(Uint8Array);
		expect(Array.from(roundTripped!)).toStrictEqual([0, 1, 2, 250, 255]);
	});

	it('prepareElementsForPaste remaps every id and offsets positions', () => {
		const decoded = deserializeElementClipboard(
			serializeElementClipboard([makeElement({ id: 'a' }), makeElement({ id: 'b', x: 0, y: 0 })]),
		);
		const pasted = prepareElementsForPaste(decoded!, { offsetX: 10, offsetY: 10 });
		expect(pasted).toHaveLength(2);
		expect(pasted[0].id).not.toBe('a');
		expect(pasted[1].id).not.toBe('b');
		expect(pasted[0].id).not.toBe(pasted[1].id);
		expect(pasted[0].x).toBe(110);
		expect(pasted[1].x).toBe(10);
	});
});

describe('deserializeElementClipboard rejection', () => {
	it('rejects non-JSON text', () => {
		expect(deserializeElementClipboard('just some pasted prose')).toBeNull();
	});

	it('rejects JSON without the marker', () => {
		expect(deserializeElementClipboard(JSON.stringify({ elements: [] }))).toBeNull();
		expect(deserializeElementClipboard('42')).toBeNull();
		expect(deserializeElementClipboard('null')).toBeNull();
	});

	it('rejects a wrong version', () => {
		const payload = JSON.parse(serializeElementClipboard([makeElement({ id: 'a' })])) as Record<
			string,
			unknown
		>;
		payload.version = ELEMENT_CLIPBOARD_VERSION + 1;
		expect(deserializeElementClipboard(JSON.stringify(payload))).toBeNull();
	});

	it('rejects empty or structurally invalid element lists', () => {
		const empty = JSON.stringify({
			marker: ELEMENT_CLIPBOARD_MARKER,
			version: ELEMENT_CLIPBOARD_VERSION,
			isTemplate: false,
			elements: [],
		});
		expect(deserializeElementClipboard(empty)).toBeNull();
		const invalid = JSON.stringify({
			marker: ELEMENT_CLIPBOARD_MARKER,
			version: ELEMENT_CLIPBOARD_VERSION,
			isTemplate: false,
			elements: [{ id: 'a' }],
		});
		expect(deserializeElementClipboard(invalid)).toBeNull();
	});

	it('exposes a custom mime type constant for clipboard integration', () => {
		expect(ELEMENT_CLIPBOARD_MIME_TYPE).toContain('json');
	});
});
