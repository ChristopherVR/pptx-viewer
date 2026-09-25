// @vitest-environment happy-dom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
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

describe('animationPanel timing curve', () => {
	it('shows an unset curve as linear: the writer saves it as accel=0 decel=0', () => {
		const element = { id: 'el1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		const slide = {
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [element],
			animations: [{ elementId: 'el1', entrance: 'fadeIn', order: 0 }],
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
		const select = container.querySelector<HTMLElement & { value?: string }>(
			'[aria-label="pptx.animation.timingCurve"]',
		);
		expect(select).not.toBeNull();
		expect(select?.value ?? select?.getAttribute('value')).toBe('linear');
	});
});
