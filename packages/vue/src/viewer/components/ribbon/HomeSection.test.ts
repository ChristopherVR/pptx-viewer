import { enableAutoUnmount, mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import type { PptxUiSelectElement } from 'pptx-viewer-shared';
import { createRibbonControlIcon } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import FontDecorationControls from './FontDecorationControls.vue';
import HomeSection from './HomeSection.vue';

enableAutoUnmount(afterEach);

function displayedValue(picker: Element): string {
	return picker.shadowRoot!.querySelector('[part="value"]')!.textContent!;
}

async function choose(picker: Element, value: string): Promise<void> {
	const select = picker as PptxUiSelectElement;
	select.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
	const index = select.options.findIndex((option) => option.value === value);
	select.shadowRoot!.querySelector<HTMLElement>(`[data-index="${index}"]`)!.click();
	await nextTick();
}

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
		attachTo: document.body,
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
	it('renders the shared font-step artwork and forwards each action once', async () => {
		const onAction = vi.fn();
		const wrapper = mount(FontDecorationControls, {
			props: {
				disabled: false,
				textStyle: { fontSize: 24 },
				onIncrease: onAction,
				onDecrease: onAction,
			},
		});
		for (const control of ['increaseFontSize', 'decreaseFontSize']) {
			const button = wrapper.get(`[data-ribbon-control="home.font.${control}"]`);
			expect(button.get('svg').element.innerHTML).toBe(
				createRibbonControlIcon(document, `home.font.${control}`).innerHTML,
			);
			expect((button.element.parentElement as HTMLElement).dataset.pptxChrome).toBe(
				'control-cluster',
			);
			await button.trigger('click');
		}
		expect(onAction).toHaveBeenCalledTimes(2);
	});

	it.each([
		['Font family', 'deselection'],
		['Font family', 'read-only mode'],
		['Font size', 'deselection'],
		['Font size', 'read-only mode'],
	] as const)('closes %s on %s and re-enables without reopening', async (label, reason) => {
		const onUpdateTextStyle = vi.fn();
		const wrapper = mountHome({ selectedElement: textShape(), onUpdateTextStyle });
		const picker = wrapper.get(`[aria-label="${label}"]`);
		const trigger = () => picker.element.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
		const popup = () => picker.element.hasAttribute('open');
		trigger().click();
		expect(popup()).toBeTruthy();
		await wrapper.setProps(
			reason === 'deselection' ? { selectedElement: null } : { canEdit: false },
		);
		expect((picker.element as PptxUiSelectElement).disabled).toBeTruthy();
		expect(popup()).toBeFalsy();
		expect(onUpdateTextStyle).not.toHaveBeenCalled();
		await wrapper.setProps({ selectedElement: textShape(), canEdit: true });
		expect((picker.element as PptxUiSelectElement).disabled).toBeFalsy();
		expect(popup()).toBeFalsy();
		trigger().click();
		expect(popup()).toBeTruthy();
	});

	it('does not format a table with stale cell state from another table', () => {
		const wrapper = mountHome({
			selectedElement: { type: 'table', id: 'table-2' },
			tableEditorState: { elementId: 'table-1', rowIndex: 0, columnIndex: 0 },
		});
		for (const label of ['Font family', 'Font size']) {
			expect(
				(wrapper.get(`[aria-label="${label}"]`).element as PptxUiSelectElement).disabled,
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
			expect((wrapper.get(`[aria-label="${label}"]`).element as PptxUiSelectElement).disabled).toBe(
				disabled,
			);
		}
	});

	it('shows the reference 24pt display while formatting is disabled with no selection', () => {
		const wrapper = mountHome({ selectedElement: null });
		expect(displayedValue(wrapper.get('[aria-label="Font size"]').element)).toBe('24');
	});

	it('shows 18pt for a text element with no explicit size', () => {
		const wrapper = mountHome({ selectedElement: textShape() });
		expect(displayedValue(wrapper.get('[aria-label="Font size"]').element)).toBe('18');
	});

	it('shows the element model size as exact PowerPoint points', () => {
		const wrapper = mountHome({
			selectedElement: textShape({ textStyle: { fontSize: 48.1 * (96 / 72) } }),
		});
		expect(displayedValue(wrapper.get('[aria-label="Font size"]').element)).toBe('48.1');
	});

	it('prefers the first text segment style over the element textStyle', () => {
		const wrapper = mountHome({
			selectedElement: textShape({
				textStyle: { fontSize: 32 * (96 / 72) },
				textSegments: [{ text: 'hi', style: { fontSize: 40 * (96 / 72) } }],
			}),
		});
		expect(displayedValue(wrapper.get('[aria-label="Font size"]').element)).toBe('40');
	});

	it('converts a point preset back to model pixels', async () => {
		const onUpdateTextStyle = vi.fn();
		const wrapper = mountHome({
			selectedElement: textShape({ textStyle: { fontSize: 16 } }),
			onUpdateTextStyle,
		});
		await choose(wrapper.get('[aria-label="Font size"]').element, '10');
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
		await choose(wrapper.get('[aria-label="Font size"]').element, '10');
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ fontSize: 10 });
	});

	it('shows the reference 24pt display for an ineligible image selection', () => {
		const wrapper = mountHome({
			selectedElement: { id: 'i1', type: 'image', x: 0, y: 0, width: 1, height: 1 } as PptxElement,
		});
		expect(displayedValue(wrapper.get('[aria-label="Font size"]').element)).toBe('24');
	});
});
