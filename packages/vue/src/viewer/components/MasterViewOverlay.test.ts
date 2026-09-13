import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref, shallowRef } from 'vue';

import type { UseMasterViewCrudResult } from '../composables/useMasterViewCrud';
import { useMasterViewWiring } from '../composables/useMasterViewWiring';
import MasterViewOverlay from './MasterViewOverlay.vue';

/** A no-op CRUD controller: these tests exercise element editing, not the CRUD row. */
function fakeCrud(): UseMasterViewCrudResult {
	return { actions: computed(() => []), error: ref(null), run: vi.fn() };
}

/**
 * The overlay's own affordances, as opposed to the routing rules the composable
 * owns: double-click opens the inline editor over the right shape, Delete
 * removes the selection, and both are offered only on an editable deck.
 */
const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const SHAPE_ID = 'slide-master-slideMaster1-shape-0';

function textShape(id: string): PptxElement {
	return {
		id,
		type: 'text',
		x: 10,
		y: 10,
		width: 100,
		height: 40,
		text: 'Click to edit Master title style',
	} as PptxElement;
}

function mountOverlay(canEdit = true, shape = textShape(SHAPE_ID)) {
	const slideMasters = shallowRef<PptxSlideMaster[]>([
		{ path: MASTER_PATH, backgroundColor: '#111111', elements: [shape] },
	]);
	const notesMaster = shallowRef(undefined);
	const handoutMaster = shallowRef(undefined);
	// A Vue composable, not a React hook. The shared lint config's react-hooks
	// rules match on the `use` prefix alone and cannot tell the two apart.
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const state = useMasterViewWiring({
		slideMasters,
		notesMaster,
		handoutMaster,
		markDirty: vi.fn(),
	});
	const wrapper = mount(MasterViewOverlay, {
		props: {
			state,
			crud: fakeCrud(),
			slideMasters: slideMasters.value,
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			notesMaster: undefined,
			notesCanvasSize: undefined,
			handoutMaster: undefined,
			canEdit,
		},
		attachTo: document.body,
	});
	return { wrapper, slideMasters, state };
}

/** The rendered node carrying the shape's id marker. */
function shapeNode(wrapper: ReturnType<typeof mountOverlay>['wrapper']) {
	return wrapper.find(`[data-element-id="${SHAPE_ID}"]`);
}

describe('masterViewOverlay editing', () => {
	it('captures the current rich master draft before closing its synchronous session', async () => {
		const shape = {
			...textShape(SHAPE_ID),
			text: 'Original',
			textSegments: [{ text: 'Original', style: { italic: true }, bulletInfo: { char: '◆' } }],
		};
		const { wrapper, slideMasters } = mountOverlay(true, shape);
		try {
			await shapeNode(wrapper).trigger('dblclick');
			const editor = wrapper.get('[data-inline-editor]');
			const run = editor.element.querySelector<HTMLElement>('[data-pptx-list-run]')!;
			run.textContent = 'Current master';
			run.style.fontWeight = 'bold';
			await editor.trigger('input');
			expect(slideMasters.value[0].elements?.[0]).toStrictEqual(shape);
			await editor.trigger('blur');
			expect(slideMasters.value[0].elements?.[0]).toMatchObject({
				text: 'Current master',
				textSegments: expect.arrayContaining([
					expect.objectContaining({
						text: 'Current master',
						style: expect.objectContaining({ bold: true, italic: true }),
					}),
				]),
			});
		} finally {
			wrapper.unmount();
		}
	});

	it('applies a list keyboard format to the mounted master editor and owning part', async () => {
		const shape = {
			...textShape(SHAPE_ID),
			text: '◆ Original',
			textSegments: [
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
				{ text: 'Original', style: { italic: true } },
			],
		};
		const { wrapper, slideMasters } = mountOverlay(true, shape);
		try {
			await shapeNode(wrapper).trigger('dblclick');
			const editor = wrapper.get('[data-inline-editor]');
			const run = editor.element.querySelector('span')!;
			run.textContent = 'Current master';
			await editor.trigger('input');
			await editor.trigger('keydown', { key: 'b', ctrlKey: true });
			expect(run.style.fontWeight).toBe('bold');
			expect(slideMasters.value[0].elements?.[0]).toMatchObject({ text: 'Current master' });
			await editor.trigger('blur');
			expect(slideMasters.value[0].elements?.[0]).toMatchObject({
				textSegments: expect.arrayContaining([
					expect.objectContaining({
						text: 'Current master',
						style: expect.objectContaining({ bold: true, italic: true }),
					}),
				]),
			});
		} finally {
			wrapper.unmount();
		}
	});

	it('renders the master shape with its id marker so gestures can resolve it', () => {
		const { wrapper } = mountOverlay();
		expect(shapeNode(wrapper).exists()).toBeTruthy();
	});

	it('opens the inline text editor on double-click', async () => {
		const { wrapper } = mountOverlay();
		expect(wrapper.findComponent({ name: 'InlineTextEditor' }).exists()).toBeFalsy();
		await shapeNode(wrapper).trigger('dblclick');
		expect(wrapper.findComponent({ name: 'InlineTextEditor' }).exists()).toBeTruthy();
	});

	it('offers no interactive markers or editor on a read-only deck', async () => {
		const { wrapper } = mountOverlay(false);
		// A non-interactive stage strips its `data-element-id` markers, so there
		// is nothing for a gesture to resolve in the first place.
		expect(shapeNode(wrapper).exists()).toBeFalsy();
		await wrapper.find('.pptx-vue-master-stage').trigger('dblclick');
		expect(wrapper.findComponent({ name: 'InlineTextEditor' }).exists()).toBeFalsy();
	});

	it('commits the typed text back onto the master part', async () => {
		const { wrapper, slideMasters } = mountOverlay();
		await shapeNode(wrapper).trigger('dblclick');
		const editor = wrapper.findComponent({ name: 'InlineTextEditor' });
		editor.vm.$emit('change', 'Reworded master title');
		editor.vm.$emit('commit');
		await wrapper.vm.$nextTick();
		const masterElement = slideMasters.value[0]?.elements?.[0] as { text?: string } | undefined;
		expect(masterElement?.text).toBe('Reworded master title');
	});

	it('deletes the selected shape on Delete', async () => {
		const { wrapper, slideMasters } = mountOverlay();
		await shapeNode(wrapper).trigger('pointerdown');
		await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Delete' });
		expect(slideMasters.value[0].elements).toStrictEqual([]);
	});

	it('deletes nothing on a read-only deck', async () => {
		const { wrapper, slideMasters } = mountOverlay(false);
		await wrapper.find('.pptx-vue-master-stage').trigger('pointerdown');
		await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Delete' });
		expect(slideMasters.value[0].elements).toHaveLength(1);
	});

	it('leaves Delete alone while text is being edited', async () => {
		const { wrapper, slideMasters } = mountOverlay();
		await shapeNode(wrapper).trigger('pointerdown');
		await shapeNode(wrapper).trigger('dblclick');
		await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Delete' });
		expect(slideMasters.value[0].elements).toHaveLength(1);
	});
});
