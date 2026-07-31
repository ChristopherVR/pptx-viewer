// @vitest-environment happy-dom
import { MOTION_PATH_PRESETS } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MotionPathGallery } from './MotionPathGallery';

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
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function render(disabled: boolean, onApply?: (presetId: string) => void): void {
	act(() => {
		root.render(<MotionPathGallery disabled={disabled} onApplyMotionPath={onApply} />);
	});
}

describe('motionPathGallery', () => {
	it('renders every catalogue path as a real button', () => {
		render(false);
		const buttons = container.querySelectorAll('button');
		expect(buttons).toHaveLength(MOTION_PATH_PRESETS.length);
	});

	it('groups the buttons under the five PowerPoint families', () => {
		render(false);
		const headings = [...container.querySelectorAll('span.font-semibold')].map(
			(s) => s.textContent,
		);
		expect(headings).toStrictEqual([
			'pptx.animation.motionPath.family.lines',
			'pptx.animation.motionPath.family.arcs',
			'pptx.animation.motionPath.family.turns',
			'pptx.animation.motionPath.family.shapes',
			'pptx.animation.motionPath.family.loops',
		]);
	});

	it('applies the clicked preset by id', () => {
		const onApply = vi.fn();
		render(false, onApply);
		const first = container.querySelector('button') as HTMLButtonElement;
		act(() => first.click());
		expect(onApply).toHaveBeenCalledWith(MOTION_PATH_PRESETS[0].id);
	});

	it('disables every button when no element is selected', () => {
		render(true);
		const buttons = [...container.querySelectorAll('button')];
		expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBeTruthy();
	});

	it('names the gallery for assistive technology', () => {
		render(false);
		expect(container.firstElementChild?.getAttribute('aria-label')).toBe(
			'pptx.animations.motionPathGalleryAria',
		);
	});
});
