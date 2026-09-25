// @vitest-environment happy-dom
import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnimationPanel } from './AnimationPanel';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function renderWith(animation: Omit<PptxElementAnimation, 'elementId'>): HTMLButtonElement[] {
	const element = { id: 'el1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
	const slide = {
		id: 's1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [element],
		animations: [{ elementId: 'el1', order: 0, ...animation }],
	} as PptxSlide;
	act(() => {
		root.render(
			<AnimationPanel
				selectedElement={element}
				activeSlide={slide}
				canEdit
				onUpdateSlide={() => undefined}
			/>,
		);
	});
	return [
		...container.querySelectorAll<HTMLButtonElement>('button[title^="pptx.animation.direction."]'),
	];
}

describe('animationPanel direction picker', () => {
	it("offers a Wipe's four edges and marks PowerPoint's default From Bottom active", () => {
		const buttons = renderWith({ entrance: 'wipeIn' });
		expect(buttons.map((button) => button.title)).toStrictEqual([
			'pptx.animation.direction.fromTop',
			'pptx.animation.direction.fromBottom',
			'pptx.animation.direction.fromLeft',
			'pptx.animation.direction.fromRight',
		]);
		const active = buttons.find((button) => button.className.includes('border-primary'));
		expect(active?.title).toBe('pptx.animation.direction.fromBottom');
	});

	it('hides the picker for Float In, which PowerPoint saves with no direction', () => {
		expect(renderWith({ entrance: 'floatIn', direction: 'fromLeft' })).toHaveLength(0);
	});
});
