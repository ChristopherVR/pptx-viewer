import type { PptxElement, PptxSlideMaster, PptxNotesMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	masterViewElements,
	masterViewParts,
	masterViewPseudoSlide,
	partitionMasterViewElements,
	replaceMasterViewElements,
	updateMasterViewElement,
} from './master-view';
import type { MasterViewDocument, MasterViewTarget } from './master-view';

function shape(id: string, x = 0): PptxElement {
	return { id, type: 'shape', x, y: 0, width: 10, height: 10 } as PptxElement;
}

const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout2.xml';

function makeDocument(): MasterViewDocument {
	const master: PptxSlideMaster = {
		path: MASTER_PATH,
		backgroundColor: '#111111',
		elements: [shape('slide-master-slideMaster1-shape-0')],
		layouts: [
			{ path: 'ppt/slideLayouts/slideLayout1.xml', elements: [] },
			{
				path: LAYOUT_PATH,
				backgroundColor: '#222222',
				elements: [shape('slide-layout-slideLayout2-shape-0')],
			},
		],
	};
	const notesMaster: PptxNotesMaster = {
		path: 'ppt/notesMasters/notesMaster1.xml',
		elements: [shape('notes-master-shape-0')],
	};
	return { slideMasters: [master], notesMaster };
}

const masterTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
const layoutTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: 1 };
const notesTarget: MasterViewTarget = { tab: 'notes', masterIndex: 0, layoutIndex: null };

describe('masterViewParts', () => {
	it('resolves the master on its own', () => {
		expect(masterViewParts(makeDocument(), masterTarget).map((part) => part.path)).toStrictEqual([
			MASTER_PATH,
		]);
	});

	it('paints a layout on top of its master, as PowerPoint does', () => {
		expect(masterViewParts(makeDocument(), layoutTarget).map((part) => part.path)).toStrictEqual([
			MASTER_PATH,
			LAYOUT_PATH,
		]);
	});

	it('resolves nothing without a target', () => {
		expect(masterViewParts(makeDocument(), null)).toStrictEqual([]);
	});
});

describe('masterViewPseudoSlide', () => {
	it('keys the pseudo-slide on the selected part path', () => {
		expect(masterViewPseudoSlide(makeDocument(), layoutTarget)?.id).toBe(LAYOUT_PATH);
		expect(masterViewPseudoSlide(makeDocument(), masterTarget)?.id).toBe(MASTER_PATH);
	});

	it('merges master artwork behind the layout artwork', () => {
		expect(
			masterViewPseudoSlide(makeDocument(), layoutTarget)?.elements.map((el) => el.id),
		).toStrictEqual(['slide-master-slideMaster1-shape-0', 'slide-layout-slideLayout2-shape-0']);
	});

	it('prefers the layout background but falls back to the master', () => {
		expect(masterViewPseudoSlide(makeDocument(), layoutTarget)?.backgroundColor).toBe('#222222');
		expect(masterViewPseudoSlide(makeDocument(), masterTarget)?.backgroundColor).toBe('#111111');
	});
});

describe('partitionMasterViewElements', () => {
	it('routes each element back to the part that owns it', () => {
		const parts = masterViewParts(makeDocument(), layoutTarget);
		const split = partitionMasterViewElements(
			parts,
			masterViewElements(makeDocument(), layoutTarget),
		);
		expect(split.get(MASTER_PATH)?.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
		]);
		expect(split.get(LAYOUT_PATH)?.map((el) => el.id)).toStrictEqual([
			'slide-layout-slideLayout2-shape-0',
		]);
	});

	it('lands a newly drawn shape on the selected part', () => {
		const parts = masterViewParts(makeDocument(), layoutTarget);
		const split = partitionMasterViewElements(parts, [shape('brand-new')]);
		expect(split.get(LAYOUT_PATH)?.map((el) => el.id)).toStrictEqual(['brand-new']);
		expect(split.get(MASTER_PATH)).toStrictEqual([]);
	});
});

describe('updateMasterViewElement', () => {
	it('writes a master edit into the master model', () => {
		const write = updateMasterViewElement(
			makeDocument(),
			masterTarget,
			'slide-master-slideMaster1-shape-0',
			{ x: 42 },
		);
		expect(write?.slideMasters?.[0].elements?.[0].x).toBe(42);
	});

	it('writes a layout edit into the layout, leaving the master alone', () => {
		const write = updateMasterViewElement(
			makeDocument(),
			layoutTarget,
			'slide-layout-slideLayout2-shape-0',
			{ x: 7 },
		);
		expect(write?.slideMasters?.[0].layouts?.[1].elements?.[0].x).toBe(7);
		expect(write?.slideMasters?.[0].elements?.[0].x).toBe(0);
	});

	it('routes a master shape edited from the layout view back to the master', () => {
		// The layout canvas paints the master's artwork too, so the id the
		// canvas reports is not necessarily owned by the selected layout.
		const write = updateMasterViewElement(
			makeDocument(),
			layoutTarget,
			'slide-master-slideMaster1-shape-0',
			{ x: 99 },
		);
		expect(write?.slideMasters?.[0].elements?.[0].x).toBe(99);
		expect(write?.slideMasters?.[0].layouts?.[1].elements?.[0].x).toBe(0);
	});

	it('writes a notes-master edit into the notes master', () => {
		const write = updateMasterViewElement(makeDocument(), notesTarget, 'notes-master-shape-0', {
			x: 5,
		});
		expect(write?.notesMaster?.elements?.[0].x).toBe(5);
		expect(write?.slideMasters).toBeUndefined();
	});

	it('ignores an id no part owns', () => {
		expect(updateMasterViewElement(makeDocument(), masterTarget, 'nope', { x: 1 })).toBeNull();
	});
});

describe('replaceMasterViewElements', () => {
	it('drops a deleted layout shape without touching the master', () => {
		const write = replaceMasterViewElements(makeDocument(), layoutTarget, [
			shape('slide-master-slideMaster1-shape-0'),
		]);
		expect(write?.slideMasters?.[0].layouts?.[1].elements).toStrictEqual([]);
		expect(write?.slideMasters?.[0].elements).toHaveLength(1);
	});

	it('returns null when the target resolves to nothing', () => {
		expect(replaceMasterViewElements({ slideMasters: [] }, masterTarget, [])).toBeNull();
	});
});
