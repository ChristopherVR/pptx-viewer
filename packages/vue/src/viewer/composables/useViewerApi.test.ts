import { PptxHandler, createTextElement } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref, shallowRef } from 'vue';

import { useEditorHistory } from './useEditorHistory';
import { useEditorOperations } from './useEditorOperations';
import { useElementDrag } from './useElementDrag';
import { useInlineEditing } from './useInlineEditing';
import { useViewerApi } from './useViewerApi';

function useHarness(initialSlides: PptxSlide[] = []) {
	const slides = shallowRef(initialSlides);
	const permission = ref(true);
	const editingRequested = ref(true);
	const presenting = ref(false);
	const showMasterView = ref(false);
	const canEdit = computed(() => permission.value && editingRequested.value);
	const mode = computed(() =>
		presenting.value
			? 'present'
			: showMasterView.value
				? 'master'
				: canEdit.value
					? 'edit'
					: 'preview',
	);
	const commitPendingText = vi.fn();
	const history = useEditorHistory(slides);
	const elementOps = useEditorOperations({
		slides,
		activeSlideIndex: ref(0),
		pushHistory: history.pushHistory,
	});
	const options = {
		slides,
		activeSlide: computed(() => slides.value[0]),
		activeSlideIndex: ref(0),
		slideCount: computed(() => slides.value.length),
		selectedElementIds: ref<string[]>([]),
		zoom: ref(1),
		isDirty: ref(false),
		presenting,
		showMasterView,
		mode,
		canEdit,
		loading: ref(false),
		error: ref<string | null>(null),
		editTemplateMode: ref(false),
		setEditingRequested: (value: boolean) => {
			editingRequested.value = value;
		},
		commitPendingText,
		hasActivePointerInteraction: () => false,
		getContent: vi.fn<() => Promise<Uint8Array>>(async () => new Uint8Array()),
		goTo: vi.fn(),
		goPrev: vi.fn(),
		goNext: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		zoomReset: vi.fn(),
		startPresenting: () => {
			presenting.value = true;
		},
		history,
		slideOps: {
			addSlide: vi.fn(),
			deleteSlide: vi.fn(),
			duplicateSlide: vi.fn(),
			moveSlide: vi.fn(),
		},
		toggleSlideHidden: vi.fn(),
		elementOps,
	};
	return { api: useViewerApi(options), options, permission, canEdit, slides, commitPendingText };
}

describe('public viewer mode', () => {
	it('gates public insertion by the live requested mode and never lifts permission', () => {
		const element = createTextElement('Insertion source', { x: 20, y: 30, width: 200, height: 50 });
		const { api, permission, commitPendingText } = useHarness([
			{ id: 'slide', rId: 'rId1', slideNumber: 1, elements: [element] },
		]);
		api.setMode('preview');
		commitPendingText.mockClear();
		expect(api.addElement(element)).toBeUndefined();
		expect(api.getElements()).toHaveLength(1);
		expect(commitPendingText).not.toHaveBeenCalled();
		api.setMode('edit');
		expect(api.addElement(element)).toBeTruthy();
		expect(api.getElements()).toHaveLength(2);
		expect(commitPendingText).toHaveBeenCalledOnce();
		permission.value = false;
		api.setMode('edit');
		expect(api.getMode()).toBe('preview');
		expect(api.addElement(element)).toBeUndefined();
		expect(api.getElements()).toHaveLength(2);
	});

	it('switches permitted edit and preview without a host prop update', () => {
		const { api, canEdit } = useHarness();
		expect(api.getMode()).toBe('edit');
		api.setMode('preview');
		expect(api.getMode()).toBe('preview');
		expect(canEdit.value).toBeFalsy();
		api.setMode('preview');
		api.setMode('edit');
		expect(api.getMode()).toBe('edit');
		expect(canEdit.value).toBeTruthy();
	});

	it('does not lift a host or document permission lock', () => {
		const { api, permission, canEdit } = useHarness();
		permission.value = false;
		api.setMode('edit');
		expect(api.getMode()).toBe('preview');
		expect(canEdit.value).toBeFalsy();
		permission.value = true;
		api.setMode('preview');
		permission.value = false;
		permission.value = true;
		expect(api.getMode()).toBe('preview');
	});

	it.each(['present', 'master'] as const)('leaves %s for actual preview, then edit', (mode) => {
		const { api } = useHarness();
		api.setMode(mode);
		expect(api.getMode()).toBe(mode);
		api.setMode('preview');
		expect(api.getMode()).toBe('preview');
		api.setMode('edit');
		expect(api.getMode()).toBe('edit');
	});

	it.each(['edit', 'master'] as const)(
		'commits pending text from %s before preview and exports the live edited deck',
		async (mode) => {
			const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
			data.slides[0].elements.push(
				createTextElement('Original mode text', { x: 20, y: 30, width: 200, height: 50 }),
			);
			const h = useHarness(data.slides);
			h.api.setMode(mode);
			const target = h.slides.value[0].elements[0];
			const editing = useInlineEditing({
				canEdit: () => h.canEdit.value,
				findActiveElement: (id) => h.slides.value[0].elements.find((element) => element.id === id),
				ops: h.options.elementOps,
			});
			editing.enterInlineEdit(target.id);
			editing.updateInlineText('Pending mode text');
			h.commitPendingText.mockImplementation(() => {
				expect(h.canEdit.value).toBeTruthy();
				editing.commitInlineEdit();
			});
			h.options.getContent.mockImplementation(() => {
				const slides = h.slides.value;
				return handler.save(slides);
			});
			h.api.setMode('preview');
			expect(h.commitPendingText).toHaveBeenCalledOnce();
			expect(h.api.getMode()).toBe('preview');
			const saved = await h.api.getContent();
			const reopened = await new PptxHandler().load(saved);
			expect(
				reopened.slides[0].elements.some(
					(element) => 'text' in element && element.text === 'Pending mode text',
				),
			).toBeTruthy();
			expect(h.api.getElements()).toHaveLength(h.slides.value[0].elements.length);
			h.api.setMode('edit');
			expect(h.api.canUndo()).toBeTruthy();
			h.api.undo();
			expect(h.api.getElements()[0]).toMatchObject({ text: 'Original mode text' });
			h.api.redo();
			expect(h.api.getElements()[0]).toMatchObject({ text: 'Pending mode text' });
		},
	);
});

describe('public cross-slide batches', () => {
	function useBatchHarness() {
		return useHarness(
			[0, 1].map((index) => ({
				id: `slide-${index}`,
				rId: `r${index}`,
				slideNumber: index + 1,
				elements: [
					{ id: 'title', type: 'text', x: 67, y: 40, width: 200, height: 60, text: 'Title' },
				],
			})),
		);
	}

	it('rejects a batch during a live drag without changing its document or undo boundary', async () => {
		const { api, options, slides, commitPendingText } = useBatchHarness();
		const drag = useElementDrag({
			findActiveElement: (id) => slides.value[0].elements.find((element) => element.id === id),
			pushHistory: options.history.pushHistory,
			effectiveZoom: computed(() => 1),
			activeTemplateElements: computed(() => []),
			activeSlide: options.activeSlide,
			activeSlideIndex: options.activeSlideIndex,
			slides,
			templateElementsBySlideId: ref({}),
			canvasSize: ref({ width: 960, height: 540 }),
			enterInlineEdit: vi.fn(),
		});
		options.hasActivePointerInteraction = () => drag.hasActivePointerInteraction();
		const pointer = (type: string, clientX: number) =>
			new MouseEvent(type, { bubbles: true, clientX, clientY: 0 }) as PointerEvent;
		const positions = () => api.getSlides().map((slide) => slide.elements[0].x);
		const changes = api.getSlides().map((slide) => ({
			slideId: slide.id,
			elementId: 'title',
			patch: { x: 200 },
		}));
		drag.startElementDrag('title', pointer('pointerdown', 0), false);
		window.dispatchEvent(pointer('pointermove', 30));
		const dragged = positions();
		expect(dragged[0]).not.toBe(67);
		try {
			await expect(api.updateElements(changes)).rejects.toThrow('pointer interaction');
			expect(positions()).toStrictEqual(dragged);
			expect(commitPendingText).not.toHaveBeenCalled();
		} finally {
			window.dispatchEvent(pointer('pointerup', 30));
		}
		await api.updateElements(changes);
		expect(positions()).toStrictEqual([200, 200]);
		api.undo();
		expect(positions()).toStrictEqual(dragged);
		api.undo();
		expect(positions()).toStrictEqual([67, 67]);
	});

	it('preserves selection and separates consecutive batches and ordinary edits', async () => {
		const { api, options } = useBatchHarness();
		api.selectElements(['title']);
		const changes = (x: number) =>
			[0, 1].map((index) => ({ slideId: `slide-${index}`, elementId: 'title', patch: { x } }));
		const positions = () => api.getSlides().map((slide) => slide.elements[0].x);
		api.updateElement('title', { x: 70 });
		await api.updateElements(changes(84));
		await api.updateElements(changes(90));
		expect(api.getActiveSlideIndex()).toBe(0);
		expect(api.getSelectedElementIds()).toStrictEqual(['title']);
		expect(options.isDirty.value).toBeTruthy();
		api.undo();
		expect(positions()).toStrictEqual([84, 84]);
		api.undo();
		expect(positions()).toStrictEqual([70, 67]);
		api.undo();
		expect(positions()).toStrictEqual([67, 67]);
		api.redo();
		api.redo();
		expect(positions()).toStrictEqual([84, 84]);
	});

	it('keeps invalid, no-op and read-only batches out of history', async () => {
		const { api, permission, commitPendingText } = useBatchHarness();
		await api.updateElements([]);
		await api.updateElements([{ slideId: 'slide-0', elementId: 'title', patch: { x: 67 } }]);
		await expect(
			api.updateElements([
				{ slideId: 'slide-0', elementId: 'title', patch: { x: 84 } },
				{ slideId: 'missing', elementId: 'title', patch: { x: 90 } },
			]),
		).rejects.toThrow();
		permission.value = false;
		await expect(
			api.updateElements([{ slideId: 'slide-0', elementId: 'title', patch: { x: 84 } }]),
		).rejects.toThrow();
		expect(api.getSlides().map((slide) => slide.elements[0].x)).toStrictEqual([67, 67]);
		expect(api.canUndo()).toBeFalsy();
		expect(commitPendingText).not.toHaveBeenCalled();
	});
});
