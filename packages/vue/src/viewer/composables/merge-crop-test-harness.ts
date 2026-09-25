// oxlint-disable react-hooks/rules-of-hooks
/**
 * Test harness for the Merge Shapes / picture Crop controller: a real
 * `useMergeShapes` + `usePictureCrop` pair over a one-slide deck with a real
 * `useEditorHistory`, provided under `MergeCropKey` to whatever component the
 * test mounts. Test-only (imported by `*.test.ts` files).
 */
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { defineComponent, h, provide, ref, shallowRef } from 'vue';
import type { Component, Ref, ShallowRef } from 'vue';

import type { MergeCropController } from './merge-crop-context';
import { MergeCropKey } from './merge-crop-context';
import { useEditorHistory } from './useEditorHistory';
import type { EditorHistoryResult } from './useEditorHistory';
import { useMergeShapes } from './useMergeShapes';
import { usePictureCrop } from './usePictureCrop';

export interface MergeCropHarness {
	wrapper: VueWrapper;
	controller: MergeCropController;
	slides: ShallowRef<PptxSlide[]>;
	selectedElementIds: Ref<string[]>;
	history: EditorHistoryResult;
	elements: () => PptxElement[];
}

export function mountWithMergeCrop(
	elements: PptxElement[],
	selected: string[],
	child: Component = defineComponent({ render: () => h('div') }),
	childProps: Record<string, unknown> = {},
	canEdit = true,
): MergeCropHarness {
	const slides = shallowRef<PptxSlide[]>([{ id: 'slide-1', elements } as unknown as PptxSlide]);
	const selectedElementIds = ref<string[]>(selected);
	let controller: MergeCropController | null = null;
	let history: EditorHistoryResult | null = null;
	const wrapper = mount(
		defineComponent({
			setup() {
				history = useEditorHistory(slides);
				const input = {
					canEdit: () => canEdit,
					slides,
					activeSlideIndex: ref(0),
					selectedElementIds,
					pushHistory: () => history?.pushHistory(),
				};
				controller = {
					...useMergeShapes(input),
					...usePictureCrop({ ...input, mediaDataUrls: shallowRef(new Map()) }),
				};
				provide(MergeCropKey, controller);
				return () => h(child, childProps);
			},
		}),
		{ attachTo: document.body },
	);
	return {
		wrapper,
		controller: controller as unknown as MergeCropController,
		slides,
		selectedElementIds,
		history: history as unknown as EditorHistoryResult,
		elements: () => slides.value[0].elements,
	};
}
