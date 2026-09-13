import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, onTestFinished, test, vi } from 'vitest';
import { computed, effectScope, ref, shallowRef } from 'vue';

import { useAutosave } from './useAutosave';
import { useEditorHistory } from './useEditorHistory';
import type { EditorOperations } from './useEditorOperations';
import { useEditorOperations } from './useEditorOperations';
import { useElementInsertion } from './useElementInsertion';
import { useInlineEditing } from './useInlineEditing';
import { useViewerApi } from './useViewerApi';
import type { UseViewerApiOptions } from './useViewerApi';

test('exposes caller-owned element insertion on the public API', () => {
	expect(useViewerApi({} as UseViewerApiOptions).addElement).toBeTypeOf('function');
});

describe('public addElement', () => {
	function harness() {
		const scope = effectScope();
		onTestFinished(() => scope.stop());
		return scope.run(() => {
			const original: PptxElement = {
				id: 'original',
				type: 'text',
				text: 'Before',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
			};
			const slides = shallowRef<PptxSlide[]>([
				{ id: 's1', rId: 'r1', slideNumber: 1, elements: [original] },
			]);
			const activeSlideIndex = ref(0),
				selectedElementIds = ref(['original']);
			const history = useEditorHistory(slides);
			const ops = useEditorOperations({
				slides,
				activeSlideIndex,
				selectedElementIds,
				pushHistory: history.pushHistory,
			});
			const canEdit = ref(true),
				editTemplateMode = ref(false);
			const inline = useInlineEditing({
				canEdit: () => canEdit.value,
				findActiveElement: (id) => ops.activeSlide.value?.elements.find((el) => el.id === id),
				ops,
			});
			const autosave = useAutosave({ slides, enabled: false, intervalMs: 1000, onSave: vi.fn() });
			const options: UseViewerApiOptions = {
				slides,
				activeSlide: ops.activeSlide,
				activeSlideIndex,
				slideCount: computed(() => slides.value.length),
				selectedElementIds,
				zoom: ref(1),
				isDirty: autosave.isDirty,
				presenting: ref(false),
				showMasterView: ref(false),
				mode: ref('edit'),
				canEdit,
				loading: ref(false),
				error: ref(null),
				editTemplateMode,
				commitInlineEdit: inline.commitInlineEdit,
				getContent: async () => new Uint8Array(),
				goTo: vi.fn(),
				goPrev: vi.fn(),
				goNext: vi.fn(),
				zoomIn: vi.fn(),
				zoomOut: vi.fn(),
				zoomReset: vi.fn(),
				startPresenting: vi.fn(),
				history,
				slideOps: {
					addSlide: vi.fn(),
					deleteSlide: vi.fn(),
					duplicateSlide: vi.fn(),
					moveSlide: vi.fn(),
				},
				toggleSlideHidden: vi.fn(),
				elementOps: ops,
			};
			return { api: useViewerApi(options), options, inline, original };
		})!;
	}

	it('clones at the supplied position, selects, marks dirty and retains two synchronous calls', () => {
		const { api, original } = harness();
		const first = api.addElement(original),
			second = api.addElement(original);
		expect(first).toBeTruthy();
		expect(second).not.toBe(first);
		expect(api.getElements().map((el) => el.id)).toStrictEqual(['original', first, second]);
		expect(api.getSelectedElementIds()).toStrictEqual([second]);
		expect(api.getElementById(first!)!).toMatchObject({ x: 10, y: 20, width: 100, height: 50 });
		expect(api.getElementById(first!)).not.toBe(original);
		expect(original.id).toBe('original');
		expect(api.isDirty()).toBeTruthy();
		expect(api.canUndo()).toBeTruthy();
		api.undo();
		expect(api.getElements()).toHaveLength(2);
		api.redo();
		expect(api.getElements()).toHaveLength(3);
	});

	it('commits the real pending inline text before inserting without losing it on insertion undo', () => {
		const { api, inline, original } = harness();
		inline.enterInlineEdit('original');
		inline.updateInlineText('Latest typed body');
		const id = api.addElement(original);
		expect(inline.inlineEditingElementId.value).toBeNull();
		expect(api.getElementById('original')).toMatchObject({ text: 'Latest typed body' });
		expect(api.getSelectedElementIds()).toStrictEqual([id]);
		api.undo();
		expect(api.getElements()).toHaveLength(1);
		expect(api.getElementById('original')).toMatchObject({ text: 'Latest typed body' });
	});

	it.each([
		'readonly',
		'preview',
		'present',
		'presenting',
		'master',
		'template',
		'missing',
		'loading',
		'error',
	] as const)('rejects %s without committing pending text or changing state', (condition) => {
		const { api, options, inline, original } = harness();
		inline.enterInlineEdit('original');
		inline.updateInlineText('Pending');
		if (condition === 'readonly') {
			options.canEdit.value = false;
		} else if (condition === 'loading') {
			options.loading.value = true;
		} else if (condition === 'error') {
			options.error.value = 'Replacement failed';
		} else if (condition === 'presenting') {
			options.presenting.value = true;
		} else if (condition === 'template') {
			options.editTemplateMode.value = true;
		} else if (condition === 'master') {
			options.showMasterView.value = true;
		} else if (condition === 'missing') {
			options.activeSlideIndex.value = 9;
		} else {
			options.mode.value = condition;
		}
		const before = options.slides.value;
		expect(api.addElement(original)).toBeUndefined();
		expect(options.slides.value).toBe(before);
		expect(api.getSelectedElementIds()).toStrictEqual(['original']);
		expect(api.canUndo()).toBeFalsy();
		expect(api.isDirty()).toBeFalsy();
		expect(inline.inlineEditingElementId.value).toBe('original');
	});
});

describe('useElementInsertion fields', () => {
	it('inserts a centred dynamic field and selects it', () => {
		const addElement = vi.fn<(element: PptxElement) => void>();
		const selectedElementIds = ref<string[]>([]);
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement } as unknown as EditorOperations,
			selectedElementIds,
			slides: ref([{ id: 'slide-1', elements: [] } as PptxSlide]),
			activeSlideIndex: ref(0),
			pushHistory: vi.fn(),
			handler: shallowRef(null),
		});

		insertion.addField('slidenum');

		expect(addElement).toHaveBeenCalledOnce();
		const element = addElement.mock.calls[0]?.[0];
		expect(element).toMatchObject({
			type: 'shape',
			text: '1',
			x: 380,
			y: 250,
			width: 200,
			height: 40,
		});
		expect(element?.type === 'shape' ? element.textSegments?.[0]?.fieldType : undefined).toBe(
			'slidenum',
		);
		expect(selectedElementIds.value).toStrictEqual([element?.id]);
	});
});

describe('useElementInsertion.addChart', () => {
	it("inserts Pareto (docs/guide/limitations.md's ChartEx row) as a valid histogram+cumulative-percent chart", () => {
		const addElement = vi.fn<(element: PptxElement) => void>();
		const selectedElementIds = ref<string[]>([]);
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement } as unknown as EditorOperations,
			selectedElementIds,
			slides: ref([{ id: 'slide-1', elements: [] } as PptxSlide]),
			activeSlideIndex: ref(0),
			pushHistory: vi.fn(),
			handler: shallowRef(null),
		});

		insertion.addChart('pareto');

		expect(addElement).toHaveBeenCalledOnce();
		const element = addElement.mock.calls[0]?.[0];
		expect(element?.type).toBe('chart');
		const chartData = element?.type === 'chart' ? element.chartData : undefined;
		expect(chartData?.chartType).toBe('histogram');
		expect(chartData?.series).toHaveLength(2);
		expect(chartData?.series?.[1].histogramOptions?.layout).toBe('pareto');
		expect(selectedElementIds.value).toStrictEqual([element?.id]);
	});
});

describe('useElementInsertion.applyLayoutToActiveSlide', () => {
	function useHarness(handlerImpl: unknown) {
		const slides = ref([
			{ id: 'slide-1', elements: [] } as PptxSlide,
			{ id: 'slide-2', elements: [] } as PptxSlide,
		]);
		const pushHistory = vi.fn();
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement: vi.fn() } as unknown as EditorOperations,
			selectedElementIds: ref<string[]>([]),
			slides,
			activeSlideIndex: ref(1),
			pushHistory,
			handler: shallowRef(handlerImpl as never),
		});
		return { insertion, slides, pushHistory };
	}

	it('swaps the inherited layout artwork over to the new layout', async () => {
		const remapped = {
			id: 'slide-2',
			elements: [
				{ id: 'layout-new', type: 'shape' } as PptxElement,
				{ id: 'own', type: 'shape' } as PptxElement,
			],
			layoutPath: 'ppt/slideLayouts/slideLayout3.xml',
		} as unknown as PptxSlide;
		const templateElementsBySlideId = ref({
			'slide-2': [{ id: 'layout-old', type: 'shape' } as PptxElement],
		});
		const slides = ref([
			{ id: 'slide-1', elements: [] } as PptxSlide,
			{ id: 'slide-2', elements: [] } as PptxSlide,
		]);
		const insertion = useElementInsertion({
			canvasSize: ref({ width: 960, height: 540 }),
			ops: { addElement: vi.fn() } as unknown as EditorOperations,
			selectedElementIds: ref<string[]>([]),
			slides,
			activeSlideIndex: ref(1),
			pushHistory: vi.fn(),
			handler: shallowRef({ applyLayoutToSlide: vi.fn().mockResolvedValue(remapped) } as never),
			templateElementsBySlideId,
		});

		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout3.xml');

		// The deck keeps only the slide's own elements ...
		expect(slides.value[1]!.elements.map((el) => el.id)).toStrictEqual(['own']);
		// ... and the previous layout's artwork is replaced, not merged.
		expect(templateElementsBySlideId.value['slide-2']!.map((el) => el.id)).toStrictEqual([
			'layout-new',
		]);
	});

	it('replaces the active slide with the re-mapped one', async () => {
		const remapped = {
			id: 'slide-2',
			elements: [],
			layoutPath: 'ppt/slideLayouts/slideLayout3.xml',
		} as unknown as PptxSlide;
		const applyLayoutToSlide = vi.fn().mockResolvedValue(remapped);
		const { insertion, slides, pushHistory } = useHarness({ applyLayoutToSlide });

		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout3.xml');

		expect(applyLayoutToSlide).toHaveBeenCalledWith(1, 'ppt/slideLayouts/slideLayout3.xml', [
			expect.objectContaining({ id: 'slide-1' }),
			expect.objectContaining({ id: 'slide-2' }),
		]);
		expect(slides.value).toHaveLength(2);
		// Vue's deep reactivity proxies the stored slide, so compare by value.
		expect(slides.value[1]).toStrictEqual(remapped);
		expect(pushHistory).toHaveBeenCalledOnce();
	});

	it('leaves the deck and history alone when the core call fails', async () => {
		const applyLayoutToSlide = vi.fn().mockRejectedValue(new Error('missing layout'));
		const { insertion, slides, pushHistory } = useHarness({ applyLayoutToSlide });
		const before = slides.value;

		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout9.xml');

		expect(slides.value).toStrictEqual(before);
		expect(pushHistory).not.toHaveBeenCalled();
	});

	it('does nothing before a deck is loaded', async () => {
		const { insertion, pushHistory } = useHarness(null);
		await insertion.applyLayoutToActiveSlide('ppt/slideLayouts/slideLayout3.xml');
		expect(pushHistory).not.toHaveBeenCalled();
	});
});
