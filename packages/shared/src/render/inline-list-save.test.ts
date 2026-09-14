import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { overlayInlineTextSnapshot, overlayMasterViewInlineSnapshot } from './inline-list-save';
import type { InlineTextEditSnapshot } from './inline-list-types';
import type { MasterViewDocument, MasterViewTarget } from './master-view';

const element: PptxElement = {
	id: 'text',
	type: 'text',
	x: 0,
	y: 0,
	width: 100,
	height: 30,
	text: 'Original',
	textSegments: [{ text: 'Original', style: { fontSize: 20 } }],
};
const snapshot: InlineTextEditSnapshot = {
	elementId: 'text',
	text: 'Current',
	textSegments: [
		{ text: 'Current', style: { fontSize: 30 }, paragraphLevel: 1, bulletInfo: { char: '◆' } },
	],
};

describe('pending list save overlay', () => {
	it('copies only edited paths and never commits or mutates the input model', () => {
		const sibling: PptxElement = { ...element, id: 'sibling' };
		const group: PptxElement = {
			id: 'group',
			type: 'group',
			x: 0,
			y: 0,
			width: 100,
			height: 30,
			children: [element, sibling],
		};
		const input = [group, sibling];
		const original = structuredClone(input);
		const result = overlayInlineTextSnapshot(input, snapshot);
		expect(result).not.toBe(input);
		expect(result[1]).toBe(sibling);
		expect(result[0].type).toBe('group');
		if (result[0].type !== 'group') {
			throw new Error('Expected group');
		}
		expect(result[0].children?.[0]).toMatchObject({
			text: 'Current',
			textSegments: snapshot.textSegments,
		});
		expect(result[0].children?.[1]).toBe(sibling);
		expect(input).toStrictEqual(original);
	});

	it('ignores missing semantic data, foreign IDs and unchanged snapshots', () => {
		const input = [element];
		expect(overlayInlineTextSnapshot(input)).toBe(input);
		expect(overlayInlineTextSnapshot(input, { elementId: 'text', text: 'Plain fallback' })).toBe(
			input,
		);
		expect(overlayInlineTextSnapshot(input, { ...snapshot, elementId: 'other' })).toBe(input);
		expect(
			overlayInlineTextSnapshot(input, {
				elementId: 'text',
				text: 'Original',
				textSegments: element.textSegments,
			}),
		).toBe(input);
	});

	it('applies the binding commit transformation to current draft styles', () => {
		const result = overlayInlineTextSnapshot([element], snapshot, 'CURRENT');
		expect(result[0]).toMatchObject({
			text: 'CURRENT',
			textSegments: [{ ...snapshot.textSegments![0], text: 'CURRENT' }],
		});
		expect(snapshot.text).toBe('Current');
	});

	it.each(['master', 'layout', 'notes', 'handout'] as const)(
		'routes %s edits to their existing document owner',
		(part) => {
			const document: MasterViewDocument = {
				slideMasters: [
					{
						path: 'master',
						elements: [{ ...element, id: 'master' }],
						layouts: [{ path: 'layout', elements: [{ ...element, id: 'layout' }] }],
					},
				],
				notesMaster: { path: 'notes', elements: [{ ...element, id: 'notes' }] },
				handoutMaster: { path: 'handout', elements: [{ ...element, id: 'handout' }] },
			};
			const original = structuredClone(document);
			const target: MasterViewTarget = {
				tab: part === 'notes' || part === 'handout' ? part : 'slides',
				masterIndex: 0,
				layoutIndex: 0,
			};
			const write = overlayMasterViewInlineSnapshot(document, target, {
				...snapshot,
				elementId: part,
			});
			const actual =
				part === 'master'
					? write?.slideMasters?.[0].elements?.[0]
					: part === 'layout'
						? write?.slideMasters?.[0].layouts?.[0].elements?.[0]
						: part === 'notes'
							? write?.notesMaster?.elements?.[0]
							: write?.handoutMaster?.elements?.[0];
			expect(actual).toMatchObject({ text: 'Current', textSegments: snapshot.textSegments });
			expect(document).toStrictEqual(original);
			expect(overlayMasterViewInlineSnapshot(document, undefined, snapshot)).toBeNull();
			expect(overlayMasterViewInlineSnapshot(document, target, snapshot)).toBeNull();
		},
	);
});
