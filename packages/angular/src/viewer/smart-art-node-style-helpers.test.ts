import type { TranslateService } from '@ngx-translate/core';
import type { PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import {
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
	getSmartArtNodeBounds,
	topLevelNodeCount,
} from './smart-art-node-style-helpers';

// Full coverage of the bounds table itself lives in
// `packages/shared/src/render/smartart-node-limits.test.ts`. These tests are
// a regression smoke test confirming the Angular re-exports still resolve to
// the shared implementation, plus the Angular-only `describeSmartArtBounds`
// TranslateService wiring and `topLevelNodeCount` helper.
describe('smart-art-node-style-helpers: node-count bounds', () => {
	it('re-exports the shared bounds table', () => {
		expect(getSmartArtNodeBounds('matrix')).toStrictEqual({ min: 4, max: 4 });
		expect(getSmartArtNodeBounds(undefined)).toStrictEqual({ min: 1 });
	});

	it('re-exports canAddTopLevelNode / canRemoveTopLevelNode', () => {
		expect(canAddTopLevelNode('venn', 3)).toBeFalsy();
		expect(canRemoveTopLevelNode('venn', 2)).toBeFalsy();
	});

	it('topLevelNodeCount counts only parentless nodes', () => {
		const data: PptxSmartArtData = {
			layoutType: 'list',
			nodes: [
				{ id: '1', text: 'a' },
				{ id: '2', text: 'b', parentId: '1' },
				{ id: '3', text: 'c' },
			],
		};
		expect(topLevelNodeCount(data)).toBe(2);
	});

	it('describeSmartArtBounds falls back to the shared neutral text with no TranslateService', () => {
		expect(describeSmartArtBounds('matrix')).toBe('This layout uses exactly 4 items.');
		expect(describeSmartArtBounds('list')).toBeUndefined();
	});

	it('describeSmartArtBounds uses the TranslateService when supplied', () => {
		const instant = vi.fn((key: string) => key),
			translate = { instant } as unknown as TranslateService;

		expect(describeSmartArtBounds('matrix', translate)).toBe('pptx.smartArt.boundsHintExact');
		expect(instant).toHaveBeenCalledWith('pptx.smartArt.boundsHintExact', { max: 4 });

		expect(describeSmartArtBounds('cycle', translate)).toBe('pptx.smartArt.boundsHintMin');
		expect(instant).toHaveBeenCalledWith('pptx.smartArt.boundsHintMin', { min: 3 });

		expect(describeSmartArtBounds('venn', translate)).toBe('pptx.smartArt.boundsHintRange');
		expect(instant).toHaveBeenCalledWith('pptx.smartArt.boundsHintRange', { min: 2, max: 3 });
	});

	it('describeSmartArtBounds returns undefined for an unbounded layout even with a TranslateService', () => {
		const translate = { instant: vi.fn((key: string) => key) } as unknown as TranslateService;
		expect(describeSmartArtBounds('list', translate)).toBeUndefined();
	});
});
