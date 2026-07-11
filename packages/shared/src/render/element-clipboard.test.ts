import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
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
	serializeElementClipboard,
} from './element-clipboard';

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

describe('generateElementId / makeCloneId', () => {
	it('generates unique el- prefixed ids', () => {
		const a = generateElementId();
		const b = generateElementId();
		expect(a).toMatch(/^el-\d+-[a-z0-9]+$/);
		expect(a).not.toBe(b);
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
