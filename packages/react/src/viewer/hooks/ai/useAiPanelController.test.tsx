// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AiPanelController, UseAiPanelControllerInput } from './useAiPanelController';
import { useAiPanelController } from './useAiPanelController';

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

const shape: PptxElement = {
	id: 'rect-5',
	type: 'shape',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
} as unknown as PptxElement;

function mount(input: UseAiPanelControllerInput): { api: () => AiPanelController } {
	const captured: { value: AiPanelController | null } = { value: null };
	function Probe({ value }: { value: UseAiPanelControllerInput }): null {
		captured.value = useAiPanelController(value);
		return null;
	}
	act(() => root.render(<Probe value={input} />));
	return {
		api: () => {
			if (!captured.value) {
				throw new Error('hook not captured');
			}
			return captured.value;
		},
	};
}

const baseInput: UseAiPanelControllerInput = {
	activeSlideIndex: 2,
	selectedElementId: 'rect-5',
	selectedElementIds: ['rect-5'],
	selectedElement: shape,
};

describe('useAiPanelController', () => {
	it('askAboutSelection opens the panel, pins the live focus, and bumps the prefill nonce', () => {
		const h = mount(baseInput);
		expect(h.api().isOpen).toBeFalsy();
		const nonceBefore = h.api().prefill.nonce;

		act(() => h.api().askAboutSelection());

		expect(h.api().isOpen).toBeTruthy();
		expect(h.api().pinnedFocus).toStrictEqual([
			{ kind: 'element', slideIndex: 2, elementId: 'rect-5' },
		]);
		expect(h.api().prefill.text).toBe('');
		expect(h.api().prefill.nonce).toBe(nonceBefore + 1);
	});

	it('fixSelection prefills a fix directive naming the element and slide', () => {
		const h = mount(baseInput);
		act(() => h.api().fixSelection());

		expect(h.api().isOpen).toBeTruthy();
		expect(h.api().prefill.text).toContain('rect-5');
		expect(h.api().prefill.text).toContain('slide 3');
		expect(h.api().prefill.text.toLowerCase()).toContain('fix');
	});

	it('pin then clear focus follows the live selection again', () => {
		const h = mount(baseInput);
		act(() => h.api().pinFocus());
		expect(h.api().pinnedFocus).not.toBeNull();
		act(() => h.api().clearPinnedFocus());
		expect(h.api().pinnedFocus).toBeNull();
	});
});
