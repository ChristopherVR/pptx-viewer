import type { PptxElement, PptxNotesMaster, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { masterViewElements } from './master-view';
import type { MasterViewDocument, MasterViewTarget } from './master-view';
import {
	deleteMasterViewElements,
	masterViewBackgroundColor,
	masterViewOwnerElementId,
	setMasterViewBackgroundColor,
} from './master-view-editing';

function shape(id: string): PptxElement {
	return { id, type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout2.xml';
const MASTER_SHAPE = 'slide-master-slideMaster1-shape-0';
const LAYOUT_SHAPE = 'slide-layout-slideLayout2-shape-0';

function makeDocument(): MasterViewDocument {
	const master: PptxSlideMaster = {
		path: MASTER_PATH,
		backgroundColor: '#111111',
		elements: [shape(MASTER_SHAPE)],
		layouts: [
			{ path: 'ppt/slideLayouts/slideLayout1.xml', elements: [] },
			{ path: LAYOUT_PATH, elements: [shape(LAYOUT_SHAPE)] },
		],
	};
	const notesMaster: PptxNotesMaster = {
		path: 'ppt/notesMasters/notesMaster1.xml',
		backgroundColor: '#333333',
		elements: [shape('notes-master-shape-0')],
	};
	return { slideMasters: [master], notesMaster };
}

const masterTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
const layoutTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: 1 };
const notesTarget: MasterViewTarget = { tab: 'notes', masterIndex: 0, layoutIndex: null };

describe('deleteMasterViewElements', () => {
	it('removes a layout shape from the layout, leaving the master alone', () => {
		const write = deleteMasterViewElements(makeDocument(), layoutTarget, [LAYOUT_SHAPE]);
		expect(write?.slideMasters?.[0].elements?.map((element) => element.id)).toStrictEqual([
			MASTER_SHAPE,
		]);
		expect(write?.slideMasters?.[0].layouts?.[1].elements).toStrictEqual([]);
	});

	it('removes a master shape even while a layout is selected', () => {
		// The layout canvas paints its master's artwork too, so a shape the user
		// can see and select there belongs to a part the sidebar has not
		// selected. Routing by ownership is the whole point.
		const write = deleteMasterViewElements(makeDocument(), layoutTarget, [MASTER_SHAPE]);
		expect(write?.slideMasters?.[0].elements).toStrictEqual([]);
		expect(write?.slideMasters?.[0].layouts?.[1].elements?.map((e) => e.id)).toStrictEqual([
			LAYOUT_SHAPE,
		]);
	});

	it('removes a notes-master shape', () => {
		const write = deleteMasterViewElements(makeDocument(), notesTarget, ['notes-master-shape-0']);
		expect(write?.notesMaster?.elements).toStrictEqual([]);
	});

	it('is a no-op with no ids and with no target', () => {
		expect(deleteMasterViewElements(makeDocument(), layoutTarget, [])).toBeNull();
		expect(deleteMasterViewElements(makeDocument(), null, [MASTER_SHAPE])).toBeNull();
	});

	it('leaves the other elements untouched', () => {
		const document = makeDocument();
		const write = deleteMasterViewElements(document, layoutTarget, [LAYOUT_SHAPE]);
		const next: MasterViewDocument = { ...document, slideMasters: write!.slideMasters! };
		expect(masterViewElements(next, layoutTarget).map((element) => element.id)).toStrictEqual([
			MASTER_SHAPE,
		]);
	});
});

describe('masterViewOwnerElementId', () => {
	const GROUP_ID = 'slide-layout-slideLayout2-group-0';
	const CHILD_ID = `${GROUP_ID}-shape-1`;
	const NESTED_ID = `${GROUP_ID}-group-0-shape-0`;

	function grouped(): PptxElement[] {
		return [
			shape(LAYOUT_SHAPE),
			{
				...shape(GROUP_ID),
				type: 'group',
				children: [
					shape(CHILD_ID),
					{ ...shape(`${GROUP_ID}-group-0`), type: 'group', children: [shape(NESTED_ID)] },
				],
			} as PptxElement,
		];
	}

	it('maps a group child back to the group the part owns', () => {
		expect(masterViewOwnerElementId(grouped(), CHILD_ID)).toBe(GROUP_ID);
	});

	it('maps a nested group child back to the outermost group', () => {
		expect(masterViewOwnerElementId(grouped(), NESTED_ID)).toBe(GROUP_ID);
	});

	it('returns a top-level element unchanged', () => {
		expect(masterViewOwnerElementId(grouped(), LAYOUT_SHAPE)).toBe(LAYOUT_SHAPE);
		expect(masterViewOwnerElementId(grouped(), GROUP_ID)).toBe(GROUP_ID);
	});

	it('resolves an unknown or absent id to nothing', () => {
		expect(masterViewOwnerElementId(grouped(), 'slide-master-elsewhere-0')).toBeNull();
		expect(masterViewOwnerElementId(grouped(), null)).toBeNull();
	});
});

describe('masterViewBackgroundColor', () => {
	it('reads the selected master', () => {
		expect(masterViewBackgroundColor(makeDocument(), masterTarget)).toBe('#111111');
	});

	it('falls back to the master when the layout declares none', () => {
		expect(masterViewBackgroundColor(makeDocument(), layoutTarget)).toBe('#111111');
	});

	it('reads the notes master on its own tab', () => {
		expect(masterViewBackgroundColor(makeDocument(), notesTarget)).toBe('#333333');
	});
});

describe('setMasterViewBackgroundColor', () => {
	it('writes onto the selected layout, not its master', () => {
		const write = setMasterViewBackgroundColor(makeDocument(), layoutTarget, '#123456');
		expect(write?.slideMasters?.[0].backgroundColor).toBe('#111111');
		expect(write?.slideMasters?.[0].layouts?.[1].backgroundColor).toBe('#123456');
		expect(write?.slideMasters?.[0].layouts?.[0].backgroundColor).toBeUndefined();
	});

	it('writes onto the master when no layout is selected', () => {
		const write = setMasterViewBackgroundColor(makeDocument(), masterTarget, '#123456');
		expect(write?.slideMasters?.[0].backgroundColor).toBe('#123456');
	});

	it('writes onto the notes master', () => {
		const write = setMasterViewBackgroundColor(makeDocument(), notesTarget, '#123456');
		expect(write?.notesMaster?.backgroundColor).toBe('#123456');
		expect(write?.slideMasters).toBeUndefined();
	});

	it('an empty string clears the colour, restoring inheritance', () => {
		const write = setMasterViewBackgroundColor(makeDocument(), layoutTarget, '');
		expect(write?.slideMasters?.[0].layouts?.[1].backgroundColor).toBe('');
	});

	it('resolves nothing without a target', () => {
		expect(setMasterViewBackgroundColor(makeDocument(), null, '#123456')).toBeNull();
	});
});
