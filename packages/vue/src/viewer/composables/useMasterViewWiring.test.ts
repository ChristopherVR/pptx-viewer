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

/**
 * Vue's master editing stopped at drag/resize: there was no inline text editor
 * and no delete, so a template's "Click to edit Master title style" could be
 * moved but never reworded, and a stray master shape could never be removed.
 */
describe('useMasterViewWiring text commit', () => {
	it('writes the text and remaps the runs onto the owning part', () => {
		const { slideMasters, markDirty, state } = useWiring();
		state.onMasterViewTextCommit('slide-master-slideMaster1-shape-0', 'Retitled');
		const edited = slideMasters.value[0].elements?.[0] as {
			text?: string;
			textSegments?: unknown[];
		};
		expect(edited.text).toBe('Retitled');
		expect(edited.textSegments).toBeDefined();
		expect(markDirty).toHaveBeenCalledWith();
	});

	it('routes a layout text commit to the layout', () => {
		const { slideMasters, state } = useWiring();
		state.onSelectLayout(0, 0);
		state.onMasterViewTextCommit('slide-layout-slideLayout1-shape-0', 'Layout words');
		const layoutElement = slideMasters.value[0]?.layouts?.[0]?.elements?.[0] as
			| { text?: string }
			| undefined;
		expect(layoutElement?.text).toBe('Layout words');
	});

	it('does not commit when the text is unchanged, so runs are never remapped away', () => {
		const { markDirty, state } = useWiring();
		state.onMasterViewTextCommit('slide-master-slideMaster1-shape-0', '');
		expect(markDirty).not.toHaveBeenCalled();
	});
});

describe('useMasterViewWiring delete', () => {
	it('removes a master shape', () => {
		const { slideMasters, markDirty, state } = useWiring();
		state.onMasterViewElementDelete(['slide-master-slideMaster1-shape-0']);
		expect(slideMasters.value[0].elements).toStrictEqual([]);
		expect(markDirty).toHaveBeenCalledWith();
	});

	it('removes a layout shape without touching its master', () => {
		const { slideMasters, state } = useWiring();
		state.onSelectLayout(0, 0);
		state.onMasterViewElementDelete(['slide-layout-slideLayout1-shape-0']);
		expect(slideMasters.value[0].layouts?.[0].elements).toStrictEqual([]);
		expect(slideMasters.value[0].elements).toHaveLength(1);
	});

	it('is a no-op with nothing selected', () => {
		const { markDirty, state } = useWiring();
		state.onMasterViewElementDelete([]);
		expect(markDirty).not.toHaveBeenCalled();
	});
});

describe('useMasterViewWiring background', () => {
	it('reads and writes the selected master background', () => {
		const { slideMasters, state } = useWiring();
		expect(state.activeMasterViewBackground.value).toBe('#111111');
		state.onMasterViewBackgroundChange('#abcdef');
		expect(slideMasters.value[0].backgroundColor).toBe('#abcdef');
	});

	it('writes onto the selected layout rather than its master', () => {
		const { slideMasters, state } = useWiring();
		state.onSelectLayout(0, 0);
		state.onMasterViewBackgroundChange('#123456');
		expect(slideMasters.value[0].layouts?.[0].backgroundColor).toBe('#123456');
		expect(slideMasters.value[0].backgroundColor).toBe('#111111');
	});

	it('routes the notes tab to the notes master', () => {
		const { notesMaster, state } = useWiring();
		state.masterViewTab.value = 'notes';
		state.onMasterViewBackgroundChange('#222222');
		expect(notesMaster.value?.backgroundColor).toBe('#222222');
	});
});
