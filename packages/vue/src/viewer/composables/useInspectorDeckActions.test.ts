import type { PptxHandler, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useInspectorDeckActions } from './useInspectorDeckActions';

function useHarness(overrides: { withHandler?: boolean } = { withHandler: true }) {
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
	const actions = useInspectorDeckActions({
		handler,
		slideMasters,
		canvasSize: ref({ width: 960, height: 540 }),
		slideSize: ref(undefined),
		coreProperties: shallowRef(undefined),
		appProperties: shallowRef(undefined),
		customProperties: shallowRef([]),
		tagCollections: shallowRef([]),
		markDirty,
	});
	return {
		actions,
		handler,
		slideMasters,
		markDirty,
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
			coreProperties: shallowRef(undefined),
			appProperties: shallowRef(undefined),
			customProperties: shallowRef([]),
			tagCollections: shallowRef([]),
			markDirty: vi.fn(),
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
