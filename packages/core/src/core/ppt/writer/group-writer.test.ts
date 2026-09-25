/**
 * A group's members must be written the way PowerPoint's own 97-2003 SaveAs
 * writes them (COM-measured on a two-rectangle group): the group's FSP is
 * `fGroup | fHaveAnchor`, and each member's FSP sets `fChild` and anchors it
 * with an `OfficeArtChildAnchor` in the group's child space rather than a
 * `ClientAnchor`. Written as top-level shapes inside the group, PowerPoint
 * rejected the whole file as corrupt, which is why every exported table
 * (written as a group of cell rectangles) and so `sample-deck.pptx` failed to
 * open.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement } from '../../types';
import { OA } from '../record-types';
import { buildGroupContainer } from './group-writer';
import { HyperlinkCollector } from './hyperlink-writer';
import { MediaCollector } from './media-writer';
import { OleCollector } from './ole-writer';
import { ShapeIdAllocator } from './shape-id-allocator';
import type { WGroup, WShape } from './write-model';

interface Rec {
	type: number;
	instance: number;
	offset: number;
	length: number;
}

function children(bytes: Uint8Array, start: number, end: number): Rec[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const out: Rec[] = [];
	for (let offset = start; offset + 8 <= end;) {
		const length = view.getUint32(offset + 4, true);
		out.push({
			type: view.getUint16(offset + 2, true),
			instance: view.getUint16(offset, true) >> 4,
			offset: offset + 8,
			length,
		});
		offset += 8 + length;
	}
	return out;
}

const rect = (x: number): WShape => ({
	kind: 'shape',
	spt: 1,
	isConnector: false,
	anchor: { x, y: 1270000, w: 1270000, h: 635000 },
});

function build(group: WGroup): { bytes: Uint8Array; members: Rec[][] } {
	const hyperlinks = new HyperlinkCollector();
	const bytes = buildGroupContainer(
		group,
		[],
		new ShapeIdAllocator(1, 1024),
		hyperlinks,
		new OleCollector(hyperlinks),
		new MediaCollector(hyperlinks),
	);
	const containers = children(bytes, 8, bytes.length);
	return {
		bytes,
		members: containers.map((c) => children(bytes, c.offset, c.offset + c.length)),
	};
}

function fspFlags(bytes: Uint8Array, records: Rec[]): number {
	const fsp = records.find((r) => r.type === OA.FSP)!;
	return new DataView(bytes.buffer, bytes.byteOffset).getUint32(fsp.offset + 4, true);
}

describe('buildGroupContainer', () => {
	const group: WGroup = {
		kind: 'group',
		anchor: { x: 1270000, y: 1270000, w: 3175000, h: 635000 },
		children: [
			rect(1270000),
			rect(3175000),
			{
				kind: 'group',
				anchor: { x: 1270000, y: 1270000, w: 1270000, h: 635000 },
				children: [rect(1270000)],
			},
		],
	};

	it('writes the group FSP as fGroup | fHaveAnchor with a ClientAnchor', () => {
		const { bytes, members } = build(group);
		const patriarch = members[0]!;
		expect(fspFlags(bytes, patriarch)).toBe(0x0201);
		expect(patriarch.map((r) => r.type)).toStrictEqual([OA.FSPGR, OA.FSP, OA.ClientAnchor]);
	});

	it('writes each member with fChild and a ChildAnchor, never a ClientAnchor', () => {
		const { bytes, members } = build(group);
		for (const shape of members.slice(1, 3)) {
			expect(fspFlags(bytes, shape) & 0x0002).toBe(0x0002);
			expect(shape.some((r) => r.type === OA.ChildAnchor)).toBeTruthy();
			expect(shape.some((r) => r.type === OA.ClientAnchor)).toBeFalsy();
		}
	});

	it('anchors a nested group in its parent child space', () => {
		const { bytes, members } = build(group);
		const nested = members[3]!;
		const nestedPatriarch = children(
			bytes,
			nested[0]!.offset,
			nested[0]!.offset + nested[0]!.length,
		);
		expect(fspFlags(bytes, nestedPatriarch)).toBe(0x0203);
		expect(nestedPatriarch.map((r) => r.type)).toStrictEqual([OA.FSPGR, OA.FSP, OA.ChildAnchor]);
	});
});

describe('.ppt export of a group', () => {
	it('reopens with every member where the source put it', async () => {
		const fixture = path.resolve(__dirname, '../../../../../../e2e/fixtures/template-group.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(new Uint8Array(readFileSync(fixture)));
		const ppt = await handler.save(data.slides, { outputFormat: 'ppt' });
		const back = await new PptxHandler().load(ppt.slice().buffer as ArrayBuffer);
		const geometry = (elements: PptxElement[]) =>
			elements
				.filter((e) => e.type === 'group')
				.flatMap((g) =>
					[g, ...(g.type === 'group' ? g.children : [])].map((e) =>
						[e.x, e.y, e.width, e.height].map(Math.round),
					),
				);
		expect(geometry(back.slides[0]!.elements)).toStrictEqual(geometry(data.slides[0]!.elements));
		expect(geometry(back.slides[0]!.elements).length).toBeGreaterThan(1);
	});
});
