import type { AiChangeBatch } from 'pptx-viewer-shared/ai';
import { resolveChangeAnimationConfig } from 'pptx-viewer-shared/ai';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import AiChangeOverlay from './AiChangeOverlay.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

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

function mountOverlay(props: {
	batch: AiChangeBatch | null;
	activeSlideIndex: number;
}): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(AiChangeOverlay, {
		target,
		props: {
			batch: props.batch,
			activeSlideIndex: props.activeSlideIndex,
			scale: 1,
			canvasSize: { width: 960, height: 540 },
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

describe('aiChangeOverlay', () => {
	it('renders a ghost for a change on the visible slide', () => {
		const target = mountOverlay({ batch: batch(0), activeSlideIndex: 0 });
		const ghost = target.querySelector('[data-testid="ai-change-el-1"]');
		expect(ghost).not.toBeNull();
		expect(ghost?.getAttribute('data-ai-change')).toBe('added');
	});

	it('renders nothing when there is no batch', () => {
		const target = mountOverlay({ batch: null, activeSlideIndex: 0 });
		expect(target.querySelector('[data-testid^="ai-change-"]')).toBeNull();
	});

	it('ignores changes on other slides', () => {
		const target = mountOverlay({ batch: batch(2), activeSlideIndex: 0 });
		expect(target.querySelector('[data-testid="ai-change-el-1"]')).toBeNull();
	});
});
