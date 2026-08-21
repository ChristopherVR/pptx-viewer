import type { PptxSmartArtData } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSmartArtSection } from './smartart-section';
import type { InspectorHandlers, InspectorState } from './types';

/** A `section()` factory matching the one `createInspector` passes in. */
function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

/** Mount with the identity translator so an option's text IS its i18n key. */
function mount() {
	const setSmartArtColorScheme = vi.fn();
	const section = createSmartArtSection(document, (key) => key, sectionFactory(), {
		setSmartArtColorScheme,
		setSmartArtLayout: vi.fn(),
		setSmartArtNodeText: vi.fn(),
		setSmartArtNodeStyle: vi.fn(),
		mutateSmartArtNode: vi.fn(),
	} as unknown as InspectorHandlers);
	section.update({
		isSmartArt: true,
		smartArtData: { nodes: [], resolvedLayoutType: 'list' } as unknown as PptxSmartArtData,
	} as InspectorState);
	const scheme = section.el.querySelector<HTMLSelectElement>(
		'[data-testid="smartart-color-scheme"]',
	)!;
	return { section, setSmartArtColorScheme, scheme };
}

/** Mount with real nodes and a `replaceSmartArtData` that feeds back through `update`. */
function mountWithNodes(nodes: PptxSmartArtData['nodes']) {
	let data: PptxSmartArtData = { nodes, resolvedLayoutType: 'list' } as PptxSmartArtData;
	const replaceSmartArtData = vi.fn((next: PptxSmartArtData) => {
		data = next;
		section.update({ isSmartArt: true, smartArtData: data } as InspectorState);
	});
	const section = createSmartArtSection(document, (key) => key, sectionFactory(), {
		setSmartArtColorScheme: vi.fn(),
		setSmartArtLayout: vi.fn(),
		setSmartArtNodeText: vi.fn(),
		setSmartArtNodeStyle: vi.fn(),
		mutateSmartArtNode: vi.fn(),
		replaceSmartArtData,
	} as unknown as InspectorHandlers);
	document.body.appendChild(section.el);
	section.update({ isSmartArt: true, smartArtData: data } as InspectorState);
	return { section, replaceSmartArtData, getData: () => data };
}

function nodeInputs(el: HTMLElement): HTMLInputElement[] {
	return [...el.querySelectorAll<HTMLInputElement>('[data-testid="smartart-node-text"]')];
}

describe('smartArtSection keyboard editing', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('enter key inserts a new sibling after the current node', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		]);
		const [first] = nodeInputs(section.el);
		first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		const data = getData();
		expect(data.nodes).toHaveLength(3);
		expect(data.nodes[1]?.text).toBe('');
	});

	it('backspace key on an empty node removes it', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: '' },
		]);
		const [, second] = nodeInputs(section.el);
		second.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
		);
		expect(getData().nodes).toHaveLength(1);
	});

	it('backspace key on a node with text does not remove it', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		]);
		const [, second] = nodeInputs(section.el);
		second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
		expect(getData().nodes).toHaveLength(2);
	});

	it('tab key demotes the node under its preceding sibling', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		]);
		const [, second] = nodeInputs(section.el);
		second.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
		);
		expect(getData().nodes.find((n) => n.id === 'n2')?.parentId).toBe('n1');
	});

	/**
	 * The input commits its text via `change` (blur-triggered), which never
	 * fires on Tab because the handler calls `preventDefault()`. A demote that
	 * read the last-committed (pre-edit) node text instead of the live input
	 * value silently discarded whatever the user had just typed.
	 */
	it('tab key commits the just-typed text before demoting, not just the demote', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		]);
		const [, second] = nodeInputs(section.el);
		second.value = 'Two edited';
		second.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
		);
		const node = getData().nodes.find((n) => n.id === 'n2');
		expect(node?.text).toBe('Two edited');
		expect(node?.parentId).toBe('n1');
	});

	it('enter key commits the just-typed text before inserting a sibling', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two' },
		]);
		const [first] = nodeInputs(section.el);
		first.value = 'One edited';
		first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		const data = getData();
		expect(data.nodes.find((n) => n.id === 'n1')?.text).toBe('One edited');
		expect(data.nodes).toHaveLength(3);
	});

	it('shift+tab promotes an already-nested node back to top level', () => {
		const { section, getData } = mountWithNodes([
			{ id: 'n1', text: 'One' },
			{ id: 'n2', text: 'Two', parentId: 'n1' },
		]);
		const inputs = nodeInputs(section.el);
		const nested = inputs.find((input) => input.dataset.nodeId === 'n2')!;
		nested.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
		);
		expect(getData().nodes.find((n) => n.id === 'n2')?.parentId).toBeUndefined();
	});
});

describe('smartart colour scheme picker', () => {
	it('keeps the five `dgm:colorsDef` families as the option values', () => {
		const { scheme } = mount();

		expect(Array.from(scheme.options).map((option) => option.value)).toStrictEqual([
			'colorful1',
			'colorful2',
			'colorful3',
			'monochromatic1',
			'monochromatic2',
		]);
	});

	it('spells the families rather than showing `monochromatic2`', () => {
		const { scheme } = mount();

		expect(Array.from(scheme.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.smartart.schemeColorful1',
			'pptx.smartart.schemeColorful2',
			'pptx.smartart.schemeColorful3',
			'pptx.smartart.schemeMonochromatic1',
			'pptx.smartart.schemeMonochromatic2',
		]);
	});

	it('still commits the family token', () => {
		const { scheme, setSmartArtColorScheme } = mount();

		scheme.value = 'monochromatic1';
		scheme.dispatchEvent(new Event('change'));

		expect(setSmartArtColorScheme).toHaveBeenCalledWith('monochromatic1');
	});

	it('captions the layout buttons from the shared layout catalogue', () => {
		const { section } = mount();
		const button = section.el.querySelector<HTMLButtonElement>(
			'[data-testid="smartart-layout-hierarchy"]',
		)!;

		expect(button.textContent).toBe('pptx.smartart.category.hierarchy');
	});
});
