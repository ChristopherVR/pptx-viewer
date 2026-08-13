/**
 * master-view-canvas.test.ts: the routing rule behind View > Slide Master.
 *
 * Angular's master canvas emitted transform / rotate / text commits and then
 * threw them away on the Slides tab (`if (!part || this.tab() === 'slides')
 * { return; }`): only notes and handout edits ever reached the model. The
 * component now delegates to `updateMasterViewElement`, which is what this
 * pins - imported from the vendored shared barrel the component itself uses.
 *
 * No Angular TestBed: component rendering needs `@analogjs/vite-plugin-angular`
 * (a follow-up), so this package's suites test the decision functions its
 * templates and handlers delegate to, as `action-settings-panel.component.test`
 * and `inspector-panel.component.test` do.
 */
import type { PptxElement, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	deleteMasterViewElements,
	masterViewBackgroundColor,
	masterViewPseudoSlide,
	setMasterViewBackgroundColor,
	updateMasterViewElement,
} from '../internal/shared';
import type { MasterViewDocument } from '../internal/shared';

const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout1.xml';

function shape(id: string, x = 0): PptxElement {
	return { id, type: 'shape', x, y: 0, width: 10, height: 10 } as PptxElement;
}

function document(): MasterViewDocument {
	return {
		slideMasters: [
			{
				path: MASTER_PATH,
				backgroundColor: '#111111',
				elements: [shape('slide-master-slideMaster1-shape-0')],
				layouts: [{ path: LAYOUT_PATH, elements: [shape('slide-layout-slideLayout1-shape-0')] }],
			} as PptxSlideMaster,
		],
		notesMaster: {
			path: 'ppt/notesMasters/notesMaster1.xml',
			elements: [shape('notes-master-shape-0')],
		},
	};
}

describe('master view canvas routing', () => {
	it('paints the master shape tree on the Slides tab', () => {
		const slide = masterViewPseudoSlide(document(), {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: null,
		});
		expect(slide?.id).toBe(MASTER_PATH);
		expect(slide?.elements.map((el) => el.id)).toStrictEqual(['slide-master-slideMaster1-shape-0']);
	});

	it('paints the master behind a selected layout', () => {
		const slide = masterViewPseudoSlide(document(), {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: 0,
		});
		expect(slide?.id).toBe(LAYOUT_PATH);
		expect(slide?.elements.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
			'slide-layout-slideLayout1-shape-0',
		]);
	});

	it('commits a Slides-tab transform instead of discarding it', () => {
		const write = updateMasterViewElement(
			document(),
			{ tab: 'slides', masterIndex: 0, layoutIndex: null },
			'slide-master-slideMaster1-shape-0',
			{ x: 42, y: 24 },
		);
		expect(write?.slideMasters?.[0].elements?.[0]).toMatchObject({ x: 42, y: 24 });
	});

	it('routes a layout edit to the layout, leaving the master alone', () => {
		const write = updateMasterViewElement(
			document(),
			{ tab: 'slides', masterIndex: 0, layoutIndex: 0 },
			'slide-layout-slideLayout1-shape-0',
			{ x: 7 },
		);
		expect(write?.slideMasters?.[0].layouts?.[0].elements?.[0].x).toBe(7);
		expect(write?.slideMasters?.[0].elements?.[0].x).toBe(0);
	});

	it('still routes notes-master edits to the notes master', () => {
		const write = updateMasterViewElement(
			document(),
			{ tab: 'notes', masterIndex: 0, layoutIndex: null },
			'notes-master-shape-0',
			{ x: 5 },
		);
		expect(write?.notesMaster?.elements?.[0].x).toBe(5);
		expect(write?.slideMasters).toBeUndefined();
	});
});

/**
 * Delete was the remaining gap: the canvas kept its selection locally and the
 * only keyboard handler was the deck-wide one, whose `delete` case indexes
 * into `slides`. Pressing Delete over a master shape therefore did nothing, or
 * removed something on the slide behind the overlay. The canvas now owns the
 * key and routes it through the shared rule the other four bindings use.
 */
describe('master view canvas delete', () => {
	it('removes a master shape', () => {
		const write = deleteMasterViewElements(
			document(),
			{ tab: 'slides', masterIndex: 0, layoutIndex: null },
			['slide-master-slideMaster1-shape-0'],
		);
		expect(write?.slideMasters?.[0].elements).toStrictEqual([]);
	});

	it('removes a layout shape without touching its master', () => {
		const write = deleteMasterViewElements(
			document(),
			{ tab: 'slides', masterIndex: 0, layoutIndex: 0 },
			['slide-layout-slideLayout1-shape-0'],
		);
		expect(write?.slideMasters?.[0].layouts?.[0].elements).toStrictEqual([]);
		expect(write?.slideMasters?.[0].elements).toHaveLength(1);
	});

	it('is a no-op with nothing selected', () => {
		expect(
			deleteMasterViewElements(
				document(),
				{ tab: 'slides', masterIndex: 0, layoutIndex: null },
				[],
			),
		).toBeNull();
	});
});

describe('master view background routing', () => {
	it('reads the selected layout, falling back to its master', () => {
		expect(
			masterViewBackgroundColor(document(), { tab: 'slides', masterIndex: 0, layoutIndex: 0 }),
		).toBe('#111111');
	});

	it('writes onto the selected layout rather than its master', () => {
		const write = setMasterViewBackgroundColor(
			document(),
			{ tab: 'slides', masterIndex: 0, layoutIndex: 0 },
			'#123456',
		);
		expect(write?.slideMasters?.[0].layouts?.[0].backgroundColor).toBe('#123456');
		expect(write?.slideMasters?.[0].backgroundColor).toBe('#111111');
	});
});
