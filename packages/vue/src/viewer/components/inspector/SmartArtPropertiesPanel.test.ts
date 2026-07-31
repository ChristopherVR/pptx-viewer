import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { resetSmartArtEditCounter } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it } from 'vitest';

import SmartArtPropertiesPanel from './SmartArtPropertiesPanel.vue';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId };
}

function smartArtData(overrides: Partial<PptxSmartArtData> = {}): PptxSmartArtData {
	return {
		nodes: [node('n1', 'First'), node('n2', 'Second'), node('n3', 'Third')],
		resolvedLayoutType: 'list',
		colorScheme: 'colorful1',
		style: 'flat',
		...overrides,
	} as PptxSmartArtData;
}

function smartArtElement(data: PptxSmartArtData = smartArtData()): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa-1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: data,
	} as PptxElement;
}

function nonSmartArtElement(): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

/** Read the last emitted `update` patch's smartArtData payload. */
function lastSmartArtData(emitted: unknown): PptxSmartArtData {
	const events = emitted as Array<Array<{ smartArtData?: PptxSmartArtData }>> | undefined;
	if (!events || events.length === 0) {
		throw new Error('no update emitted');
	}
	const patch = events[events.length - 1][0];
	if (!patch.smartArtData) {
		throw new Error('patch has no smartArtData');
	}
	return patch.smartArtData;
}

describe('smartArtPropertiesPanel', () => {
	beforeEach(() => {
		resetSmartArtEditCounter();
	});

	it('shows a muted note for non-smartArt elements', () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: nonSmartArtElement() } });
		expect(wrapper.find('[data-testid="smartart-node-list"]').exists()).toBeFalsy();
		expect(wrapper.text()).toContain('Select a SmartArt graphic');
	});

	it('renders one row per node', () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		expect(wrapper.findAll('[data-testid="smartart-node"]')).toHaveLength(3);
	});

	it('editing a node text emits updated smartArtData with the new text', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		const input = wrapper.findAll('[data-testid="smartart-node-text"]')[0];
		await input.setValue('Renamed');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.find((n) => n.id === 'n1')?.text).toBe('Renamed');
		// Other nodes untouched.
		expect(next.nodes.find((n) => n.id === 'n2')?.text).toBe('Second');
	});

	it('adding an item emits smartArtData with one more node', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.get('[data-testid="smartart-add-item"]').trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes).toHaveLength(4);
	});

	it('adding a sub-item emits a child node parented to the row', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.findAll('[data-testid="smartart-add-sub"]')[0].trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes).toHaveLength(4);
		const child = next.nodes.find((n) => n.parentId === 'n1');
		expect(child?.text).toBe('Sub-item');
	});

	it('removing a node emits smartArtData without it', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.findAll('[data-testid="smartart-remove"]')[1].trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.map((n) => n.id)).not.toContain('n2');
		expect(next.nodes).toHaveLength(2);
	});

	it('disables remove when only one node remains', () => {
		const wrapper = mount(SmartArtPropertiesPanel, {
			props: { element: smartArtElement(smartArtData({ nodes: [node('n1', 'Only')] })) },
		});
		const btn = wrapper.get('[data-testid="smartart-remove"]');
		expect((btn.element as HTMLButtonElement).disabled).toBeTruthy();
	});

	it('tab demotes a node under its preceding sibling', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		const input = wrapper.findAll('[data-testid="smartart-node-text"]')[1];
		await input.trigger('keydown', { key: 'Tab' });

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.find((n) => n.id === 'n2')?.parentId).toBe('n1');
	});

	it('shift+Tab promotes a child to a sibling of its parent', async () => {
		const data = smartArtData({
			nodes: [node('n1', 'Parent'), node('n2', 'Child', 'n1')],
		});
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement(data) } });
		const input = wrapper.findAll('[data-testid="smartart-node-text"]')[1];
		await input.trigger('keydown', { key: 'Tab', shiftKey: true });

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.find((n) => n.id === 'n2')?.parentId).toBeUndefined();
	});

	it('move down reorders a node after its next sibling', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.findAll('[data-testid="smartart-move-down"]')[0].trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['n2', 'n1', 'n3']);
	});

	it('move up reorders a node before its previous sibling', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.findAll('[data-testid="smartart-move-up"]')[2].trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['n1', 'n3', 'n2']);
	});

	it('changing the colour scheme emits smartArtData with the new scheme', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.get('[data-testid="smartart-color-scheme"]').setValue('monochromatic1');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.colorScheme).toBe('monochromatic1');
	});

	it('toggling the style emits smartArtData with the new style', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.get('[data-testid="smartart-style-intense"]').trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.style).toBe('intense');
	});

	it('switching the layout emits smartArtData with the new resolved layout', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.get('[data-testid="smartart-layout-cycle"]').trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.resolvedLayoutType).toBe('cycle');
		// Node content is preserved across a layout switch.
		expect(next.nodes).toHaveLength(3);
	});

	it('does not re-emit when switching to the already-active layout', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.get('[data-testid="smartart-layout-list"]').trigger('click');
		expect(wrapper.emitted('update')).toBeUndefined();
	});

	it('does not mutate the original smartArtData when adding a node', async () => {
		const data = smartArtData();
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement(data) } });
		await wrapper.get('[data-testid="smartart-add-item"]').trigger('click');
		expect(data.nodes).toHaveLength(3);
	});

	it('pressing Enter in a node input inserts a sibling', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		const input = wrapper.findAll('[data-testid="smartart-node-text"]')[0];
		await input.trigger('keydown', { key: 'Enter' });

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes).toHaveLength(4);
	});

	it('backspace on an empty node removes it', async () => {
		const data = smartArtData({
			nodes: [node('n1', 'First'), node('n2', ''), node('n3', 'Third')],
		});
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement(data) } });
		const input = wrapper.findAll('[data-testid="smartart-node-text"]')[1];
		await input.trigger('keydown', { key: 'Backspace' });

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.map((n) => n.id)).toStrictEqual(['n1', 'n3']);
	});

	it('disables Add and shows a bounds hint for a fixed-size layout', () => {
		const data = smartArtData({
			nodes: [node('n1', 'A'), node('n2', 'B'), node('n3', 'C'), node('n4', 'D')],
			resolvedLayoutType: 'matrix',
		});
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement(data) } });
		const add = wrapper.get('[data-testid="smartart-add-item"]');
		expect((add.element as HTMLButtonElement).disabled).toBeTruthy();
		expect(wrapper.get('[data-testid="smartart-bounds-hint"]').text()).toContain('exactly 4');
	});

	it('shows a read-only note for non-tree connections', () => {
		const data = smartArtData({
			connections: [{ sourceId: 'n1', destId: 'n2', type: 'sibTrans' }],
		});
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement(data) } });
		expect(wrapper.find('[data-testid="smartart-extra-connections"]').exists()).toBeTruthy();
	});

	it('exposes accessibility roles on the panel and node list', () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		expect(wrapper.get('[data-testid="smartart-panel"]').attributes('role')).toBe('group');
		expect(wrapper.get('[data-testid="smartart-node-list"]').attributes('role')).toBe('list');
		expect(wrapper.findAll('[role="listitem"]')).toHaveLength(3);
		expect(wrapper.get('[data-testid="smartart-color-scheme"]').attributes('aria-label')).toBe(
			'Colour scheme',
		);
	});

	it('changing a node fill colour emits a per-node style override', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		const fill = wrapper.findAll('[data-testid="smartart-node-fill"]')[0];
		await fill.setValue('#ff0000');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.find((n) => n.id === 'n1')?.style?.fillColor).toBe('#ff0000');
	});

	it('toggling node bold emits a per-node style override', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		await wrapper.findAll('[data-testid="smartart-node-bold"]')[1].trigger('click');

		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.nodes.find((n) => n.id === 'n2')?.style?.bold).toBeTruthy();
	});

	it('node bold button reflects the current node style via aria-pressed', () => {
		const data = smartArtData({
			nodes: [node('n1', 'First'), { id: 'n2', text: 'Second', style: { italic: true } }],
		});
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement(data) } });
		const italic = wrapper.findAll('[data-testid="smartart-node-italic"]')[1];
		expect(italic.attributes('aria-pressed')).toBe('true');
	});
});

/**
 * These controls used to print their OOXML wire tokens (`colorful1`, `flat`) as
 * their own captions. Text and value are asserted separately: changing a value
 * would write a different `dgm:` family into the deck and move this panel out of
 * parity with the other bindings, so only the spelling may change.
 */
describe('smartArtPropertiesPanel - schema tokens are spelled, values are not', () => {
	it('labels the colour-scheme options without changing their values', () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });
		const options = wrapper.get('[data-testid="smartart-color-scheme"]').findAll('option');

		expect(options.map((o) => (o.element as HTMLOptionElement).value)).toStrictEqual([
			'colorful1',
			'colorful2',
			'colorful3',
			'monochromatic1',
			'monochromatic2',
		]);
		expect(options.map((o) => o.text())).toStrictEqual([
			'Colourful 1',
			'Colourful 2',
			'Colourful 3',
			'Monochromatic 1',
			'Monochromatic 2',
		]);
	});

	it('labels the style buttons without changing what they set', async () => {
		const wrapper = mount(SmartArtPropertiesPanel, { props: { element: smartArtElement() } });

		expect(wrapper.get('[data-testid="smartart-style-flat"]').text()).toBe('Flat');
		expect(wrapper.get('[data-testid="smartart-style-moderate"]').text()).toBe('Moderate');
		expect(wrapper.get('[data-testid="smartart-style-intense"]').text()).toBe('Intense');

		// The button still emits the wire token, not its caption.
		await wrapper.get('[data-testid="smartart-style-moderate"]').trigger('click');
		const next = lastSmartArtData(wrapper.emitted('update'));
		expect(next.style).toBe('moderate');
	});
});
