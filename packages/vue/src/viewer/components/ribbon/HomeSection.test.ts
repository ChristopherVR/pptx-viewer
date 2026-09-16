import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import HomeSection from './HomeSection.vue';

function textShape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 's1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		text: 'hi',
		...overrides,
	} as PptxElement;
}

function mountHome(overrides: Record<string, unknown> = {}) {
	return mount(HomeSection, {
		props: {
			canEdit: true,
			clipboardPayload: null,
			onCopy: vi.fn(),
			onCut: vi.fn(),
			onPaste: vi.fn(),
			layoutOptions: [],
			onInsertSlideFromLayout: vi.fn(),
			onUpdateTextStyle: vi.fn(),
			...overrides,
		},
	});
}

/**
 * extractFontInfo's font-size fallback: shared `fontSizeOf` replaces a
 * hardcoded 24pt with PowerPoint's real 18pt presentation-level default
 * (`p:defaultTextStyle`), and this pins that repoint through the rendered
 * ribbon box rather than only unit-testing the shared function.
 */
describe('homeSection - font size box (shared fontSizeOf)', () => {
	it.each([
		['Font family', 'deselection'],
		['Font family', 'read-only mode'],
		['Font size', 'deselection'],
		['Font size', 'read-only mode'],
	] as const)('closes %s on %s and re-enables without reopening', async (label, reason) => {
		const onUpdateTextStyle = vi.fn();
		const wrapper = mountHome({ selectedElement: textShape(), onUpdateTextStyle });
		const picker = wrapper.get(`[aria-label="${label}"]`);
		const popup = () => picker.element.parentElement!.querySelector(':scope > div');
		await picker.trigger('click');
		expect(popup()).not.toBeNull();
		await wrapper.setProps(
			reason === 'deselection' ? { selectedElement: null } : { canEdit: false },
		);
		expect((picker.element as HTMLButtonElement).disabled).toBeTruthy();
		expect(popup()).toBeNull();
		expect(onUpdateTextStyle).not.toHaveBeenCalled();
		await wrapper.setProps({ selectedElement: textShape(), canEdit: true });
		expect((picker.element as HTMLButtonElement).disabled).toBeFalsy();
		expect(popup()).toBeNull();
		await picker.trigger('click');
		expect(popup()).not.toBeNull();
	});

	it('does not format a table with stale cell state from another table', () => {
		const wrapper = mountHome({
			selectedElement: { type: 'table', id: 'table-2' },
			tableEditorState: { elementId: 'table-1', rowIndex: 0, columnIndex: 0 },
		});
		for (const label of ['Font family', 'Font size']) {
			expect(
				(wrapper.get(`[aria-label="${label}"]`).element as HTMLButtonElement).disabled,
			).toBeTruthy();
		}
	});

	it.each([
		['empty selection', null, true, true],
		['image selection', { type: 'image', id: 'i1' }, true, true],
		['read-only text', textShape(), false, true],
		['text selection', textShape(), true, false],
		['empty shape', { ...textShape(), type: 'shape', text: '' }, true, false],
		['table without a selected cell', { type: 'table', id: 'tb1' }, true, true],
	] as const)('gates font pickers for %s', (_name, selectedElement, canEdit, disabled) => {
		const wrapper = mountHome({ selectedElement, canEdit });
		for (const label of ['Font family', 'Font size']) {
			expect((wrapper.get(`[aria-label="${label}"]`).element as HTMLButtonElement).disabled).toBe(
				disabled,
			);
		}
	});

	it("shows 18pt (PowerPoint's real default) with nothing selected, not the old hardcoded 24", () => {
		const wrapper = mountHome({ selectedElement: null });
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('18');
	});

	it('shows 18pt for a text element with no explicit size', () => {
		const wrapper = mountHome({ selectedElement: textShape() });
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('18');
	});

	it('shows the element model size as exact PowerPoint points', () => {
		const wrapper = mountHome({
			selectedElement: textShape({ textStyle: { fontSize: 48.1 * (96 / 72) } }),
		});
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('48.1');
	});

	it('prefers the first text segment style over the element textStyle', () => {
		const wrapper = mountHome({
			selectedElement: textShape({
				textStyle: { fontSize: 32 * (96 / 72) },
				textSegments: [{ text: 'hi', style: { fontSize: 40 * (96 / 72) } }],
			}),
		});
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('40');
	});

	it('converts a point preset back to model pixels', async () => {
		const onUpdateTextStyle = vi.fn();
		const wrapper = mountHome({
			selectedElement: textShape({ textStyle: { fontSize: 16 } }),
			onUpdateTextStyle,
		});
		await wrapper.find('[aria-label="Font size"]').trigger('click');
		const option = wrapper.findAll('button').find((button) => button.text().trim() === '10');
		expect(option).toBeDefined();
		await option!.trigger('click');
		expect(onUpdateTextStyle.mock.lastCall?.[0]?.fontSize).toBeCloseTo(10 * (96 / 72));
	});

	it('keeps point units when the shared callback targets a table cell', async () => {
		const onUpdateTextStyle = vi.fn();
		const wrapper = mountHome({
			selectedElement: {
				type: 'table',
				id: 'table-cell-font-size',
				x: 0,
				y: 0,
				width: 100,
				height: 40,
				tableData: { rows: [], columnWidths: [] },
			} as PptxElement,
			onUpdateTextStyle,
			tableEditorState: { elementId: 'table-cell-font-size', rowIndex: 0, columnIndex: 0 },
		});
		await wrapper.find('[aria-label="Font size"]').trigger('click');
		const option = wrapper.findAll('button').find((button) => button.text().trim() === '10');
		await option!.trigger('click');
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ fontSize: 10 });
	});

	it('falls back to 18pt for a non-text element (e.g. an image)', () => {
		const wrapper = mountHome({
			selectedElement: { id: 'i1', type: 'image', x: 0, y: 0, width: 1, height: 1 } as PptxElement,
		});
		expect(wrapper.find('[aria-label="Font size"]').text()).toBe('18');
	});
});
