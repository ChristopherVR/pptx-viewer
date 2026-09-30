import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';

import type { UseAnimationPlaybackResult } from './useAnimationPlayback';
import { usePresentationAnimationStyles } from './usePresentationAnimationStyles';

describe('presentation animation trigger hit testing', () => {
	it('marks trigger shapes and removes stale markers', async () => {
		const root = document.createElement('div');
		root.innerHTML = '<div data-element-id="trigger"></div>';
		const ids = shallowRef<ReadonlySet<string>>(new Set(['trigger']));
		const scope = effectScope();
		scope.run(() =>
			usePresentationAnimationStyles({
				frameRef: ref(root),
				activeSlide: () => 'slide',
				playback: {
					presentationElementStates: shallowRef(new Map()),
					interactiveTriggerShapeIds: ids,
					hoverTriggerShapeIds: shallowRef(new Set()),
					handleInteractiveShapeClick: vi.fn(),
				} as unknown as UseAnimationPlaybackResult,
			}),
		);
		await nextTick();
		await nextTick();
		expect(root.firstElementChild?.hasAttribute('data-pptx-anim-trigger')).toBeTruthy();
		ids.value = new Set();
		await nextTick();
		await nextTick();
		expect(root.firstElementChild?.hasAttribute('data-pptx-anim-trigger')).toBeFalsy();
		scope.stop();
	});
});
