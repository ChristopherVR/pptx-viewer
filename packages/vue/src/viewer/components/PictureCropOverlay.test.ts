// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';
import { computed, defineComponent, h, inject, nextTick, ref } from 'vue';

import { MergeCropKey } from '../composables/merge-crop-context';
import { mountWithMergeCrop } from '../composables/merge-crop-test-harness';
import type { MergeCropHarness } from '../composables/merge-crop-test-harness';
import { useContextMenu } from '../composables/useContextMenu';
import type { UseContextMenuResult } from '../composables/useContextMenu';
import type { EditorOperations } from '../composables/useEditorOperations';
import PictureCropOverlay from './PictureCropOverlay.vue';

const PICTURE = {
	id: 'pic',
	type: 'picture',
	x: 100,
	y: 100,
	width: 200,
	height: 100,
	imageData: 'data:image/png;base64,AAAA',
} as PptxElement;
const SHAPE_A = { id: 'a', type: 'shape', x: 0, y: 0, width: 50, height: 50, shapeType: 'rect' };
const SHAPE_B = { id: 'b', type: 'shape', x: 20, y: 0, width: 50, height: 50, shapeType: 'rect' };

/** Renders the overlay from the injected controller, as `ViewerCanvasOverlays` does. */
const OverlayHost = defineComponent({
	setup() {
		const crop = inject(MergeCropKey);
		return () =>
			crop?.cropElement.value
				? h(PictureCropOverlay, {
						element: crop.cropElement.value,
						imageSrc: crop.cropImageSrc.value,
						zoom: 2,
						applyLive: crop.applyLive,
					})
				: h('div');
	},
});

let harness: MergeCropHarness | null = null;
function mountCrop(): MergeCropHarness {
	harness = mountWithMergeCrop([PICTURE], ['pic'], OverlayHost);
	return harness;
}
afterEach(() => {
	harness?.wrapper.unmount();
	harness = null;
});

const picture = (hs: MergeCropHarness) => hs.elements()[0] as PptxElement & { cropLeft?: number };
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));

async function dragWestHandle(hs: MergeCropHarness): Promise<void> {
	const handle = hs.wrapper.get('[data-pptx-crop-handle="w"]');
	await handle.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0 });
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 0 }));
	window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, clientY: 0 }));
	await nextTick();
}

describe('picture crop overlay (vue)', () => {
	it('renders the ghost, the frame and eight labelled handles over the picture', async () => {
		const hs = mountCrop();
		hs.controller.enterCrop('pic');
		await nextTick();
		const root = hs.wrapper.get('[data-pptx-crop-overlay="true"]');
		expect(root.attributes('style')).toContain('left: 100px');
		expect(hs.wrapper.findAll('[data-pptx-crop-handle]')).toHaveLength(8);
		expect(hs.wrapper.get('[data-pptx-crop-handle="nw"]').attributes('aria-label')).toBe(
			'Crop handle',
		);
		expect(hs.wrapper.find('[data-pptx-crop-frame]').exists()).toBeTruthy();
		expect(hs.wrapper.get('[data-pptx-crop-ghost] img').attributes('src')).toContain('data:');
	});

	it('drags a handle live (client px / zoom), and Escape restores with no undo step', async () => {
		const hs = mountCrop();
		hs.controller.enterCrop('pic');
		await nextTick();
		await dragWestHandle(hs);
		// 100 client px at zoom 2 = 50 slide px off a 200px-wide image.
		expect(picture(hs).cropLeft).toBeCloseTo(0.25);
		expect(picture(hs).x).toBeCloseTo(150);
		expect(hs.history.canUndo.value).toBeFalsy();
		key('Escape');
		await nextTick();
		expect(hs.controller.cropActive.value).toBeFalsy();
		expect(picture(hs).cropLeft ?? 0).toBe(0);
		expect(picture(hs).x).toBe(100);
		expect(hs.history.canUndo.value).toBeFalsy();
	});

	it('commits on Enter with exactly one undo step that restores the pre-crop picture', async () => {
		const hs = mountCrop();
		hs.controller.enterCrop('pic');
		await nextTick();
		await dragWestHandle(hs);
		key('Enter');
		await nextTick();
		expect(hs.controller.cropActive.value).toBeFalsy();
		expect(picture(hs).cropLeft).toBeCloseTo(0.25);
		expect(hs.history.canUndo.value).toBeTruthy();
		hs.history.undo();
		expect(picture(hs).cropLeft ?? 0).toBe(0);
		expect(picture(hs).x).toBe(100);
		expect(hs.history.canUndo.value).toBeFalsy();
	});

	it('commits on a pointer-down outside the overlay and on a selection change', async () => {
		const hs = mountCrop();
		hs.controller.enterCrop('pic');
		await nextTick();
		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(hs.controller.cropActive.value).toBeFalsy();
		hs.controller.enterCrop('pic');
		hs.selectedElementIds.value = [];
		await nextTick();
		expect(hs.controller.cropActive.value).toBeFalsy();
	});
});

describe('merge + crop context-menu entries (vue)', () => {
	function menuFor(elementId: string, selected: string[]): UseContextMenuResult {
		let menu: UseContextMenuResult | null = null;
		const elements = [PICTURE, SHAPE_A, SHAPE_B] as PptxElement[];
		const Host = defineComponent({
			setup() {
				const crop = inject(MergeCropKey);
				menu = useContextMenu({
					canEdit: () => true,
					findActiveElement: (id) => elements.find((el) => el.id === id),
					tableSelection: ref(null),
					hasClipboard: computed(() => false),
					canGroup: computed(() => selected.length > 1),
					selectionGroupable: computed(() => true),
					editTemplateMode: ref(false),
					selectedElementIds: ref(selected),
					inlineEditingElementId: ref<string | null>(null),
					inspectorOpen: ref(false),
					enterInlineEdit: () => {},
					ops: {} as EditorOperations,
					cutElement: () => {},
					copyElement: () => {},
					pasteElement: () => {},
					onGroup: () => {},
					onUngroup: () => {},
					openHyperlinkDialog: () => {},
					mergeCrop: crop,
				});
				return () => h('div');
			},
		});
		harness = mountWithMergeCrop(elements, selected, Host);
		const result = menu as unknown as UseContextMenuResult;
		result.contextMenu.value = { open: true, x: 0, y: 0, elementId };
		return result;
	}

	it('offers Crop on a picture and routes it into crop mode', () => {
		const menu = menuFor('pic', ['pic']);
		expect(menu.contextItems.value.some((item) => item.id === 'crop')).toBeTruthy();
		menu.onContextSelect('crop');
		expect(harness?.controller.cropActive.value).toBeTruthy();
	});

	it('offers the five merge entries on a mergeable multi-selection and runs one', () => {
		const menu = menuFor('a', ['a', 'b']);
		const ids = menu.contextItems.value.map((item) => item.id);
		for (const id of [
			'merge-union',
			'merge-combine',
			'merge-fragment',
			'merge-intersect',
			'merge-subtract',
		]) {
			expect(ids).toContain(id);
		}
		menu.onContextSelect('merge-union');
		expect(harness?.elements().map((el) => el.id)).not.toContain('a');
		expect(harness?.elements()).toHaveLength(2);
	});
});
