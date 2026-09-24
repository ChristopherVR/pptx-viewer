/**
 * @module ppt/writer/drawing-writer.test
 */
import { describe, expect, it } from 'vitest';

import { buildDrawing } from './drawing-writer';
import { HyperlinkCollector } from './hyperlink-writer';
import { MediaCollector } from './media-writer';
import { OleCollector } from './ole-writer';

/** [recType, first FSP flags word or undefined] for each direct child of the DgContainer. */
function dgChildren(drawing: Uint8Array): Array<[number, number | undefined]> {
	const view = new DataView(drawing.buffer, drawing.byteOffset, drawing.byteLength);
	const dgStart = 16; // Drawing header (8) + DgContainer header (8)
	const out: Array<[number, number | undefined]> = [];
	let o = dgStart;
	while (o + 8 <= drawing.length) {
		const type = view.getUint16(o + 2, true);
		const len = view.getUint32(o + 4, true);
		// For an SpContainer, its first child is the FSP: flags at data+4.
		const flags = type === 0xf004 ? view.getUint32(o + 8 + 8 + 4, true) : undefined;
		out.push([type, flags]);
		o += 8 + len;
	}
	return out;
}

describe('buildDrawing', () => {
	it('writes the background shape after the top group, flagged fBackground|fHaveSpt', () => {
		// Inside the top group (this writer's earlier layout) PowerPoint counted
		// the background as an ordinary zero-size slide shape (COM-verified).
		const hyperlinks = new HyperlinkCollector();
		const drawing = buildDrawing(
			{ x: 0, y: 0, w: 100, h: 100 },
			[],
			'00FF00',
			[],
			2,
			hyperlinks,
			new OleCollector(hyperlinks),
			new MediaCollector(hyperlinks),
		);
		expect(dgChildren(drawing)).toStrictEqual([
			[0xf008, undefined],
			[0xf003, undefined],
			[0xf004, 0x0c00],
		]);
	});
});
