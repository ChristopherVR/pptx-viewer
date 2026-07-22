import { mount } from '@vue/test-utils';
import type { AiChangeBatch } from 'pptx-viewer-shared/ai';
import { resolveChangeAnimationConfig } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import AiChangeOverlay from './AiChangeOverlay.vue';

/**
 * The change overlay draws one ghost rect per changed element on the visible
 * slide (carrying its own from/to bounds), and nothing when there is no batch
 * or when the change belongs to another slide.
 */
function batch(slideIndex: number): AiChangeBatch {
	return {
		changes: [
			{
				slideIndex,
				elementId: 'el-1',
				kind: 'added',
				to: { x: 40, y: 40, width: 200, height: 60 },
			},
		],
		slideIndex,
		nonce: 1,
		config: resolveChangeAnimationConfig(),
	};
}

describe('aiChangeOverlay', () => {
	it('renders a ghost for a change on the visible slide', () => {
		const wrapper = mount(AiChangeOverlay, {
			props: { batch: batch(0), activeSlideIndex: 0 },
		});
		const ghost = wrapper.find('[data-testid="ai-change-el-1"]');
		expect(ghost.exists()).toBeTruthy();
		expect(ghost.attributes('data-ai-change')).toBe('added');
	});

	it('renders nothing when there is no batch', () => {
		const wrapper = mount(AiChangeOverlay, {
			props: { batch: null, activeSlideIndex: 0 },
		});
		expect(wrapper.find('[data-testid^="ai-change-"]').exists()).toBeFalsy();
	});

	it('ignores changes on other slides', () => {
		const wrapper = mount(AiChangeOverlay, {
			props: { batch: batch(2), activeSlideIndex: 0 },
		});
		expect(wrapper.find('[data-testid="ai-change-el-1"]').exists()).toBeFalsy();
	});
});
