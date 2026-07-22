// @vitest-environment happy-dom
import type { AiChangeBatch } from 'pptx-viewer-shared/ai';
import { resolveChangeAnimationConfig } from 'pptx-viewer-shared/ai';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { AiChangeOverlay } = await import('./AiChangeOverlay');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
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

describe('aiChangeOverlay', () => {
	it('renders a ghost for a change on the visible slide', () => {
		act(() => root.render(<AiChangeOverlay batch={batch(0)} activeSlideIndex={0} />));
		const ghost = container.querySelector('[data-testid="ai-change-el-1"]');
		expect(ghost).not.toBeNull();
		expect(ghost?.getAttribute('data-ai-change')).toBe('added');
	});

	it('renders nothing when there is no batch', () => {
		act(() => root.render(<AiChangeOverlay batch={null} activeSlideIndex={0} />));
		expect(container.querySelector('[data-testid^="ai-change-"]')).toBeNull();
	});

	it('ignores changes on other slides', () => {
		act(() => root.render(<AiChangeOverlay batch={batch(2)} activeSlideIndex={0} />));
		expect(container.querySelector('[data-testid="ai-change-el-1"]')).toBeNull();
	});
});
