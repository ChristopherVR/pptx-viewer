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
});
