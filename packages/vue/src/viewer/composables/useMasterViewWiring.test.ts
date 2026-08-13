import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';

import { useMasterViewWiring } from './useMasterViewWiring';

/**
 * View > Slide Master was read-only in Vue: the overlay rendered a stage with
 * no interactive/editable prop and the composable exposed only notes/handout
 * background plus slides-per-page. It also painted a layout on an empty canvas
 * before its master's own artwork was parsed at all.
 */
const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout1.xml';

function shape(id: string, x = 0): PptxElement {
	return { id, type: 'shape', x, y: 0, width: 10, height: 10 } as PptxElement;
}

function useWiring() {
	const slideMasters = shallowRef<PptxSlideMaster[]>([
		{
			path: MASTER_PATH,
			backgroundColor: '#111111',
			elements: [shape('slide-master-slideMaster1-shape-0')],
			layouts: [{ path: LAYOUT_PATH, elements: [shape('slide-layout-slideLayout1-shape-0')] }],
		} as PptxSlideMaster,
	]);
	const notesMaster = shallowRef<PptxNotesMaster | undefined>({
		path: 'ppt/notesMasters/notesMaster1.xml',
		elements: [shape('notes-master-shape-0')],
	});
	const handoutMaster = shallowRef<PptxHandoutMaster | undefined>(undefined);
	const markDirty = vi.fn();
	const state = useMasterViewWiring({ slideMasters, notesMaster, handoutMaster, markDirty });
	return { slideMasters, notesMaster, markDirty, state };
}

describe('useMasterViewWiring master-part editing', () => {
	it('renders the master shape tree as the pseudo-slide', () => {
		const { state } = useWiring();
		expect(state.activeMasterViewSlide.value?.id).toBe(MASTER_PATH);
		expect(state.activeMasterViewElements.value.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
		]);
	});

	it('paints the master behind a selected layout', () => {
		const { state } = useWiring();
		state.onSelectLayout(0, 0);
		expect(state.activeMasterViewSlide.value?.id).toBe(LAYOUT_PATH);
		expect(state.activeMasterViewElements.value.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
			'slide-layout-slideLayout1-shape-0',
		]);
	});

	it('writes a master edit back into the master model and marks the deck dirty', () => {
		const { slideMasters, markDirty, state } = useWiring();
		state.onMasterViewElementUpdate('slide-master-slideMaster1-shape-0', { x: 42 });
		expect(slideMasters.value[0].elements?.[0].x).toBe(42);
		expect(markDirty).toHaveBeenCalledWith();
	});

	it('routes a layout edit to the layout, leaving the master alone', () => {
		const { slideMasters, state } = useWiring();
		state.onSelectLayout(0, 0);
		state.onMasterViewElementUpdate('slide-layout-slideLayout1-shape-0', { x: 7 });
		expect(slideMasters.value[0].layouts?.[0].elements?.[0].x).toBe(7);
		expect(slideMasters.value[0].elements?.[0].x).toBe(0);
	});

	it('routes a notes-master edit to the notes master', () => {
		const { notesMaster, state } = useWiring();
		state.masterViewTab.value = 'notes';
		state.onMasterViewElementUpdate('notes-master-shape-0', { x: 5 });
		expect(notesMaster.value?.elements?.[0].x).toBe(5);
	});

	it('ignores an id no part owns', () => {
		const { slideMasters, markDirty, state } = useWiring();
		state.onMasterViewElementUpdate('not-a-master-shape', { x: 9 });
		expect(slideMasters.value[0].elements?.[0].x).toBe(0);
		expect(markDirty).not.toHaveBeenCalled();
	});
});
