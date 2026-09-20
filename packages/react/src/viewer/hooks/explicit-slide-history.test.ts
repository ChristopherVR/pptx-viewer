import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { EditorHistorySnapshot } from '../types';
import { serializeHistoryDocument } from './explicit-slide-history';

function text(id: string): PptxElement {
	return {
		id,
		type: 'text',
		x: 10,
		y: 20,
		width: 100,
		height: 40,
		text: 'Quarterly report',
		rawXml: { 'p:sp': { '@_cache': 'before' } },
	};
}

function slide(elements: PptxElement[]): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements,
		rawXml: { 'p:sld': { '@_cache': 'before' } },
	};
}

function snapshot(): EditorHistorySnapshot {
	return {
		width: 960,
		height: 540,
		activeSlideIndex: 0,
		slides: [
			slide([
				{
					id: 'group-1',
					type: 'group',
					x: 0,
					y: 0,
					width: 200,
					height: 100,
					children: [text('group-child')],
					rawXml: { 'p:grpSp': { '@_cache': 'before' } },
				},
			]),
		],
		templateElementsBySlideId: { 'slide-1': [text('template-1')] },
	};
}

describe('serializeHistoryDocument', () => {
	it('ignores serialization caches on slides, groups, children and template elements', () => {
		const before = snapshot();
		const after = structuredClone(before);
		after.slides[0].rawXml = { 'p:sld': { '@_cache': 'after' } };
		const group = after.slides[0].elements[0];
		if (group.type !== 'group') {
			throw new Error('expected group fixture');
		}
		group.rawXml = { 'p:grpSp': { '@_cache': 'after' } };
		group.shapeId = '10';
		group.children[0].rawXml = { 'p:sp': { '@_cache': 'after' } };
		group.children[0].shapeId = '11';
		after.templateElementsBySlideId['slide-1'][0].rawXml = {
			'p:sp': { '@_cache': 'after' },
		};
		after.templateElementsBySlideId['slide-1'][0].shapeId = '12';

		expect(serializeHistoryDocument(after)).toBe(serializeHistoryDocument(before));
	});

	it('still detects semantic edits', () => {
		const before = snapshot();
		const after = structuredClone(before);
		const group = after.slides[0].elements[0];
		if (group.type !== 'group') {
			throw new Error('expected group fixture');
		}
		group.children[0].x += 20;

		expect(serializeHistoryDocument(after)).not.toBe(serializeHistoryDocument(before));
	});
});
