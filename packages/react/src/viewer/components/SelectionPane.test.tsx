// @vitest-environment happy-dom
/**
 * Selection Pane rename must persist to the element's `name`.
 *
 * The rename input used to discard its value on commit behind a comment
 * claiming `PptxElement` has no `name` field; it does (`cNvPr/@name`, parsed
 * and round-tripped on save). These pin the contract: Enter persists the
 * trimmed name through `setSlides` + `markDirty` (the pane's history-integrated
 * mutation path), an empty commit clears the name, Escape cancels without
 * touching the model, and the row label prefers the stored name.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

import { SelectionPane } from './SelectionPane';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'sp_1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		shapeType: 'roundRect',
		...overrides,
	} as PptxElement;
}

function makeSlide(elements: PptxElement[]): PptxSlide {
	return {
		id: 'ppt/slides/slide1.xml',
		slideNumber: 1,
		elements,
	} as unknown as PptxSlide;
}

interface Harness {
	slides: () => PptxSlide[];
	setSlides: Mock<(action: React.SetStateAction<PptxSlide[]>) => void>;
	markDirty: Mock<() => void>;
	rerender: () => void;
}

function mountPane(initialSlides: PptxSlide[]): Harness {
	let slides = initialSlides;
	const markDirty = vi.fn<() => void>();
	const setSlides = vi.fn<(action: React.SetStateAction<PptxSlide[]>) => void>((action) => {
		slides = typeof action === 'function' ? action(slides) : action;
	});

	const render = (): void => {
		act(() => {
			root.render(
				<SelectionPane
					slides={slides}
					activeSlideIndex={0}
					selectedElementId={null}
					selectedElementIds={[]}
					canEdit
					setSelectedElementId={vi.fn<() => void>()}
					setSelectedElementIds={vi.fn<() => void>()}
					setSlides={setSlides}
					markDirty={markDirty}
					onClose={vi.fn<() => void>()}
				/>,
			);
		});
	};
	render();

	return { slides: () => slides, setSlides, markDirty, rerender: render };
}

function nameLabel(): HTMLElement {
	const label = container.querySelector<HTMLElement>(
		'[data-pptx-selection-pane] [data-pptx-selection-name]',
	);
	if (!label) {
		throw new Error('name label not found');
	}
	return label;
}

function renameInput(): HTMLInputElement {
	const input = container.querySelector<HTMLInputElement>('[data-pptx-selection-pane] input');
	if (!input) {
		throw new Error('rename input not found');
	}
	return input;
}

function startRename(): HTMLInputElement {
	act(() => {
		nameLabel().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
	});
	return renameInput();
}

function typeInto(input: HTMLInputElement, value: string): void {
	act(() => {
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set as (
			v: string,
		) => void;
		setter.call(input, value);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
}

function pressKey(input: HTMLInputElement, key: string): void {
	act(() => {
		input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
	});
}

describe('selection Pane rename', () => {
	it('persists a typed name on Enter through setSlides and markDirty, and shows it', () => {
		const harness = mountPane([makeSlide([shape()])]);
		expect(nameLabel().textContent).toBe('Shape 1');

		const input = startRename();
		expect(input.getAttribute('aria-label')).toBe('Rename element');
		typeInto(input, 'Hero shape');
		pressKey(input, 'Enter');

		expect(harness.setSlides).toHaveBeenCalledOnce();
		expect(harness.markDirty).toHaveBeenCalledOnce();
		expect(harness.slides()[0].elements[0].name).toBe('Hero shape');

		harness.rerender();
		expect(nameLabel().textContent).toBe('Hero shape');
	});

	it('cancels on Escape without mutating the model', () => {
		const harness = mountPane([makeSlide([shape({ name: 'Kept' })])]);
		const input = startRename();
		typeInto(input, 'Discarded');
		pressKey(input, 'Escape');

		expect(harness.setSlides).not.toHaveBeenCalled();
		expect(harness.markDirty).not.toHaveBeenCalled();
		expect(harness.slides()[0].elements[0].name).toBe('Kept');
		expect(nameLabel().textContent).toBe('Kept');
	});

	it('clears the stored name on an empty commit', () => {
		const harness = mountPane([makeSlide([shape({ name: 'Old name' })])]);
		expect(nameLabel().textContent).toBe('Old name');

		const input = startRename();
		typeInto(input, '   ');
		pressKey(input, 'Enter');

		expect(harness.markDirty).toHaveBeenCalledOnce();
		// An explicit `''`, NOT `undefined`. The save writer reads `undefined` as
		// "the model has no opinion" and leaves `cNvPr/@name` alone, so
		// committing it made clearing a name a no-op that the file never saw.
		expect(harness.slides()[0].elements[0].name).toBe('');

		harness.rerender();
		expect(nameLabel().textContent).toBe('Shape 1');
	});

	it('does not write the fallback label into the model on an unedited commit', () => {
		const harness = mountPane([makeSlide([shape()])]);
		const input = startRename();
		pressKey(input, 'Enter');

		expect(harness.setSlides).not.toHaveBeenCalled();
		expect(harness.markDirty).not.toHaveBeenCalled();
		expect(harness.slides()[0].elements[0].name).toBeUndefined();
	});
});
