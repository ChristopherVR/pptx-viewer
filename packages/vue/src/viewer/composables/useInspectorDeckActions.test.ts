import type { PptxHandler, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useInspectorDeckActions } from './useInspectorDeckActions';

function useHarness(
	overrides: {
		withHandler?: boolean;
		slideSize?: SlideSizeEmu;
		slides?: PptxSlide[];
	} = { withHandler: true },
) {
	const setTemplateBackground = vi.fn();
	const getTemplateBackgroundColor = vi.fn(() => '#abcdef');
	const handler = shallowRef<PptxHandler | null>(
		overrides.withHandler === false
			? null
			: ({ setTemplateBackground, getTemplateBackgroundColor } as unknown as PptxHandler),
	);
	const slideMasters = shallowRef<PptxSlideMaster[]>([
		{ path: 'master1.xml', backgroundColor: undefined, layoutPaths: [] },
	]);
	const markDirty = vi.fn();
	const pushHistory = vi.fn();
	const slides = ref<PptxSlide[]>(overrides.slides ?? []);
	const slideSize = ref<SlideSizeEmu | undefined>(overrides.slideSize);
	const actions = useInspectorDeckActions({
		handler,
		slideMasters,
		canvasSize: ref({ width: 960, height: 540 }),
		slideSize,
		slides,
		coreProperties: shallowRef(undefined),
		appProperties: shallowRef(undefined),
		customProperties: shallowRef([]),
		tagCollections: shallowRef([]),
		markDirty,
		pushHistory,
	});
	return {
		actions,
		handler,
		slideMasters,
		slides,
		slideSize,
		markDirty,
		pushHistory,
		setTemplateBackground,
		getTemplateBackgroundColor,
	};
}

describe('useInspectorDeckActions template background', () => {
	it('calls handler.setTemplateBackground, updates the local master copy, and marks dirty', () => {
		const { actions, slideMasters, markDirty, setTemplateBackground } = useHarness();
		actions.setTemplateBackground('master1.xml', '#ff0000');
		expect(setTemplateBackground).toHaveBeenCalledWith('master1.xml', '#ff0000');
		expect(slideMasters.value[0].backgroundColor).toBe('#ff0000');
		expect(markDirty).toHaveBeenCalledWith();
	});

	it('leaves other masters untouched', () => {
		const setTemplateBackground = vi.fn();
		const getTemplateBackgroundColor = vi.fn();
		const handler = shallowRef({
			setTemplateBackground,
			getTemplateBackgroundColor,
		} as unknown as PptxHandler | null);
		const slideMasters = shallowRef<PptxSlideMaster[]>([
			{ path: 'master1.xml', backgroundColor: '#111111', layoutPaths: [] },
			{ path: 'master2.xml', backgroundColor: '#222222', layoutPaths: [] },
		]);
		const actions = useInspectorDeckActions({
			handler,
			slideMasters,
			canvasSize: ref({ width: 960, height: 540 }),
			slideSize: ref(undefined),
			slides: ref([]),
			coreProperties: shallowRef(undefined),
			appProperties: shallowRef(undefined),
			customProperties: shallowRef([]),
			tagCollections: shallowRef([]),
			markDirty: vi.fn(),
			pushHistory: vi.fn(),
		});
		actions.setTemplateBackground('master2.xml', '#00ff00');
		expect(slideMasters.value[0].backgroundColor).toBe('#111111');
		expect(slideMasters.value[1].backgroundColor).toBe('#00ff00');
	});

	it('reads through to handler.getTemplateBackgroundColor', () => {
		const { actions, getTemplateBackgroundColor } = useHarness();
		expect(actions.getTemplateBackgroundColor('master1.xml')).toBe('#abcdef');
		expect(getTemplateBackgroundColor).toHaveBeenCalledWith('master1.xml');
	});

	it('no-ops when there is no loaded handler', () => {
		const { actions, markDirty } = useHarness({ withHandler: false });
		expect(() => actions.setTemplateBackground('master1.xml', '#ff0000')).not.toThrow();
		expect(markDirty).not.toHaveBeenCalled();
		expect(actions.getTemplateBackgroundColor('master1.xml')).toBeUndefined();
	});
});

function slideWithElement(): PptxSlide {
	return {
		id: 's1',
		elements: [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 100, height: 100 }],
	} as unknown as PptxSlide;
}

describe('useInspectorDeckActions slide-size rescale', () => {
	it('applies immediately when there is no prior slide size (first load)', () => {
		const { actions, slideSize } = useHarness({ slides: [slideWithElement()] });
		actions.updateSlideSize({ widthEmu: 9144000, heightEmu: 6858000 }, { width: 960, height: 720 });
		expect(slideSize.value).toStrictEqual({ widthEmu: 9144000, heightEmu: 6858000 });
		expect(actions.pendingSlideSizeRescale.value).toBeNull();
	});

	it('applies immediately when the deck has no elements', () => {
		const { actions, slideSize } = useHarness({
			slideSize: { widthEmu: 9144000, heightEmu: 6858000 },
			slides: [{ id: 's1', elements: [] } as unknown as PptxSlide],
		});
		actions.updateSlideSize(
			{ widthEmu: 12192000, heightEmu: 6858000 },
			{ width: 1280, height: 720 },
		);
		expect(slideSize.value).toStrictEqual({ widthEmu: 12192000, heightEmu: 6858000 });
		expect(actions.pendingSlideSizeRescale.value).toBeNull();
	});

	it('opens the rescale prompt instead of applying when the deck has content and the size changes', () => {
		const { actions, slideSize } = useHarness({
			slideSize: { widthEmu: 9144000, heightEmu: 6858000 },
			slides: [slideWithElement()],
		});
		actions.updateSlideSize(
			{ widthEmu: 12192000, heightEmu: 6858000 },
			{ width: 1280, height: 720 },
		);
		expect(slideSize.value).toStrictEqual({ widthEmu: 9144000, heightEmu: 6858000 });
		expect(actions.pendingSlideSizeRescale.value).toStrictEqual({
			oldSize: { widthEmu: 9144000, heightEmu: 6858000 },
			newSize: { widthEmu: 12192000, heightEmu: 6858000 },
			newCanvas: { width: 1280, height: 720 },
		});
	});

	it('chooseSlideSizeRescale pushes one history entry, rescales every slide, and applies the new size', () => {
		const { actions, slides, slideSize, pushHistory } = useHarness({
			slideSize: { widthEmu: 9144000, heightEmu: 6858000 },
			slides: [slideWithElement()],
		});
		actions.updateSlideSize(
			{ widthEmu: 18288000, heightEmu: 13716000 },
			{ width: 1920, height: 1440 },
		);
		actions.chooseSlideSizeRescale('maximize');
		expect(pushHistory).toHaveBeenCalledOnce();
		expect(slideSize.value).toStrictEqual({ widthEmu: 18288000, heightEmu: 13716000 });
		expect(slides.value[0]?.elements[0]).toMatchObject({ width: 200, height: 200 });
		expect(actions.pendingSlideSizeRescale.value).toBeNull();
	});

	it('cancelSlideSizeRescale dismisses the prompt without changing the size', () => {
		const { actions, slideSize, pushHistory } = useHarness({
			slideSize: { widthEmu: 9144000, heightEmu: 6858000 },
			slides: [slideWithElement()],
		});
		actions.updateSlideSize(
			{ widthEmu: 12192000, heightEmu: 6858000 },
			{ width: 1280, height: 720 },
		);
		actions.cancelSlideSizeRescale();
		expect(pushHistory).not.toHaveBeenCalled();
		expect(slideSize.value).toStrictEqual({ widthEmu: 9144000, heightEmu: 6858000 });
		expect(actions.pendingSlideSizeRescale.value).toBeNull();
	});
});
