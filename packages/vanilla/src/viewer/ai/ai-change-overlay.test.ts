import type { AiChangeBatch } from 'pptx-viewer-shared/ai';
import { resolveChangeAnimationConfig } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { ChangeAnimatorLike } from './ai-change-overlay';
import { buildChangeGhostLayer, mountAiChangeOverlay } from './ai-change-overlay';

const config = resolveChangeAnimationConfig();

/** A batch with one change on slide 0 and one on slide 1. */
function twoSlideBatch(): AiChangeBatch {
	return {
		nonce: 1,
		slideIndex: 0,
		config,
		changes: [
			{
				slideIndex: 0,
				elementId: 'a',
				kind: 'moved',
				from: { x: 0, y: 0, width: 10, height: 10 },
				to: { x: 50, y: 60, width: 10, height: 10 },
			},
			{
				slideIndex: 1,
				elementId: 'b',
				kind: 'added',
				to: { x: 5, y: 5, width: 20, height: 20 },
			},
		],
	};
}

/** A minimal, manually-driven change animator for the mount test. */
function fakeAnimator(): ChangeAnimatorLike & { push(batch: AiChangeBatch | null): void } {
	let batch: AiChangeBatch | null = null;
	const listeners = new Set<(b: AiChangeBatch | null) => void>();
	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		current: () => batch,
		push(next) {
			batch = next;
			for (const l of listeners) {
				l(next);
			}
		},
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('buildChangeGhostLayer', () => {
	it('draws a ghost per change on the active slide', () => {
		const layer = buildChangeGhostLayer(document, twoSlideBatch(), 0);
		expect(layer).not.toBeNull();
		if (!layer) {
			return;
		}
		const ghosts = layer.querySelectorAll<HTMLElement>('.pptxv-ai-change-ghost');
		expect(ghosts).toHaveLength(1);
		expect(ghosts[0]?.getAttribute('data-ai-change')).toBe('moved');
		// Ghosts are non-interactive and excluded from export rasterisation.
		expect(layer.getAttribute('data-export-ignore')).toBe('true');
		expect(ghosts[0]?.style.pointerEvents).toBe('none');
	});

	it('returns null when nothing on the active slide changed', () => {
		expect(buildChangeGhostLayer(document, twoSlideBatch(), 2)).toBeNull();
	});
});

describe('mountAiChangeOverlay', () => {
	function buildStage() {
		const wrap = document.createElement('div');
		const stage = document.createElement('div');
		stage.className = 'pptxv-stage';
		wrap.appendChild(stage);
		document.body.appendChild(wrap);
		return stage;
	}

	it('paints ghosts inside the stage for the active slide and clears on null', () => {
		const stage = buildStage();
		const store = createStore({ ...createInitialViewerState(), currentSlide: 0 });
		const animator = fakeAnimator();
		let navigated = -1;

		const overlay = mountAiChangeOverlay({
			doc: document,
			store,
			animator,
			getStageRoot: () => stage,
			goToSlide: (index) => (navigated = index),
		});

		animator.push(twoSlideBatch());
		// The batch lives on slide 0, so the overlay reveals it and draws one ghost.
		expect(navigated).toBe(0);
		expect(stage.querySelectorAll('.pptxv-ai-change-ghost')).toHaveLength(1);

		animator.push(null);
		expect(stage.querySelector('.pptxv-ai-change-layer')).toBeNull();

		overlay.destroy();
	});

	it('draws no ghosts when the active slide has no changes', () => {
		const stage = buildStage();
		const store = createStore({ ...createInitialViewerState(), currentSlide: 5 });
		const animator = fakeAnimator();

		const overlay = mountAiChangeOverlay({
			doc: document,
			store,
			animator,
			getStageRoot: () => stage,
			goToSlide: () => undefined,
		});

		animator.push(twoSlideBatch());
		expect(stage.querySelectorAll('.pptxv-ai-change-ghost')).toHaveLength(0);

		overlay.destroy();
	});
});
