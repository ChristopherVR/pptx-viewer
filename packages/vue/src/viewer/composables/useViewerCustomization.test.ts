// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import { createViewerOptionsStore } from 'pptx-viewer-shared';
import type { ToolbarActionId, ViewerCustomization } from 'pptx-viewer-shared';
import type { PptxAiConfig } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, reactive } from 'vue';

import { useResolvedCustomization, useViewerCustomization } from './useViewerCustomization';
import type { UseViewerCustomizationResult } from './useViewerCustomization';

afterEach(() => localStorage.clear());

function setup(initial?: ViewerCustomization, hiddenActions?: ToolbarActionId[]) {
	const store = createViewerOptionsStore({ persist: false });
	const props = reactive<{
		customization?: ViewerCustomization;
		hiddenActions?: ToolbarActionId[];
		ai?: PptxAiConfig;
	}>({ customization: initial, hiddenActions });
	let result: UseViewerCustomizationResult | null = null;
	let injected: ReturnType<typeof useResolvedCustomization> | null = null;
	const Child = defineComponent({
		setup() {
			injected = useResolvedCustomization();
			return () => h('span');
		},
	});
	const wrapper = mount(
		defineComponent({
			setup() {
				result = useViewerCustomization({ props, optionsStore: store });
				return () => h(Child);
			},
		}),
	);
	return {
		store,
		props,
		wrapper,
		result: result as unknown as UseViewerCustomizationResult,
		injected: () => injected,
	};
}

describe('useViewerCustomization', () => {
	it('forces a locked setting into the options store, on mount and on change', () => {
		const { store, result } = setup({ options: { locked: { 'general.userName': 'Kiosk User' } } });
		expect(store.getOptions().general.userName).toBe('Kiosk User');
		expect(store.isLocked('general', 'userName')).toBeTruthy();
		store.setValue('general', 'userName', 'Someone else');
		expect(store.getOptions().general.userName).toBe('Kiosk User');

		result.api.lockSetting('advanced.showGrid', true);
		expect(store.isLocked('advanced', 'showGrid')).toBeTruthy();
		result.api.unlockSetting('general.userName');
		expect(store.isLocked('general', 'userName')).toBeFalsy();
	});

	it('mirrors imperative edits into the resolved ref provided to children', async () => {
		const { result, injected } = setup();
		expect(injected()?.value).toBe(result.resolved.value);
		result.api.hideRibbonTab('insert');
		await nextTick();
		expect(result.resolved.value.hiddenActions.has('insert')).toBeTruthy();
		expect(injected()?.value.hiddenActions.has('insert')).toBeTruthy();
	});

	it('unions the legacy hiddenActions prop with the customisation', () => {
		const { result } = setup({ ribbon: { hiddenTabs: ['draw'] } }, ['share']);
		expect(new Set(result.effectiveHiddenActions.value)).toStrictEqual(new Set(['draw', 'share']));
	});

	it('replaces imperative edits when the prop changes identity', async () => {
		const { result, props } = setup();
		result.api.hideRibbonTab('insert');
		props.customization = { hiddenPanels: ['statusBar'] };
		await nextTick();
		expect(result.resolved.value.hiddenActions.has('insert')).toBeFalsy();
		expect(result.panelVisible('statusBar')).toBeFalsy();
	});

	it('folds dialog and feature rules into the gate helpers', () => {
		const { result } = setup({ disabledFeatures: ['collaboration', 'ai'] });
		expect(result.dialogAvailable('share')).toBeFalsy();
		expect(result.featureEnabled('ai')).toBeFalsy();
		expect(result.effectiveHiddenActions.value).toContain('share');
	});

	it('folds the ai feature switch into the single AI gate', () => {
		const { result, props } = setup({ disabledFeatures: ['ai'] });
		expect(result.aiEnabled.value).toBeFalsy();
		props.ai = { connection: { kind: 'endpoint', api: '/ai' } };
		expect(result.aiEnabled.value).toBeFalsy();
		result.api.setFeatureEnabled('ai', true);
		expect(result.aiEnabled.value).toBeTruthy();
		expect(result.aiConfig.value).toBeDefined();
	});
});
