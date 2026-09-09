import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { hierarchyLeafFoldsDescendants } from './smartart-hierarchy-fold-depth';

describe('hierarchyLeafFoldsDescendants', () => {
	it('detects an unbounded desOrSelf hop ("hierarchy-list--hier5.pptx": childText presOf axis="self desOrSelf" st="1 1" cnt="1 0")', () => {
		const childText: PptxSmartArtLayoutNode = {
			name: 'childText',
			presentationOf: { axis: ['self', 'desOrSelf'], start: [1, 1], count: [1, 0] },
		};
		const diagram: PptxSmartArtLayoutNode = {
			name: 'diagram',
			children: [{ name: 'root', children: [{ name: 'childShape', children: [childText] }] }],
		};
		expect(hierarchyLeafFoldsDescendants(diagram)).toBeTruthy();
	});

	it('detects an unbounded `des` hop with count entirely absent (schema default 0, unbounded)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'leaf',
			presentationOf: { axis: ['self', 'des'] },
		};
		expect(hierarchyLeafFoldsDescendants(node)).toBeTruthy();
	});

	it('declines a BOUNDED des/desOrSelf hop (a genuine `cnt` limit, not "every remaining")', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'leaf',
			presentationOf: { axis: ['self', 'desOrSelf'], count: [1, 3] },
		};
		expect(hierarchyLeafFoldsDescendants(node)).toBeFalsy();
	});

	it('declines a plain "self" presOf (the common "Hierarchy"/"Organization Chart" family - every generation gets its own box, no regression)', () => {
		const rootText: PptxSmartArtLayoutNode = {
			name: 'rootText',
			presentationOf: { axis: ['self'] },
		};
		const diagram: PptxSmartArtLayoutNode = {
			name: 'diagram',
			children: [{ name: 'root', children: [rootText] }],
		};
		expect(hierarchyLeafFoldsDescendants(diagram)).toBeFalsy();
	});

	it('returns false for undefined/childless nodes', () => {
		expect(hierarchyLeafFoldsDescendants(undefined)).toBeFalsy();
		expect(hierarchyLeafFoldsDescendants({ name: 'leaf' })).toBeFalsy();
	});
});
