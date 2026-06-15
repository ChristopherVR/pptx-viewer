import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import EditorToolbar from './EditorToolbar.vue';

type EditorToolbarProps = {
	canUndo: boolean;
	canRedo: boolean;
	zoomPercent: number;
	hasSelection: boolean;
};

const DEFAULT_PROPS: EditorToolbarProps = {
	canUndo: true,
	canRedo: true,
	zoomPercent: 100,
	hasSelection: true,
};

function mountToolbar(overrides: Partial<EditorToolbarProps> = {}) {
	return mount(EditorToolbar, { props: { ...DEFAULT_PROPS, ...overrides } });
}

function btn(wrapper: ReturnType<typeof mountToolbar>, label: string) {
	return wrapper.get(`button[aria-label="${label}"]`);
}

describe('editorToolbar', () => {
	it('renders the zoom percentage', () => {
		const wrapper = mountToolbar({ zoomPercent: 75 });
		expect(wrapper.get('.pptx-vue-tb-zoom').text()).toBe('75%');
	});

	it('every button is a type="button" with an aria-label', () => {
		const wrapper = mountToolbar();
		const buttons = wrapper.findAll('button');
		expect(buttons.length).toBeGreaterThan(0);
		for (const b of buttons) {
			expect(b.attributes('type')).toBe('button');
			expect(b.attributes('aria-label')).toBeTruthy();
		}
	});

	it.each([
		['Undo', 'undo'],
		['Redo', 'redo'],
		['Zoom in', 'zoom-in'],
		['Zoom out', 'zoom-out'],
		['Reset zoom to 100%', 'zoom-reset'],
		['Add text box', 'add-text'],
		['Duplicate selection', 'duplicate-selected'],
		['Bring forward', 'bring-forward'],
		['Send backward', 'send-backward'],
		['Delete selection', 'delete-selected'],
	])('clicking %s emits %s', async (label, event) => {
		const wrapper = mountToolbar();
		await btn(wrapper, label).trigger('click');
		expect(wrapper.emitted(event)).toHaveLength(1);
	});

	it.each([
		['Add Rectangle', 'rect'],
		['Add Ellipse', 'ellipse'],
		['Add Rounded rectangle', 'roundRect'],
		['Add Triangle', 'triangle'],
	])('clicking %s emits add-shape with the preset payload', async (label, preset) => {
		const wrapper = mountToolbar();
		await btn(wrapper, label).trigger('click');
		const emitted = wrapper.emitted('add-shape');
		expect(emitted).toHaveLength(1);
		expect(emitted?.[0]).toStrictEqual([preset]);
	});

	it('disables undo/redo when canUndo/canRedo are false', () => {
		const wrapper = mountToolbar({ canUndo: false, canRedo: false });
		expect(btn(wrapper, 'Undo').attributes('disabled')).toBeDefined();
		expect(btn(wrapper, 'Redo').attributes('disabled')).toBeDefined();
	});

	it('enables undo/redo when canUndo/canRedo are true', () => {
		const wrapper = mountToolbar({ canUndo: true, canRedo: true });
		expect(btn(wrapper, 'Undo').attributes('disabled')).toBeUndefined();
		expect(btn(wrapper, 'Redo').attributes('disabled')).toBeUndefined();
	});

	it('disables selection actions when hasSelection is false', () => {
		const wrapper = mountToolbar({ hasSelection: false });
		for (const label of [
			'Delete selection',
			'Duplicate selection',
			'Bring forward',
			'Send backward',
		]) {
			expect(btn(wrapper, label).attributes('disabled')).toBeDefined();
		}
	});

	it('does not emit selection actions while disabled', async () => {
		const wrapper = mountToolbar({ hasSelection: false });
		await btn(wrapper, 'Delete selection').trigger('click');
		expect(wrapper.emitted('delete-selected')).toBeUndefined();
	});

	it('enables selection actions when hasSelection is true', () => {
		const wrapper = mountToolbar({ hasSelection: true });
		for (const label of [
			'Delete selection',
			'Duplicate selection',
			'Bring forward',
			'Send backward',
		]) {
			expect(btn(wrapper, label).attributes('disabled')).toBeUndefined();
		}
	});
});
